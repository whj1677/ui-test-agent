import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { chromium } from '@playwright/test';
import { uploadCaseFile } from '../web-v2/api.js';

// Exercise the real import renderer and handlers offline; no workbench or HTTP target is started.
const app = await fs.readFile(new URL('../web-v2/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const mappingLabels ='), app.indexOf('function fmtDate(')) +
  app.slice(app.indexOf('function short('), app.indexOf('function currentContent(')) +
  app.slice(app.indexOf('function draftFor('), app.indexOf('function resolveCaseVersion('));
function view() {
  const nodes = new Map(), requests = [], pages = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { dataset:{}, value:'', open:false, disabled:false, innerHTML:'',
      addEventListener(name, listener) { this[name] = listener; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ state:{importDrafts:new Map()}, encodeURIComponent,
    setBreadcrumb(){}, projectTabs(){return '';}, showPage(html){pages.push(html);}, toast(){}, messageFor:error=>error.message,
    document:{querySelector:node,querySelectorAll:()=>[]},
    jsonOptions:body=>({method:'POST',body:JSON.stringify(body)}),
    mutate:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return {preview_id:'preview-offline'};},
  });
  vm.runInContext(source, context);
  return {context,node,nodes,requests,pages};
}
function draft(overrides = {}) {
  return {upload:{upload_id:'upload-offline',source_type:'csv',file_name:'电价管理.csv',bytes:1234,sha256:'abc',
    workbook:{sheets:[{name:'电价管理',row_count:77,headers:['用例ID','用例名称','操作步骤','预期结果','实际结果'],
      suggested_mapping:{external_id:'用例ID',title:'用例名称',steps:'操作步骤',expected:'预期结果'},mapping_issues:[],...overrides}]}},
    preview:null,result:null};
}

test('file selection accepts CSV and links the fixed Excel template without confirming anything', () => {
  const {context,pages,requests}=view();
  context.renderImport({project_id:'p',name:'离线项目'});
  assert.match(pages.at(-1), /accept="\.csv,\.xlsx,\.json"/);
  assert.match(pages.at(-1), /href="\/workspace\/test-case-template\.xlsx" download="测试用例模板\.xlsx"/);
  assert.match(pages.at(-1), /上传后先预览，再确认导入/);
  assert.deepEqual(requests, []);
});

test('complete backend suggestions default to a closed mapping panel and never use historical results', () => {
  const {context}=view(), input=draft(), html=context.renderMappingStage(input);
  assert.match(html, /77 行 · 3\/3 个必需列已对应/);
  assert.match(html, /<details class="import-mapping" id="mapping-details" >/);
  assert.equal(input.mapping.external_id,'用例ID');
  assert.equal(input.mapping.expected,'预期结果');
  assert.equal(input.mapping.status,'');
  assert.ok(!Object.values(input.mapping).includes('实际结果'));
  assert.equal(input.preview,null);
});

test('assistant Excel case type suggestion remains selected and is submitted for import preview', async () => {
  const {context,node,requests}=view();
  const input=draft({headers:['用例编号','标题','操作步骤','预期结果','用例层级'],
    suggested_mapping:{external_id:'用例编号',title:'标题',steps:'操作步骤',expected:'预期结果',case_type:'用例层级'}});
  const html=context.renderMappingStage(input);
  assert.equal(input.mapping.case_type,'用例层级');
  assert.match(html,/data-map="case_type"[\s\S]*?value="用例层级" selected/);
  context.renderImport=()=>{};
  context.bindImport({project_id:'p'},input,2);
  await node('#create-preview').click({currentTarget:node('#create-preview')});
  assert.equal(requests.length,1);
  assert.equal(requests[0].body.mapping.case_type,'用例层级');
});

test('missing and ambiguous suggestions stay unselected, open the panel, and explain the exact column issue', () => {
  const {context}=view();
  const input=draft({headers:['用例ID','标题','用例名称','操作步骤'],suggested_mapping:{external_id:'用例ID',steps:'操作步骤'},
    mapping_issues:[{code:'MAPPING_AMBIGUOUS',field:'title',headers:['标题','用例名称']}]});
  const html=context.renderMappingStage(input);
  assert.equal(input.mapping.title,'');
  assert.match(html, /id="mapping-details" open/);
  assert.match(html, /还需选择 标题/);
  assert.match(html, /标题对应多个原表列（标题、用例名称），请手动选择/);
  const conflict=context.renderMappingStage(draft({mapping_issues:[{code:'MAPPING_HEADER_CONFLICT',header:'标题',fields:['title','module']}]}));
  assert.match(conflict,/id="mapping-details" open/);
  assert.match(conflict,/同时匹配标题、模块/);
});

