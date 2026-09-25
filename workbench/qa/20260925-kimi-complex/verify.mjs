import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startSite } from './server.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(here,'evidence',stamp), media=path.resolve(here,'../../.local/kimi-complex/runs',stamp);
await mkdir(out,{recursive:true}); await mkdir(media,{recursive:true});
const site=await startSite(); const browser=await chromium.launch({headless:true});
const cases=JSON.parse(await readFile(path.join(here,'cases.json'),'utf8'));
const results=[];const checks=[];
const register=(id,fn)=>checks.push({id,fn});
const text=async(p,s)=>(await p.locator(s).innerText()).trim();
const equal=assert.deepEqual;
const ids=p=>p.locator('#devBody tr td:nth-child(2)').allTextContents();
const row=(p,id)=>p.locator('#devBody tr').filter({has:p.locator('td',{hasText:new RegExp('^'+id+'$')})});
const rec=(p,id)=>p.locator('#recBody tr').filter({has:p.locator('td',{hasText:new RegExp('^'+id+'$')})});
async function statuses(p,names){for(const [id,name] of [['stIdle','空闲'],['stBusy','使用中'],['stMaint','维护']])await p.locator('#'+id).setChecked(names.includes(name));}
async function chooseSite(p,name){await p.locator('#siteBtn').click();await p.getByRole('option',{name,exact:true}).click();}
async function findSelect(p,id){await p.locator('#q').fill(id);await row(p,id).locator('input[type=checkbox]').check();}
async function begin(p,id='EQ-101'){await findSelect(p,id);await p.locator('#batchBook').click();await p.locator('#to2').click();}
async function form(p,override={}){const v={applicant:'测试工程师',purpose:'新设备精度校准',date:'2026-10-10',start:'13',end:'15',...override};for(const id of ['applicant','purpose','date'])await p.locator('#'+id).fill(v[id]);for(const id of ['start','end'])await p.locator('#'+id).selectOption(v[id]);}
async function invalid(p,pattern){await p.locator('#to3').click();assert.equal(await p.locator('#step2').isVisible(),true,'invalid input must stay on step2');assert.match(await text(p,'#bookMsg'),pattern);assert.equal(await p.locator('#step3').isVisible(),false);}
register('KC-01',async(p,s)=>{
 await s('初始设备及第1页',async()=>{equal(await text(p,'#statTotal'),'8');equal(await ids(p),['EQ-101','EQ-102','EQ-103']);assert.match(await text(p,'#pageInfo'),/8.*1\/3/);assert.equal(await p.locator('#prev').isDisabled(),true)});
 await s('第2页3条',async()=>{await p.locator('#next').click();equal(await ids(p),['EQ-104','EQ-105','EQ-106'])});
 await s('末页2条及边界',async()=>{await p.locator('#next').click();equal(await ids(p),['EQ-107','EQ-108']);assert.equal(await p.locator('#next').isDisabled(),true)});
});
register('KC-02',async(p,s)=>{
 await s('小写编号模糊搜索',async()=>{await p.locator('#q').fill('eq-10');assert.match(await text(p,'#pageInfo'),/8/)});
 await s('精确缩小到101',async()=>{await p.locator('#q').fill('EQ-106');equal(await ids(p),['EQ-106'])});
 await s('清除搜索恢复总数',async()=>{await p.locator('#q').fill('eq-1');assert.match(await text(p,'#pageInfo'),/8/)});
});
register('KC-03',async(p,s)=>{
 await s('同名搜索',async()=>{await p.locator('#q').fill('温循箱');equal(await ids(p),['EQ-101','EQ-104'])});
 await s('核对站点和状态分别对应',async()=>{assert.match(await row(p,'EQ-101').innerText(),/北站.*空闲/s);assert.match(await row(p,'EQ-104').innerText(),/南站.*使用中/s)});
 await s('编号定位唯一目标',async()=>{await p.locator('#q').fill('');assert.match(await text(p,'#pageInfo'),/8/);assert.match(await text(p,'#selInfo'),/已选 0 项/)});
});
register('KC-04',async(p,s)=>{
 await s('选择北站',async()=>{await chooseSite(p,'北站');equal(await text(p,'#siteBtn'),'北站');equal(await ids(p),['EQ-101','EQ-102','EQ-105'])});
 await s('空闲组合筛选',async()=>{await statuses(p,['空闲']);equal(await ids(p),['EQ-101','EQ-105']);assert.match(await text(p,'#pageInfo'),/2.*1\/1/)});
 await s('在组合结果继续名称搜索',async()=>{await statuses(p,['空闲','维护']);equal(await ids(p),['EQ-101','EQ-102','EQ-105'])});
});
register('KC-05',async(p,s)=>{
 await s('勾选空闲与维护',async()=>{await statuses(p,['空闲','维护']);assert.match(await text(p,'#pageInfo'),/7.*1\/3/)});
 await s('前两页排除使用中',async()=>{equal(await ids(p),['EQ-101','EQ-102','EQ-103']);await p.locator('#next').click();equal(await ids(p),['EQ-105','EQ-106','EQ-107'])});
 await s('末页与筛选标签',async()=>{await p.locator('#next').click();equal(await ids(p),['EQ-108']);assert.equal(await p.locator('#stBusy').isChecked(),false);await statuses(p,['空闲']);assert.match(await text(p,'#pageInfo'),/5.*1\/2/)});
});
register('KC-06',async(p,s)=>{
 await s('无结果',async()=>{await p.locator('#q').fill('EQ-999');equal(await ids(p),[]);assert.equal(await p.getByText('没有匹配设备',{exact:true}).isVisible(),true);assert.equal(await p.locator('#prev').isDisabled(),true);assert.equal(await p.locator('#next').isDisabled(),true)});
 await s('重置恢复8条',async()=>{await p.locator('#resetFilter').click();equal(await p.locator('#q').inputValue(),'');equal(await text(p,'#siteBtn'),'全部');assert.match(await text(p,'#pageInfo'),/8.*1\/3/)});
 await s('重置排序与选择',async()=>{equal(await p.locator('#sort').inputValue(),'id');assert.match(await text(p,'#selInfo'),/已选 0 项/)});
});
register('KC-07',async(p,s)=>{
 await s('费用降序及90/80/70',async()=>{await p.locator('#sort').selectOption('feeDesc');equal(await ids(p),['EQ-104','EQ-101','EQ-108']);equal(await p.locator('#devBody tr td:nth-child(6)').allTextContents(),['90','80','70'])});
 await s('第2页继续降序',async()=>{await p.locator('#next').click();equal(await ids(p),['EQ-105','EQ-102','EQ-107'])});
 await s('切回编号升序',async()=>{await p.locator('#sort').selectOption('id');equal(await ids(p),['EQ-104','EQ-105','EQ-106'])});
});
register('KC-08',async(p,s)=>{
 await s('选择101',async()=>{await row(p,'EQ-101').locator('input').check();assert.match(await text(p,'#selInfo'),/已选 1 项/)});
 await s('下一页选择106',async()=>{await p.locator('#next').click();await row(p,'EQ-106').locator('input').check();assert.match(await text(p,'#selInfo'),/已选 2 项/)});
 await s('返回保持选择',async()=>{await p.locator('#prev').click();assert.equal(await row(p,'EQ-101').locator('input').isChecked(),true);await p.locator('#next').click();assert.equal(await row(p,'EQ-106').locator('input').isChecked(),true);assert.match(await text(p,'#selInfo'),/已选 2 项/)});
});
register('KC-09',async(p,s)=>{
 await s('选择后翻页',async()=>{await row(p,'EQ-101').locator('input').check();await p.locator('#next').click();assert.match(await text(p,'#pageInfo'),/2\//)});
 await s('筛选变更',async()=>{await p.locator('#q').fill('EQ-103');equal(await ids(p),['EQ-103']);assert.match(await text(p,'#selInfo'),/已选 0 项/);assert.match(await text(p,'#pageInfo'),/1\//)});
 await s('搜索清空后改南站',async()=>{await p.locator('#q').fill('');await chooseSite(p,'南站');assert.equal(await p.locator('#batchBook').isDisabled(),true);assert.match(await text(p,'#pageInfo'),/1\//);equal(await ids(p),['EQ-103','EQ-104','EQ-106'])});
});
register('KC-10',async(p,s)=>{
 await s('当前页全选仅101和103',async()=>{await p.locator('#pageAll').check();assert.match(await text(p,'#selInfo'),/已选 2 项/);assert.equal(await row(p,'EQ-102').locator('input').isDisabled(),true)});
 await s('取消全选后单选103',async()=>{await p.locator('#pageAll').uncheck();await row(p,'EQ-103').locator('input').check();assert.match(await text(p,'#selInfo'),/已选 1 项/);assert.equal(await row(p,'EQ-102').locator('input').isChecked(),false)});
 await s('有选择启用清空禁用',async()=>{assert.equal(await p.locator('#batchBook').isEnabled(),true);await row(p,'EQ-103').locator('input').uncheck();assert.equal(await p.locator('#batchBook').isDisabled(),true)});
});
register('KC-11',async(p,s)=>{
 await s('维护102不可预约',async()=>{await row(p,'EQ-102').waitFor();assert.equal(await row(p,'EQ-102').locator('input').isDisabled(),true)});
 await s('同名搜索使用中104禁用',async()=>{await p.locator('#q').fill('温循箱');assert.equal(await row(p,'EQ-104').locator('input').isDisabled(),true);assert.equal(await row(p,'EQ-101').locator('input').isEnabled(),true)});
 await s('全选只包含可预约对象',async()=>{await p.locator('#pageAll').check();assert.equal(await row(p,'EQ-101').locator('input').isChecked(),true);assert.equal(await row(p,'EQ-104').locator('input').isChecked(),false);assert.match(await text(p,'#selInfo'),/已选 1 项/)});
});
register('KC-12',async(p,s)=>{
 await s('同名南站104详情',async()=>{await p.locator('#q').fill('温循箱');await chooseSite(p,'南站');await row(p,'EQ-104').getByRole('button',{name:'详情'}).click();await p.locator('#drawerBox').waitFor({state:'visible'});const t=await text(p,'#drawerBox');assert.match(t,/EQ-104/);assert.match(t,/温循箱/);assert.match(t,/南站/);assert.match(t,/使用中/);assert.match(t,/90/);assert.doesNotMatch(t,/EQ-101/)});
 await s('历史不串同名对象',async()=>{await p.locator('#tabHis').click();await p.getByText('无预约历史',{exact:true}).waitFor();assert.doesNotMatch(await text(p,'#tabPanel'),/R-001/)});
 await s('关闭后筛选页码选择保持',async()=>{await p.locator('#drawerClose').click();equal(await p.locator('#q').inputValue(),'温循箱');equal(await text(p,'#siteBtn'),'南站');equal(await ids(p),['EQ-104']);assert.match(await text(p,'#pageInfo'),/1\/1/);assert.match(await text(p,'#selInfo'),/已选 0 项/)});
});
register('KC-13',async(p,s)=>{
 await s('103预约历史',async()=>{await p.locator('#q').fill('EQ-103');await row(p,'EQ-103').getByRole('button',{name:'详情'}).click();await p.locator('#tabHis').click();await p.locator('#tabPanel').getByText('R-001',{exact:false}).waitFor({timeout:3000});const t=await text(p,'#tabPanel');assert.match(t,/10:00.*12:00/);assert.match(t,/李明.*精度校准/)});
 await s('关闭并查看同名106',async()=>{await p.locator('#drawerClose').click();await p.locator('#q').fill('EQ-106');await row(p,'EQ-106').getByRole('button',{name:'详情'}).click();await p.locator('#tabHis').click();await p.getByText('无预约历史',{exact:true}).waitFor()});
 await s('历史不得串记录',async()=>{assert.doesNotMatch(await text(p,'#tabPanel'),/R-001/);assert.match(await text(p,'#drawerTitle'),/EQ-106/);equal(await text(p,'#statConf'),'1');equal(await text(p,'#statFee'),'40')});
});
register('KC-14',async(p,s)=>{
 await s('无选择禁用',async()=>{assert.equal(await p.locator('#batchBook').isDisabled(),true)});
 await s('选中后可预约',async()=>{await row(p,'EQ-101').locator('input').check();assert.equal(await p.locator('#batchBook').isEnabled(),true)});
 await s('取消选择恢复禁用',async()=>{await row(p,'EQ-101').locator('input').uncheck();assert.equal(await p.locator('#batchBook').isDisabled(),true)});
});
register('KC-15',async(p,s)=>{
 await s('选择101进入时间用途',async()=>{await findSelect(p,'EQ-101');await p.locator('#batchBook').click();assert.match(await text(p,'#selList'),/EQ-101/);await p.locator('#to2').click()});
 await s('填写指定输入',async()=>{await form(p,{applicant:'王五',purpose:'高温老化验证',date:'2026-10-11'});equal(await text(p,'#bookMsg'),'')});
 await s('回退资源再进入保留全部输入',async()=>{await p.locator('#back1').click();await p.locator('#to2').click();for(const [k,v] of Object.entries({applicant:'王五',purpose:'高温老化验证',date:'2026-10-11',start:'13',end:'15'}))equal(await p.locator('#'+k).inputValue(),v)});
});
register('KC-16',async(p,s)=>{
 await s('申请人空白拒绝',async()=>{await begin(p);await form(p,{applicant:'   ',purpose:'可靠性摸底测试'});await invalid(p,/申请人.*2.*20/)});
 await s('一字拒绝',async()=>{await p.locator('#applicant').fill('李');await invalid(p,/申请人/)});
 await s('李四允许且回退保留',async()=>{await p.locator('#applicant').fill('李四');await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true);await p.locator('#back2').click();equal(await p.locator('#applicant').inputValue(),'李四')});
});
register('KC-17',async(p,s)=>{
 await s('用途空白拒绝',async()=>{await begin(p);await form(p,{applicant:'张三',purpose:'校准'});await invalid(p,/用途.*5.*100/)});
 await s('四字用途拒绝',async()=>{await p.locator('#purpose').fill('  设备校准  ');await invalid(p,/用途/)});
 await s('五字用途允许',async()=>{await p.locator('#purpose').fill('功能联调验证');await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true);assert.match(await text(p,'#confirmBox'),/功能联调验证/);await p.locator('#back2').click();equal(await p.locator('#purpose').inputValue(),'功能联调验证')});
});
register('KC-18',async(p,s)=>{
 await s('日期下界外拒绝',async()=>{await begin(p);await form(p,{applicant:'张三',purpose:'稳定性验证',date:'2026-10-09'});await invalid(p,/日期/)});
 await s('日期上界外拒绝',async()=>{await p.locator('#date').fill('2026-10-21');await invalid(p,/日期/)});
 await s('日期上界允许',async()=>{await p.locator('#date').fill('2026-10-20');await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true);assert.match(await text(p,'#confirmBox'),/2026-10-20/)});
});
register('KC-19',async(p,s)=>{
 await s('起止相同拒绝',async()=>{await begin(p);await form(p,{start:'10',end:'10'});await invalid(p,/结束.*晚于/)});
 await s('结束早于开始拒绝',async()=>{await p.locator('#start').selectOption('14');await p.locator('#end').selectOption('12');await invalid(p,/结束.*晚于/)});
 await s('正确时段可继续',async()=>{await p.locator('#start').selectOption('12');await p.locator('#end').selectOption('14');await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true);assert.match(await text(p,'#confirmBox'),/160元/)});
});
register('KC-20',async(p,s)=>{
 await s('五小时拒绝',async()=>{await begin(p,'EQ-105');await form(p,{start:'8',end:'13'});await invalid(p,/时长.*1.*4/)});
 await s('四小时边界允许',async()=>{await p.locator('#end').selectOption('12');await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true);assert.match(await text(p,'#confirmBox'),/240元/)});
 await s('晚间18点边界',async()=>{await p.locator('#back2').click();await form(p,{start:'17',end:'18'});await p.locator('#to3').click();assert.match(await text(p,'#confirmBox'),/17:00-18:00/)});
});
register('KC-21',async(p,s)=>{
 await s('选103并填写重叠时段',async()=>{await begin(p,'EQ-103');await form(p,{applicant:'赵六',purpose:'复测验证',start:'11',end:'13'})});
 await s('真实冲突提示且不进入确认',async()=>{await invalid(p,/EQ-103.*R-001.*冲突/)});
 await s('09点到10点不重叠允许',async()=>{await p.locator('#start').selectOption('9');await p.locator('#end').selectOption('10');await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true)});
});
register('KC-22',async(p,s)=>{
 await s('紧接边界允许及40元',async()=>{await begin(p,'EQ-103');await form(p,{applicant:'钱七',purpose:'边界回归验证',start:'12',end:'14'});await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true);assert.match(await text(p,'#confirmBox'),/EQ-103/);assert.match(await text(p,'#confirmBox'),/总价：.*40元/)});
 await s('创建记录',async()=>{await p.locator('#confirmBook').click();equal(await p.locator('#recBody tr').count(),2);assert.match(await rec(p,'R-002').innerText(),/EQ-103.*12:00.*14:00.*40元.*已确认/s);equal(await text(p,'#statConf'),'2')});
 await s('刷新仍保留且详情正确',async()=>{await p.reload();await p.locator('#navRec').click();equal(await p.locator('#recBody tr').count(),2);equal(await text(p,'#statConf'),'2');equal(await text(p,'#statFee'),'80');await rec(p,'R-002').getByRole('button',{name:'详情',exact:true}).click();await p.locator('#tabPanel').getByText('R-002',{exact:false}).waitFor();assert.match(await text(p,'#tabPanel'),/EQ-103.*12:00.*14:00/s)});
});
register('KC-23',async(p,s)=>{
 await s('跨页选101和105',async()=>{await statuses(p,['空闲','使用中','维护']);await row(p,'EQ-101').locator('input').check();await p.locator('#next').click();await row(p,'EQ-105').locator('input').check();await p.locator('#batchBook').click();await p.locator('#to2').click();await form(p,{applicant:'孙八',purpose:'联合压力测试',date:'2026-10-12'});await p.locator('#to3').click();const t=await text(p,'#confirmBox');assert.match(t,/EQ-101/);assert.match(t,/EQ-105/);assert.match(t,/总价：.*280元/)});
 await s('真实鼠标快速双击确认',async()=>{const b=await p.locator('#confirmBook').boundingBox();await p.mouse.dblclick(b.x+b.width/2,b.y+b.height/2,{delay:35});await p.locator('#recView').waitFor({state:'visible'});equal(await p.locator('#recBody tr').count(),2,'one submission must create one new booking record, seed plus new = 2')});
 await s('记录标识唯一且总价未重复累计',async()=>{const r=await rec(p,'R-002').innerText();assert.match(r,/EQ-101/);assert.match(r,/EQ-105/);assert.match(r,/280元/);equal(await text(p,'#statConf'),'2');equal(await text(p,'#statFee'),'320')});
});
register('KC-24',async(p,s)=>{
 await s('取消确认选择放弃',async()=>{await p.locator('#navRec').click();p.once('dialog',d=>d.dismiss());await rec(p,'R-001').getByRole('button',{name:'取消预约'}).click();assert.match(await rec(p,'R-001').innerText(),/已确认/);equal(await text(p,'#statConf'),'1')});
 await s('确认取消保留价格并禁用',async()=>{p.once('dialog',d=>d.accept());await rec(p,'R-001').getByRole('button',{name:'取消预约'}).click();assert.match(await rec(p,'R-001').innerText(),/40元.*已取消/s);assert.equal(await rec(p,'R-001').getByRole('button',{name:'取消预约'}).isDisabled(),true);equal(await text(p,'#statConf'),'0');equal(await text(p,'#statFee'),'0')});
 await s('释放原时段再预约',async()=>{await p.locator('#navDev').click();await begin(p,'EQ-103');await form(p,{start:'10',end:'12'});await p.locator('#to3').click();assert.equal(await p.locator('#step3').isVisible(),true);await p.locator('#confirmBook').click();assert.match(await rec(p,'R-002').innerText(),/10:00.*12:00.*已确认/s);equal(await text(p,'#statConf'),'1');await p.reload();await p.locator('#navRec').click();assert.match(await rec(p,'R-001').innerText(),/已取消/);assert.match(await rec(p,'R-002').innerText(),/已确认/)});
});
for(const {id,fn} of checks){
 const c=cases.find(c=>c.id===id);assert.ok(c,`missing Kimi case ${id}`);
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:path.join(media,id),size:{width:1440,height:1000}}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===site.url?route.continue():route.abort());
 await context.tracing.start({screenshots:true,snapshots:true,sources:false});
 const page=await context.newPage();page.setDefaultTimeout(3500);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result={id,title:c.title,status:'RUNNING',steps:[],page_errors:errors,started_at:new Date().toISOString()};const beginTime=Date.now();let n=0;
 const step=async(name,action)=>{const r={number:++n,name,status:'RUNNING'};result.steps.push(r);try{await action();r.status='PASSED'}catch(e){r.status='FAILED';r.error=e.message;throw e}finally{const file=`${id}-step${n}.png`;await page.screenshot({path:path.join(out,file),fullPage:true}).catch(()=>{});r.screenshot=file;}};
 try{await page.goto(site.url);page.once('dialog',d=>d.accept());await page.locator('#resetDemo').click();await fn(page,step);assert.equal(errors.length,0,'browser page errors');result.status='PASSED';}
 catch(e){result.status='FAILED';result.error={name:e.name,message:e.message,expected:e.expected,actual:e.actual};}
 result.elapsed_ms=Date.now()-beginTime;result.unexecuted_checkpoints=Math.max(0,3-result.steps.length);
 await context.tracing.stop({path:path.join(media,id,'trace.zip')});const video=page.video();await context.close();result.video=path.relative(here,await video.path()).replaceAll('\\','/');result.trace=path.relative(here,path.join(media,id,'trace.zip')).replaceAll('\\','/');
 results.push(result);console.log(`${id} ${result.status} ${result.elapsed_ms}ms ${result.error?.message?.split('\n')[0]||''}`);
 await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
}
await browser.close();await site.close();
const hash=async file=>createHash('sha256').update(await readFile(path.join(here,file))).digest('hex').toUpperCase();
const summary={run:stamp,tested_files:await Promise.all(['index.html','cases.json','SPEC.md','verify.mjs','server.mjs'].map(async file=>({file,sha256:await hash(file)}))),browser:'actual Chromium through Playwright',author:'Kimi page and human cases; Codex independent test implementation',total:results.length,passed:results.filter(x=>x.status==='PASSED').length,failed:results.filter(x=>x.status==='FAILED').length,model_calls_in_browser_test:0,results:'results.json',media_local_only:path.relative(here,media).replaceAll('\\','/')};
await writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));process.exitCode=summary.failed?1:0;
