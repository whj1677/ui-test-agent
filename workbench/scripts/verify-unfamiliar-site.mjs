// Maintainer reference checks for the frozen synthetic site; never a product candidate/input.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium,expect } from '@playwright/test';
import { startUnfamiliarSite,siteRoot } from './unfamiliar-site-server.mjs';
import { digest } from '../server/build/development-session.mjs';
const output=path.resolve('workbench/qa/20260925-unfamiliar/reference');await fs.mkdir(output,{recursive:true});
const site=await startUnfamiliarSite();const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});const results=[];
try{for(const flow of ['a','b'])for(const variant of ['normal','fault']){
 const page=await browser.newPage();let step=0;const completed=[];let error=null;
 const field=label=>page.getByRole('tabpanel').locator('dt').filter({hasText:new RegExp('^'+label+'$')}).locator('xpath=following-sibling::dd[1]');
 const run=async(n,fn)=>{step=n;await fn();completed.push(n);};
 try{
 await run(1,async()=>{await page.goto(`${site.base}/index.html?flow=${flow}&variant=${variant}`);if(flow==='a'){await expect(page.getByRole('status')).toHaveText('3条记录');await expect(page.getByRole('combobox',{name:'区域',exact:true})).toHaveText('全部区域');await expect(page.getByLabel('状态',{exact:true})).toHaveValue('全部状态');await expect(page.getByLabel('设备关键字')).toHaveValue('');await expect(page.locator('tbody tr td:first-child')).toHaveText(['P-101','P-102','P-203']);}else{await expect(page.getByLabel('工单名称')).toHaveValue('');await expect(page.locator('tbody tr td:first-child')).toHaveText(['WO-201','WO-202','WO-203']);await expect(page.getByRole('status')).toHaveText('3条工单');}});
 if(flow==='a'){
 await run(2,async()=>{await page.getByRole('combobox',{name:'区域',exact:true}).click();await page.getByRole('option',{name:'南区',exact:true}).click();await expect(page.getByRole('combobox',{name:'区域',exact:true})).toHaveText('南区');await expect(page.getByRole('status')).toHaveText('1条记录');await expect(page.locator('tbody td')).toHaveText(['P-203','南站泵组','南区','启用']);});
 await run(3,async()=>{await page.getByLabel('状态',{exact:true}).selectOption({label:'停用'});await expect(page.getByRole('status')).toHaveText('0条记录');await expect(page.getByText('没有符合条件的设备')).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(0);});
 await run(4,async()=>{await page.getByRole('button',{name:'重置',exact:true}).click();await expect(page.getByRole('combobox',{name:'区域',exact:true})).toHaveText('全部区域');await expect(page.getByLabel('状态',{exact:true})).toHaveValue('全部状态');await expect(page.getByLabel('设备关键字')).toHaveValue('');await expect(page.getByText('没有符合条件的设备')).toBeHidden();await expect(page.getByRole('status')).toHaveText('3条记录',{timeout:1000});await expect(page.locator('tbody tr td:first-child')).toHaveText(['P-101','P-102','P-203']);});
 await run(5,async()=>{await page.getByLabel('设备关键字').fill('P-102');await page.getByRole('button',{name:'查询',exact:true}).click();await expect(page.getByRole('status')).toHaveText('1条记录');await expect(page.locator('tbody td')).toHaveText(['P-102','北站备用泵','北区','停用']);});
 }else{
 await run(2,async()=>{await page.getByLabel('工单名称').fill('巡检任务');await page.getByRole('button',{name:'筛选',exact:true}).click();await expect(page.getByRole('status')).toHaveText('2条工单');await expect(page.locator('tbody tr td:nth-child(1)')).toHaveText(['WO-201','WO-202']);await expect(page.locator('tbody tr td:nth-child(2)')).toHaveText(['巡检任务','巡检任务']);await expect(page.locator('tbody tr td:nth-child(3)')).toHaveText(['北区','南区']);await expect(page.locator('tbody tr td:nth-child(4)')).toHaveText(['林工','林工']);});
 await run(3,async()=>{await page.getByRole('row').filter({has:page.getByRole('cell',{name:'WO-202',exact:true})}).getByRole('button',{name:'查看详情'}).click();await expect(page.getByRole('tab',{name:'基本信息'})).toHaveAttribute('aria-selected','true');await expect(field('工单编号')).toHaveText('WO-202',{timeout:1000});for(const [k,v]of Object.entries({'名称':'巡检任务','区域':'南区','负责人':'林工','优先级':'高'}))await expect(field(k)).toHaveText(v);});
 await run(4,async()=>{await page.getByRole('tab',{name:'处理记录'}).click();await expect(page.getByRole('tab',{name:'处理记录'})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('tab',{name:'基本信息'})).toHaveAttribute('aria-selected','false');for(const[k,v]of Object.entries({'工单编号':'WO-202','最近处理人':'赵工','处理结果':'等待备件'}))await expect(field(k)).toHaveText(v);});
 await run(5,async()=>{await page.getByRole('button',{name:'返回列表'}).click();await expect(page.getByLabel('工单名称')).toHaveValue('巡检任务');await expect(page.getByRole('status')).toHaveText('2条工单');await expect(page.locator('tbody tr td:first-child')).toHaveText(['WO-201','WO-202']);await expect(page.locator('tbody tr td:nth-child(3)')).toHaveText(['北区','南区']);await expect(page.locator('tbody tr td:nth-child(4)')).toHaveText(['林工','林工']);});
 }
 }catch(e){error=e.message;}
 await page.screenshot({path:path.join(output,`${flow}-${variant}.png`)});results.push({flow,variant,business_result:error?'FAILED':'PASSED',completed,failed_step:error?step:null,error});await page.close();
 }
 if(results.some(r=>r.variant==='normal'?r.business_result!=='PASSED':r.failed_step!==(r.flow==='a'?4:3)))throw new Error('REFERENCE_ACCEPTANCE_FAILED');
 const files=[];for(const name of ['index.html','app.js','data.json','cases.workbench.json'])files.push({name,sha256:digest(await fs.readFile(path.join(siteRoot,name)))});
 await fs.writeFile(path.join(siteRoot,'freeze.json'),JSON.stringify({files,accepted_at:new Date().toISOString(),faults:{a:'重置控件清空，但结果仍按重置前区域过滤；第4步数量错误',b:'详情按同名第一条取值而非所选编号；第3步工单编号错误'},reference:'../reference/results.json',product_candidate:false},null,2));
 console.log(JSON.stringify(results.map(({error,...r})=>r)));
}finally{await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));await browser.close();await site.close();}