test('an explicit empty suggestion is authoritative, while old workbook exact headers remain compatible', () => {
  const {context}=view();
  const empty=draft({headers:['用例编号','标题','步骤'],suggested_mapping:{}});
  context.renderMappingStage(empty);assert.equal(empty.mapping.external_id,'');
  const old=draft({headers:['用例编号','标题','步骤'],suggested_mapping:undefined});old.upload.source_type='xlsx';
  context.renderMappingStage(old);assert.equal(old.mapping.external_id,'用例编号');assert.equal(old.mapping.steps,'步骤');
});

test('sheet changes clear previous manual choices and apply only the new sheet suggestions', () => {
  const {context,node}=view(), input=draft();
  input.upload.workbook.sheets.push({name:'第二表',row_count:1,headers:['ID','Title','Steps'],
    suggested_mapping:{external_id:'ID',title:'Title',steps:'Steps'},mapping_issues:[]});
  context.renderMappingStage(input);input.mapping.title='人工选择';input.mappingOpen=true;
  context.renderImport=()=>context.renderMappingStage(input);
  context.bindImport({project_id:'p'},input,2);
  node('#sheet-select').change({target:{value:'第二表'}});
  assert.equal(input.mapping.title,'Title');assert.equal(input.mapping.steps,'Steps');assert.equal(input.mappingOpen,null);
});

test('CSV and generic Excel preview submit sheet mapping only; native Excel and JSON retain their original branch', async () => {
  for (const type of ['csv','xlsx','native','case-package']) {
    const {context,node,requests}=view(), input=draft();
    input.upload.source_type=type==='native'?'xlsx':type;
    if(type==='native')input.upload.workbook_export_format='workbench/case-xlsx-v1';
    if(type==='case-package')input.upload.package={package_id:'pkg',case_count:1};
    context.renderMappingStage(input);context.renderImport=()=>{};
    context.bindImport({project_id:'p'},input,2);
    await node('#create-preview').click({currentTarget:node('#create-preview')});
    assert.equal(requests.length,1);assert.match(requests[0].path,/\/imports\/preview$/);
    assert.equal(requests[0].body.upload_id,'upload-offline');
    if(['csv','xlsx'].includes(type)) {
      assert.equal(requests[0].body.sheet_name,'电价管理');assert.equal(requests[0].body.mapping.title,'用例名称');
    } else assert.deepEqual(requests[0].body,{upload_id:'upload-offline'});
    assert.equal(input.result,null);assert.equal(input.preview.preview_id,'preview-offline');
  }
});

test('raw source fields are escaped, collapsed, and kept outside expected results in preview and detail', () => {
  const {context}=view();
  const fields={'<img src=x onerror=alert(1)>':'<script>danger()</script>','实际结果':'历史通过 & 未复测'};
  const raw=context.originalSourceFieldsHtml({source_fields:fields});
  assert.match(raw,/<details class="import-source-fields">/);assert.doesNotMatch(raw,/<script>|<img/);
  assert.match(raw,/&lt;script&gt;danger\(\)&lt;\/script&gt;/);assert.match(raw,/历史通过 &amp; 未复测/);
  assert.equal(context.originalSourceFieldsHtml({}), '');
  const html=context.renderPreviewStage({summary:{NEW:0,DUPLICATE:0,CONFLICT:0,PENDING_CLARIFICATION:1,UNIMPORTABLE:0},items:[{
    content:{external_id:'TC-1',title:'用例',steps:[{action:'打开',expected:''}]},classification:'PENDING_CLARIFICATION',candidate_key:'c',
    source_location:{sheet:'表',row:2},root_source:{source_fields:fields},issues:[]}]});
  assert.match(html,/预期：（缺失，导入后保持待确认）/);
  assert.match(html,/原表信息（实际结果仅为历史记录）/);
  assert.match(html,/不代表本次测试结果或内容确认状态/);
  assert.match(app,/originalSourceFieldsHtml\(item\.root_source\)/);
});

test('all mapping labels and issue text are escaped before becoming HTML', () => {
  const {context}=view(), bad='<svg onload=alert(1)>';
  const input=draft({headers:[bad,'Title','Steps'],suggested_mapping:{external_id:bad,title:'Title',steps:'Steps'},
    mapping_issues:[{code:'MAPPING_AMBIGUOUS',field:'title',headers:[bad]}]});
  const html=context.renderMappingStage(input);assert.doesNotMatch(html,/<svg/);assert.match(html,/&lt;svg onload=alert\(1\)&gt;/);
});

