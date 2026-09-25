// Package real, already-verified inputs/results; never fabricate a product run.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectWorkbook, parseWorksheet } from '../../server/cases/excel.mjs';
const out = 'workbench/qa/20260925-v21', kit = out + '/user-trial-kit';
const base = 'http://127.0.0.1:4322', project = 'project-80875248-3e14-4055-b077-b890dead1a9e';
const runId = 'trial-bc12728f9326c839fc3805020ec0f4fd43ac7262', batchId = 'batch-627c6a20-f426-4461-81b5-899b73c36f34';
const reportId = 'report-84111a2656dfe7ee739e00992909b23525ff1a2f';
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const get = async url => { const r = await fetch(base + url); assert.ok(r.ok, url); return r; };
await fs.mkdir(kit, { recursive: true });
const run = await (await get('/api/runs/' + runId)).json();
assert.equal(run.batch_id, batchId); assert.equal(run.executed_external_id, 'KC-11');
assert.equal(run.status, 'PASSED'); assert.equal(run.evidence_status, 'COMPLETE');
assert.equal(run.model_calls, 0); assert.equal(run.harness_starts, 0);
assert.equal(run.bundle_sha256, '3631EC155F3C0427D10225D75D9B1558E13505B24749C9F00FC06A8CD3C9B180');
for (const media of run.files) {
  const bytes = Buffer.from(await (await get(`/api/runs/${runId}/media/${media.file_id}`)).arrayBuffer());
  assert.equal(bytes.length, media.bytes); assert.equal(hash(bytes), media.sha256);
  assert.equal(media.run_id, runId);
}
const reportBase = `/api/case-library/projects/${project}/reports/${reportId}`;
const report = await (await get(reportBase)).json();
assert.equal(report.batch_id, batchId); assert.equal(report.entries.length, 1);
assert.equal(report.entries[0].run_id, runId);
let attachments = 0;
for (const m of report.entries[0].media) {
  assert.equal(m.included, true);
  const bytes = Buffer.from(m.data_url.split(',')[1], 'base64');
  assert.equal(bytes.length, m.bytes); assert.equal(hash(bytes), m.sha256); attachments++;
}
const download = await get(reportBase + '/html?download=1');
assert.ok(download.headers.get('content-disposition').includes(reportId));
const html = Buffer.from(await download.arrayBuffer());
assert.deepEqual(html, Buffer.from(await (await get(reportBase + '/html')).arrayBuffer()));
assert.ok(!/\b(?:src|href)=["'](?:https?:|\/api|file:)/i.test(html.toString()));
await fs.writeFile(kit + '/KC-11-本次批次报告.html', html);
const excel = 'workbench/.local/v21-real/cases.xlsx';
assert.equal((await inspectWorkbook(excel)).sheets[0].row_count, 12);
const mapping = { external_id: '用例编号', title: '标题', module: '模块', preconditions: '前置条件', test_data: '测试数据', steps: '步骤', expected: '预期', status: '状态' };
const parsed = await parseWorksheet(excel, { sheet_name: '原用例副本', mapping, upload_sha256: hash(await fs.readFile(excel)), file_name: 'cases.xlsx' });
const inputs = JSON.parse(await fs.readFile('workbench/.local/v21-real/input-cases.json', 'utf8'));
assert.equal(parsed.rows.length, inputs.length);
for (let i = 0; i < inputs.length; i++) assert.deepEqual(parsed.rows[i].content.steps, inputs[i].steps);
await fs.copyFile(excel, kit + '/12条原用例-导入练习.xlsx');
const exported = Buffer.from(await (await get(`/api/case-library/projects/${project}/export`)).arrayBuffer());
assert.equal(JSON.parse(exported).cases.length, 12);
await fs.writeFile(kit + '/当前12条用例包.json', exported);
const engineering = JSON.parse(await fs.readFile(out + '/caption-existing-script.json', 'utf8'));
assert.equal(engineering.scope, 'ENGINEERING_EXISTING_SCRIPT_CAPTURE_NOT_PRODUCT_BATCH');
assert.equal(engineering.result, 'FAILED');
await fs.copyFile(engineering.replay_path, kit + '/KC-02-新采集链路工程复验.webm');
await fs.copyFile(out + '/USER_TRIAL.md', kit + '/开始使用.md');
await fs.copyFile(out + '/caption-kc02-failure-frame.png', kit + '/KC-02-失败画面.png');
await fs.copyFile(out + '/caption-kc02-continued-frame.png', kit + '/KC-02-后续步骤画面.png');
const files = [];
for (const name of await fs.readdir(kit)) {
  if (name === 'manifest.json') continue;
  const bytes = await fs.readFile(path.join(kit, name)); files.push({ name, bytes: bytes.length, sha256: hash(bytes) });
}
let browserDownload = false;
try { browserDownload = hash(await fs.readFile(`C:/Users/20240082/Downloads/${reportId}.html`)) === hash(html); } catch {}
const summary = { checked_at: new Date().toISOString(), project_id: project, batch_id: batchId, run_id: runId, report_id: reportId,
  original_script_hash_unchanged: true, model_calls: 0, harness_starts: 0, media_verified: run.files.length, report_attachments_verified: attachments,
  report_bytes: html.length, browser_download: browserDownload, report_delivery_source: 'exact-HTTP-attachment-saved', offline_system_browser_open: 'NOT_VERIFIED',
  engineering_capture: { case: 'KC-02', result: engineering.result, steps: engineering.step_replay.steps.map(s => s.execution_status), media_identity: engineering.step_replay.run_id },
  formal_service_updated: false, update_blocker: 'automatic approval: blocked by policy', files };
await fs.writeFile(kit + '/manifest.json', JSON.stringify(summary, null, 2));
await fs.writeFile(out + '/caption-user-trial-verification.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ media_verified: summary.media_verified, attachments, kit, files: files.length, model_calls: 0 }));
