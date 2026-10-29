import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { createReportRequestTracker, renderLatestPreview, scopeOptionTitle } from '../web-v2/reports.js';

const entry=(values={})=>({
  case_id:'case-a',external_id:'TC-A',title:'账户查询',case_type:'UI',case_version:2,
  run_id:'run-new',started_at:'2026-09-29T02:00:00Z',finished_at:'2026-09-29T02:01:00Z',
  state:'FINISHED',result:'FAILED',evidence_status:'INCOMPLETE',reason:'当前版本最新失败',
  retest_count:3,previous_run_id:'run-old',...values,
});
const group=(entries,values={})=>({
  group_key:'scope-a',label:'系统 A',scope:{environment_id:'env-a',environment_name:'库存台',target_url:'http://127.0.0.1:4381/workspace',role:'inspector',software_version:'v2'},
  counts:{requested:entries.length,passed:0,failed:1,not_run:0,running:0,incomplete:1,cancelled:0,interrupted:0,blocked:0},
  entries,...values,
});

test('same visible address can be selected by test date and distinct configuration identity',()=>{
  const shared={environment_name:'库存台',target_url:'http://example.test',role:'inspector',software_version:'v1',tested_from:'2026-09-29T02:00:00Z'};
  const first=scopeOptionTitle({...shared,environment_id:'env-one',configuration_sha256:'a'.repeat(64)});
  const second=scopeOptionTitle({...shared,environment_id:'env-two',configuration_sha256:'b'.repeat(64)});
  assert.notEqual(first,second);assert.match(first,/测试 /);assert.match(first,/配置版本 a{12}/);assert.match(second,/登记 two/);
});

test('latest preview separates target scopes and UI/backend cases without adding overlapping group counts',()=>{
  const html=renderLatestPreview({
    group_key:'all',case_count:2,entry_count:3,cutoff_at:'2026-09-29T03:00:00Z',
    groups:[group([entry(),entry({case_id:'case-b',external_id:'TC-B',case_type:'BACKEND',result:'NOT_RUN',run_id:null,retest_count:0})]),
      group([entry({result:'PASSED',reason:'另一范围结果'})],{group_key:'scope-b',label:'系统 B'})],
  });
  assert.match(html,/历史范围展开：项目当前 2 条不同用例，3 条用例与范围组合，2 个被测范围/);
  assert.match(html,/各组数量不能相加/);
  assert.match(html,/库存台/);
  assert.match(html,/127\.0\.0\.1:4381/);
  assert.match(html,/前端 UI 用例/);
  assert.match(html,/后端用例/);
  assert.match(html,/TC-A[\s\S]*当前 v2[\s\S]*失败/);
  assert.match(html,/TC-B[\s\S]*未执行/);
  assert.match(html,/复测/);
  assert.match(html,/run-old/);
  assert.match(html,/最新失败不会被旧通过覆盖/);
});

test('preview marks missing target metadata and escapes untrusted case text',()=>{
  const html=renderLatestPreview({
    group_key:'scope-a',case_count:1,cutoff_at:null,
    counts:{requested:1,not_run:1},
    groups:[group([entry({title:'<script>alert(1)</script>',run_id:null,result:'CURRENT_VERSION_NOT_RUN'})],
      {scope:{environment_id:null,environment_name:null,target_url:null,role:null,software_version:null}})],
  });
  assert.match(html,/当前版本未执行/);
  assert.match(html,/地址：未记录/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;/);
});

test('request identity is reused for identical retry and renewed after scope or media changes',()=>{
  let index=0;const tracker=createReportRequestTracker(()=>`report-id-${++index}`);
  const payload={scope:'project_latest',group_key:'scope-a',include_video:false,include_trace:false};
  assert.equal(tracker.forPayload(payload),'report-id-1');
  assert.equal(tracker.forPayload({...payload}),'report-id-1');
  assert.equal(tracker.forPayload({...payload,group_key:'all'}),'report-id-2');
  assert.equal(tracker.forPayload({...payload,group_key:'all',include_video:true}),'report-id-3');
  tracker.reset();
  assert.equal(tracker.forPayload(payload),'report-id-4');
});

test('DOM presents incomplete as the main result, Chinese reason, and readable target title', async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent(renderLatestPreview({
      group_key:'scope-a',case_count:1,cutoff_at:'2026-09-29T03:00:00Z',
      counts:{requested:1,incomplete:1},
      groups:[group([entry({state:'INCOMPLETE',result:'PASSED',reason:'CURRENT_VERSION_NOT_RUN'})],
        {label:'库存台 · 配置 ffffffffffff · inspector · v2'})],
    }));
    const row=page.locator('tbody tr').first();
    assert.equal(await row.locator('td').nth(1).locator('strong').textContent(),'证据不完整');
    assert.match(await row.locator('td').nth(1).locator('small').textContent(),/原始执行：通过/);
    assert.match(await row.locator('td').nth(4).textContent(),/当前用例版本尚无正式执行记录/);
    assert.match(await page.locator('h3').textContent(),/库存台 · http:\/\/127\.0\.0\.1:4381\/workspace/);
    assert.doesNotMatch(await page.locator('h3').textContent(),/ffffffffffff/);
  } finally { await browser.close(); }
});

test('default per-case DOM shows each current case once and warns about mixed targets', async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const preview={
      group_key:'latest_per_case',case_count:3,entry_count:3,cutoff_at:'2026-09-29T03:00:00Z',
      counts:{requested:3,passed:1,failed:1,not_run:1,count_unit:'CASE_SCOPE'},
      groups:[
        group([entry({case_id:'case-a',external_id:'TC-A',state:'FAILED',result:'FAILED'})]),
        group([entry({case_id:'case-b',external_id:'TC-B',state:'PASSED',result:'PASSED'})],{group_key:'scope-b',scope:{environment_name:'系统 B',target_url:'http://example.test',role:'viewer',software_version:'v3'}}),
        group([entry({case_id:'case-c',external_id:'TC-C',state:'NOT_RUN',result:'NOT_RUN',run_id:null,reason:'NO_FORMAL_RUN'})],{group_key:'group-unexecuted',scope:{environment_name:null,target_url:null,role:null,software_version:null}}),
      ],
    };
    await page.setContent(renderLatestPreview(preview));
    assert.equal(await page.locator('tbody tr').count(),3);
    assert.deepEqual(await page.locator('tbody tr td:first-child strong').allTextContents(),['TC-A','TC-B','TC-C']);
    assert.match(await page.locator('.notice').first().textContent(),/每条只展示最新一次，共 3 行/);
    assert.match(await page.locator('.notice').first().textContent(),/不能当作同一版本的一轮全量验证/);
    assert.match(await page.locator('h3').last().textContent(),/当前版本未执行/);
    assert.match(await page.locator('tbody tr').last().textContent(),/当前用例尚无正式执行记录/);
  } finally { await browser.close(); }
});
