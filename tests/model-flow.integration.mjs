import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {DeepSeek} from '../src/deepseek.mjs';
import {demoCases,startDemo} from '../src/demo.mjs';
import {start} from '../src/server.mjs';
import {INPUT_REVIEW_PROMPT} from '../src/input-review.mjs';
import {PLAN_AUDIT_PROMPT} from '../src/plan-quality.mjs';
import {PLAN_PROMPT,REVIEW_PROMPT,planHash} from '../src/plans.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(ROOT,'validation','model-flow-'+Date.now());await fs.mkdir(dir,{recursive:true});
const fixture=demoCases();let calls=0;const phases=[];const provider=new DeepSeek({key:'',fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.headers.Authorization,'Bearer fixture-secret-local-only');calls++;
  const request=JSON.parse(options.body),input=JSON.parse(request.messages[1].content);let value;
  if(input.purpose==='case_ui_discovery'){phases.push('discovery');assert.ok(input.current.controls.some(c=>c.locator?.value==='product-search'));value={done:true,reason:'商品名称、查询按钮及结果区域已采集。'};}else if(input.purpose){phases.push('connection');value={connected:true};}
  else if(request.messages[0].content.startsWith(INPUT_REVIEW_PROMPT+'\n')){phases.push('input_review');assert.equal(input.effective.case_id,'CATALOG-001');assert.deepEqual(input.effective.steps,fixture.baseline.cases[0].steps.map(({requires_click,...step})=>step));assert.ok(!Object.hasOwn(input,'pages'));value={issues:[]};}
  else if(request.messages[0].content.startsWith(PLAN_AUDIT_PROMPT+'\n')){
    phases.push('plan_audit');const candidate=input.candidate_plan;assert.equal(input.plan_hash,planHash(candidate));assert.deepEqual(candidate.steps[0].assertions,fixture.plans[0].steps[0].assertions);
    value={checks:input.original.steps.flatMap(step=>step.obligations.map(obligation=>{const assertions=candidate.steps.find(s=>s.step_id===step.step_id).assertions,indices=assertions.flatMap((a,i)=>a.obligation_ids.includes(obligation.id)?[i]:[]);assert.ok(indices.length);return {step_id:step.step_id,obligation_id:obligation.id,status:'COVERED',assertion_indices:indices,reason:'合成审查：商品名称及结果数量与该条已确认预期一致。'};})),issues:[]};
  }else if(input.case){assert.ok(request.messages[0].content.startsWith(REVIEW_PROMPT+'\n'));phases.push('review');value={issues:[]};}else {
    assert.ok(request.messages[0].content.startsWith(PLAN_PROMPT+'\n'));phases.push('plan');
    assert.ok(input.pages[0].controls.length>0);const plan=structuredClone(fixture.plans[0]);plan.case_id=input.original.case_id;plan.case_hash=input.case_hash;value={plan};
  }
  return new Response(JSON.stringify({model:'fixture-deepseek-json',usage:{prompt_tokens:10,completion_tokens:5},choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}),{status:200});
}});
const app=await start({port:0,dataDir:path.join(dir,'data'),headless:true,provider}),demo=await startDemo();const b=await chromium.launch({headless:true}),page=await b.newPage({viewport:{width:1536,height:1050}});
try{
  await page.goto(app.url);await page.getByRole('button',{name:'DeepSeek 连接设置'}).click();await page.locator('#key').fill('fixture-secret-local-only');await page.getByRole('button',{name:'测试连接',exact:true}).click();await page.getByText(/实际连接成功 · 返回模型 fixture-deepseek-json/).waitFor();assert.equal(await page.locator('#key').inputValue(),'');await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await page.getByRole('button',{name:'＋ 导入测试用例'}).click();await page.locator('#task-name').fill('导入与模型协议联调（模拟回复）');await page.locator('#target').fill(demo.url+'/catalog');await page.locator('#case-file').setInputFiles({name:'cases.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...fixture.baseline,case_count:1,cases:[fixture.baseline.cases[0]]}))});await page.locator('#nonproduction').check();await page.getByRole('button',{name:'导入并检查'}).click();await page.getByRole('heading',{name:'导入与模型协议联调（模拟回复）',exact:true}).waitFor();
  const id=(await app.store.list())[0].id;await page.getByRole('checkbox',{name:'选择全部用例'}).check();await page.getByRole('button',{name:'审查所选用例'}).click();await page.waitForFunction(()=>document.querySelector('.events')?.textContent.includes('用例文本审查结束'));
  await page.getByRole('button',{name:'确认所选原文'}).click();await page.getByRole('button',{name:'以上用例原文已核对'}).click();await page.getByText('待生成计划',{exact:true}).waitFor();
  await page.getByRole('button',{name:'打开浏览器',exact:true}).click();await page.getByText('浏览器已打开',{exact:true}).waitFor();await app.browser.loginPage.getByRole('button',{name:'进入演示'}).click();await page.getByRole('button',{name:'确认登录状态',exact:true}).click();await page.locator('#marker').selectOption({label:'演示用户 · strong'});await page.locator('#save-marker').click();await page.getByText('登录可复用',{exact:true}).waitFor();
  await page.getByText('待确认计划',{exact:true}).waitFor();await page.getByRole('button',{name:'核对所选计划'}).click();await page.getByRole('button',{name:'以上操作、断言和清理已核对'}).click();await page.locator('td .badge').filter({hasText:'可执行'}).waitFor();await page.getByRole('button',{name:'执行所选',exact:true}).click();await page.locator('td .badge.good').waitFor();
  const s=await app.store.read(id);assert.equal(s.cases[0].status,'PASS_ASSERTIONS');assert.equal(calls,6);assert.deepEqual(phases,['connection','review','discovery','input_review','plan','plan_audit']);assert.equal(s.events.filter(e=>e.type==='MODEL_RESPONSE').length,5);assert.equal(s.cases[0].self_repair.repair_count,0);assert.equal(s.cases[0].plan_audit.plan_hash,planHash(s.cases[0].plan));assert.equal(s.cases[0].plan_audit.issues.length,0);assert.equal(s.cases[0].confirmations[0].source,'LOCAL_OPERATOR');assert.equal(s.discovery.status,'CAPTURED');assert.ok(s.events.some(e=>e.type==='DISCOVERY_PAGE_CAPTURED'));
  assert.ok(!(await fs.readFile(path.join(app.store.dir(id),'state.json'),'utf8')).includes('fixture-secret-local-only'));
  await page.screenshot({path:path.join(dir,'imported-model-flow.png'),fullPage:true});await fs.writeFile(path.join(dir,'summary.json'),JSON.stringify({scope:'DeepSeek HTTP adapter uses injected synthetic replies; real browser, uploaded case, UI review/confirmation/planning/approval/execution. NOT live DeepSeek.',task_id:id,model_calls:calls,case_status:s.cases[0].status,key_absent_from_task_file:true},null,2));process.stdout.write(JSON.stringify({validated:true,directory:dir,model_calls:calls})+'\n');
}finally{await b.close();await app.close();await demo.close();}