test('CSV upload uses text/csv, preserves the file body, and retains JSON/XLSX media types', async () => {
  const originalFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({upload_id:'uploaded'})};};
  try {
    for(const [name,mime] of [['电价.CSV','text/csv'],['cases.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],['cases.json','application/json']]) {
      const file={name,size:100};assert.equal((await uploadCaseFile(file)).upload_id,'uploaded');
      assert.equal(calls.at(-1).options.headers['content-type'],mime);assert.equal(calls.at(-1).options.body,file);
      assert.equal(decodeURIComponent(calls.at(-1).options.headers['x-file-name']),name);
    }
    await assert.rejects(uploadCaseFile({name:'cases.txt',size:100}),{code:'CASE_UPLOAD_TYPE_UNSUPPORTED'});
    await assert.rejects(uploadCaseFile({name:'cases.csv',size:10*1024*1024+1}),{code:'CASE_UPLOAD_SIZE_INVALID'});
    assert.equal(calls.length,3);
  } finally {globalThis.fetch=originalFetch;}
});

test('offline browser keeps recognized columns folded, preserves manual adjustments through preview, and reopens an ambiguous sheet', async () => {
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    const page=await browser.newPage();await page.route('**/*',route=>route.abort());
    await page.setContent('<main id="app"></main>');
    const input=draft();input.upload.workbook.sheets[0].headers.push('标题补充');
    input.upload.workbook.sheets.push({name:'冲突表',row_count:1,headers:['编号','标题','名称','步骤'],
      suggested_mapping:{external_id:'编号',steps:'步骤'},mapping_issues:[{code:'MAPPING_AMBIGUOUS',field:'title',headers:['标题','名称']}]});
    const preview={preview_id:'offline-preview',summary:{NEW:0,DUPLICATE:0,CONFLICT:0,PENDING_CLARIFICATION:1,UNIMPORTABLE:0},items:[{
      content:{external_id:'TC-1',title:'用例',steps:[{action:'打开',expected:''}]},classification:'PENDING_CLARIFICATION',candidate_key:'c',
      source_location:{sheet:'电价管理',row:2},root_source:{source_fields:{'实际结果':'历史通过 <script>window.rawExecuted=true</script>'}},issues:[]}]};
    await page.addScriptTag({content:`
      const state={importDrafts:new Map([['p',${JSON.stringify(input)}]])};
      const setBreadcrumb=()=>{},projectTabs=()=>'',toast=()=>{},messageFor=e=>e.message;
      const showPage=html=>document.querySelector('#app').innerHTML=html;
      const jsonOptions=body=>({method:'POST',body:JSON.stringify(body)});
      window.importTestCalls=[];
      const mutate=async(path,options)=>{window.importTestCalls.push({path,body:JSON.parse(options.body)});return ${JSON.stringify(preview)};};
      ${source}
      renderImport({project_id:'p',name:'离线项目'});
    `});
    assert.equal(await page.locator('#mapping-details').evaluate(node=>node.open),false);
    assert.equal(await page.locator('[data-map="title"]').isVisible(),false);
    await page.locator('#mapping-details > summary').click();
    await page.locator('[data-map="title"]').selectOption('标题补充');
    assert.match(await page.locator('#mapping-summary').innerText(),/标题 ← 标题补充/);
    await page.locator('#create-preview').click();await page.locator('#confirm-import').waitFor();
    const calls=await page.evaluate(()=>window.importTestCalls);
    assert.equal(calls.length,1);assert.match(calls[0].path,/\/preview$/);assert.equal(calls[0].body.mapping.title,'标题补充');
    assert.equal(await page.locator('.import-source-fields').evaluate(node=>node.open),false);
    await page.locator('.import-source-fields > summary').click();
    assert.match(await page.locator('.import-source-fields').innerText(),/历史通过 <script>/);
    assert.equal(await page.evaluate(()=>window.rawExecuted),undefined);
    await page.locator('#redo-preview').click();
    assert.equal(await page.locator('[data-map="title"]').inputValue(),'标题补充');
    assert.equal(await page.locator('#mapping-details').evaluate(node=>node.open),true);
    await page.locator('#sheet-select').selectOption('冲突表');
    assert.equal(await page.locator('#mapping-details').evaluate(node=>node.open),true);
    assert.equal(await page.locator('[data-map="title"]').inputValue(),'');
    assert.match(await page.locator('#mapping-details').innerText(),/对应多个原表列/);
    assert.equal(await page.evaluate(()=>window.importTestCalls.length),1);
  } finally {await browser.close();}
});
