import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../node_modules/playwright/index.mjs';
const dir=new URL('./',import.meta.url),sut='http://127.0.0.1:4460',wb='http://127.0.0.1:4322';
const expected=JSON.parse(await fs.readFile(new URL('fixture-expectations.json',dir),'utf8'));
const state=JSON.parse(await fs.readFile(new URL('project-state.json',dir),'utf8'));
const baseline=expected.baseline,checks=[],namespaces=new Set(),browserErrors=[];
const result={scope:'Preparation and synthetic target verification, not Test Agent generation/execution acceptance',at:new Date().toISOString(),checks,browserErrors,workbench_model_requests:0,workbench_business_executions:0};
const uiOnly=process.argv.includes('--ui-only'), targetOnly=process.argv.includes('--target-only');
if(uiOnly){const previous=JSON.parse(await fs.readFile(new URL('verification.json',dir),'utf8'));checks.push(...previous.checks.filter(c=>c.name.startsWith('API-')||c.name.startsWith('Fixture isolation')));result.api_evidence_from=previous.at;}
const save=(name,value)=>fs.writeFile(new URL(name,dir),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
const check=(name,details)=>{checks.push({name,status:'EXECUTED_EXPECTED',details});console.log(name);};
async function http(path,method='GET',body,role='editor') {
  const r=await fetch(sut+path,{method,headers:{'x-synthetic-role':role,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  return {status:r.status,data:await r.json()};
}
const id=kind=>`verify-${kind}-${randomUUID().slice(0,16)}`;
const root=run=>`/api/v1/namespaces/${run}/orders`;
async function setup(run){namespaces.add(run);const r=await http('/__control/namespaces','POST',{runId:run});assert.equal(r.status,201);assert.equal(r.data.created,true);}
async function cleanup(run){const r=await http('/__control/namespaces/'+run,'DELETE');assert.equal(r.status,200);assert.equal(r.data.deleted,true);assert.equal((await http(root(run))).data.error.code,'NAMESPACE_NOT_FOUND');namespaces.delete(run);}
function finalRows(n){
  const rows=structuredClone(baseline);
  if(n===1)rows.push({...expected.create,status:'PENDING'});
  if(n===5)rows[0].status='DONE';
  return rows;
}
let browser;
try {
  if(!uiOnly) for(let n=1;n<=6;n++) {
    const run=id('api'+n);await setup(run);
    try {
      const before=await http(root(run));assert.deepEqual(before.data.items,baseline);assert.equal(before.data.total,3);
      let r;
      if(n<=3)r=await http(root(run),'POST',n===1?expected.create:n===2?expected.duplicate:expected.viewer,n===3?'viewer':'editor');
      if(n===4)r=await http(root(run)+'?station=EAST&status=PENDING');
      if(n>=5)r=await http(root(run)+'/'+(n===5?'WO-1001':'WO-1003')+'/complete','POST');
      assert.equal(r.status,[201,409,403,200,200,409][n-1]);
      if([2,3,6].includes(n)){assert.equal(r.data.error.code,{2:'DUPLICATE_CODE',3:'FORBIDDEN',6:'ALREADY_COMPLETED'}[n]);assert(r.data.error.message.trim());}
      if(n===1){assert.equal(r.data.created,true);assert.deepEqual(r.data.item,{...expected.create,status:'PENDING'});const again=await http('/__control/namespaces','POST',{runId:run});assert.equal(again.status,200);assert.equal(again.data.created,false);}
      if(n===4){assert.equal(r.data.total,1);assert.deepEqual(r.data.items,[baseline[0]]);}
      if(n===5){assert.equal(r.data.updated,true);assert.deepEqual(r.data.item,{...baseline[0],status:'DONE'});}
      const after=await http(root(run));assert.deepEqual(after.data.items,finalRows(n));assert.equal(after.data.total,finalRows(n).length);
      check('API-WO-0'+n,{status:r.status,whole_list_verified:true});
    } finally {await cleanup(run);}
  }
  // Distinct writes sent together must both remain present; setup must not resurrect deleted data.
  if(!uiOnly){const concurrency=id('concurrent');await setup(concurrency);
  try {
    const requests=['WO-3001','WO-3002'].map(code=>http(root(concurrency),'POST',{...expected.create,code}));
    assert.deepEqual((await Promise.all(requests)).map(r=>r.status),[201,201]);
    const rows=(await http(root(concurrency))).data.items;assert.equal(rows.length,5);assert(rows.some(r=>r.code==='WO-3001')&&rows.some(r=>r.code==='WO-3002'));
    const invalid=await http(root(concurrency),'POST',{...expected.create,code:['WO-4001']});assert.equal(invalid.status,400);assert.equal((await http(root(concurrency))).data.total,5);
    check('Fixture isolation and concurrent persistence',{concurrent_created:2,invalid_type_rejected:true});
  } finally {await cleanup(concurrency);}}
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>browserErrors.push(e.message));
  const labels={EAST:'东站（EAST）',WEST:'西站（WEST）',HIGH:'高（HIGH）',NORMAL:'普通（NORMAL）',PENDING:'待处理（PENDING）',DONE:'已完成（DONE）'};
  async function rowsEqual(rows) {
    await page.waitForFunction(count=>document.querySelector('#count')?.textContent==='工单总数：'+count,rows.length);
    const cells=await page.locator('#orders tr').evaluateAll(rows=>rows.map(row=>[...row.cells].slice(0,5).map(cell=>cell.textContent)));
    assert.deepEqual(cells,rows.map(row=>['code','title','station','priority','status'].map(key=>labels[row[key]]||row[key])));
  }
  async function clickWait(locator,path,method='GET') {
    const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()===method),locator.click()]);return response;
  }
  for(let n=1;n<=6;n++) {
    const run=id('ui'+n);namespaces.add(run);await page.goto(sut+'/inspection/');
    await page.getByLabel('运行编号',{exact:true}).fill(run);await page.getByRole('combobox',{name:'公开角色',exact:true}).selectOption(n===3?'viewer':'editor');
    await clickWait(page.getByRole('button',{name:'初始化本次数据',exact:true}),'/__control/namespaces','POST');
    await rowsEqual(baseline);
    let response;
    if(n<=3) {
      const data=n===1?expected.create:n===2?expected.duplicate:expected.viewer;
      await page.getByLabel('工单编号',{exact:true}).fill(data.code);await page.getByLabel('工单标题',{exact:true}).fill(data.title);
      await page.getByRole('combobox',{name:'所属站点',exact:true}).selectOption(data.station);await page.getByRole('combobox',{name:'优先级',exact:true}).selectOption(data.priority);
      response=await clickWait(page.getByRole('button',{name:'新增工单',exact:true}),root(run),'POST');
    } else if(n===4) {
      await page.getByRole('combobox',{name:'筛选站点',exact:true}).selectOption('EAST');await page.getByRole('combobox',{name:'筛选状态',exact:true}).selectOption('PENDING');
      response=await clickWait(page.getByRole('button',{name:'查询',exact:true}),root(run));await rowsEqual([baseline[0]]);
    } else {
      const code=n===5?'WO-1001':'WO-1003';response=await clickWait(page.getByRole('button',{name:'完成工单 '+code,exact:true}),root(run)+'/'+code+'/complete','POST');
    }
    assert.equal(response.status(),[201,409,403,200,200,409][n-1]);
    await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent&&!document.querySelector('#feedback').textContent.includes('已初始化'));
    const feedback=await page.locator('#feedback').innerText();
    if([2,3,6].includes(n)){assert.match(await page.locator('#feedback').getAttribute('class'),/error/);assert(feedback.trim());}
    await page.getByLabel('查询编号',{exact:true}).fill('');await page.getByRole('combobox',{name:'筛选站点',exact:true}).selectOption('');await page.getByRole('combobox',{name:'筛选状态',exact:true}).selectOption('');
    await clickWait(page.getByRole('button',{name:'查询',exact:true}),root(run));await rowsEqual(finalRows(n));
    await clickWait(page.getByRole('button',{name:'刷新列表',exact:true}),root(run));await rowsEqual(finalRows(n));
    if(n===1){await page.screenshot({path:fileURLToPath(new URL('target-ready.png',dir)),fullPage:true});}
    await clickWait(page.getByRole('button',{name:'清理本次数据',exact:true}),'/__control/namespaces/'+run,'DELETE');
    await page.waitForFunction(()=>document.querySelector('#count').textContent==='工单总数：0');
    assert.equal((await http(root(run))).data.error.code,'NAMESPACE_NOT_FOUND');namespaces.delete(run);
    check('UI-WO-0'+n,{status:response.status(),feedback,whole_table_verified:true,cleanup_verified:true});
  }
  if(!targetOnly){
  // The official workbench is read/preflight only. Block model generation and execution routes in this QA browser.
  await page.route(wb+'/**',route=>{
    const r=route.request(),url=new URL(r.url());
    if(!['GET','HEAD'].includes(r.method())&&!url.pathname.endsWith('/preflight'))return route.abort();
    return route.continue();
  });
  await page.goto(state.entry);await page.getByRole('tab',{name:/前端测试/}).click();
  await page.waitForFunction(()=>document.querySelector('#pw-ui-readiness')?.textContent.includes('6 条待生成'));
  assert.equal(await page.locator('#pw-generate-ui').isEnabled(),true);assert.equal(await page.locator('#pw-ui-readiness tr .badge').allTextContents().then(xs=>xs.filter(x=>x==='可以生成').length),6);
  await page.screenshot({path:fileURLToPath(new URL('workbench-frontend-ready.png',dir)),fullPage:true});
  await save('workbench-frontend-ready.txt',await page.locator('body').innerText());
  await page.getByRole('tab',{name:/后端测试/}).click();
  await page.waitForFunction(()=>document.querySelector('#pw-generate-backend')?.disabled===false);
  assert.equal(await page.locator('#pw-backend-preparation tbody tr').count(),6);
  assert.equal(await page.locator('#pw-backend-preparation tbody tr').allTextContents().then(xs=>xs.filter(x=>x.includes('可生成')).length),6);
  await page.screenshot({path:fileURLToPath(new URL('workbench-backend-ready.png',dir)),fullPage:true});
  await save('workbench-backend-ready.txt',await page.locator('body').innerText());
  check('Official 4322 user entry',{frontend_can_generate:6,backend_can_generate:6,protocol_imported:true});
  const prefix=wb+'/api/case-library/projects/'+state.project_id;
  for(const [suffix,key]of[['/execution-records','records'],['/script-operations','operations'],['/backend','plans'],['/backend/generation-batches','batches'],['/requirements/designs','designs']])assert.equal((await fetch(prefix+suffix).then(r=>r.json()))[key].length,0);
  const before=JSON.parse(await fs.readFile(new URL('old-projects-before.json',dir),'utf8'));
  for(const p of before){const value=await fetch(wb+'/api/case-library/projects/'+p.project_id).then(r=>r.json());assert.equal(createHash('sha256').update(JSON.stringify(value)).digest('hex'),p.sha256);}
  assert.equal(browserErrors.length,0);assert.equal(namespaces.size,0);assert.deepEqual((await http('/__control/baseline')).data.items,baseline);
  check('User handoff remains fresh',{old_projects_unchanged:before.length,generated_scripts:0,execution_records:0,verification_namespaces_remaining:0});
  }
  assert.equal(browserErrors.length,0);assert.equal(namespaces.size,0);assert.deepEqual((await http('/__control/baseline')).data.items,baseline);
  result.status='PREPARATION_VERIFIED';
} catch(e) {result.status='PREPARATION_FAILED';result.error=e.stack;throw e;}
finally {for(const run of namespaces)await http('/__control/namespaces/'+run,'DELETE').catch(()=>{});await browser?.close();await save('verification.json',result);}
