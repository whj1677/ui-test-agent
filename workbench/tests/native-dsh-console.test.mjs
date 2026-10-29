import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { NativeDshManager } from '../server/native-dsh/manager.mjs';
import { nativeDshRoute } from '../server/native-dsh/routes.mjs';
import { nativeReportRecords } from '../server/native-dsh/report-records.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const hash = 'a'.repeat(64), oldHash = 'b'.repeat(64);

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-dsh-console-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.match(path.basename(resolved), /^native-dsh-console-/);
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const projects = new Map();
  const project = () => {
    const row = { project_id: `project-${randomUUID()}`, cases: [{ case_id: 'case-one', current_version: 2, versions: [
      { version: 1, content_sha256: oldHash.toUpperCase(), content: { external_id: 'TC-001', title: '旧版' } },
      { version: 2, content_sha256: hash.toUpperCase(), content: { external_id: 'TC-001', title: '当前用例' } },
    ] }] };
    projects.set(row.project_id, row);
    return row;
  };
  const p = project();
  const manager = new NativeDshManager({ root, caseStore: { getProject: async id => structuredClone(projects.get(id) || null) },
    client: { run() { assert.fail('read-only projection must not call a model'); } },
    execute() { assert.fail('read-only projection must not execute scripts'); } });
  const task = (p = [...projects.values()][0], extra = {}) => ({ id: `native-${randomUUID()}`, project_id: p.project_id,
    created_at: '2026-10-15T00:00:00.000Z', status: 'COMPLETED', revision_notes: '保留修订说明',
    items: [{ case_id: 'case-one', case_version: 2, content_sha256: hash.toUpperCase(), external_id: 'TC-001',
      formal_entry: 'specs/TC-001.spec.mjs', content: { external_id: 'TC-001', title: '当前用例' }, status: 'PASSED' }], runs: [], ...extra });
  const save = async (p, tasks) => {
    const dir = path.join(root, p.project_id); await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'session.json'), JSON.stringify({ schema: 'workbench/native-dsh-v1', project_id: p.project_id, session_id: 'session-kept', tasks }));
  };
  const run = async (p, task, { status = 'PASSED', purpose = 'case', at = '2026-10-15T01:00:00.000Z', legacy = false,
    script = 'export const testCase = true;\n', helper = 'export const helper = true;\n', case_version = 2, content_sha256 = hash } = {}) => {
    const id = `run-${randomUUID()}`, entry = purpose === 'diagnostic' ? 'diagnostic.mjs' : 'specs/TC-001.spec.mjs';
    const dir = path.join(root, p.project_id, 'runs', id); await fs.mkdir(path.join(dir, 'snapshot/specs'), { recursive: true });
    const files = [{ path: entry, bytes: Buffer.byteLength(script), sha256: digest(script) }, { path: 'helper.mjs', bytes: Buffer.byteLength(helper), sha256: digest(helper) }];
    const bundle = digest(JSON.stringify(files));
    const manifest = { entry, case_id: 'TC-001', script_sha256: digest(script), bundle_sha256: bundle, files, ...(legacy ? {} : { purpose }) };
    const contents = { 'source-manifest.json': JSON.stringify(manifest), [`snapshot/${entry}`]: script, 'snapshot/helper.mjs': helper,
      'trace.zip': 'registered trace', 'screen.png': 'registered screenshot', 'video.webm': 'registered video' };
    const artifacts = [];
    for (const [relative_path, content] of Object.entries(contents)) {
      await fs.writeFile(path.join(dir, relative_path), content);
      artifacts.push({ id: `${id}-${digest(relative_path).slice(0, 24)}`, name: path.basename(relative_path), relative_path,
        kind: relative_path.startsWith('snapshot/') ? 'script' : relative_path.endsWith('.zip') ? 'trace' : relative_path.endsWith('.png') ? 'screenshot' : relative_path.endsWith('.webm') ? 'video' : 'report',
        sha256: digest(content), bytes: Buffer.byteLength(content), mime_type: 'text/plain' });
    }
    const value = { id, case_id: 'case-one', external_id: 'TC-001', case_version, case_content_sha256: content_sha256,
      status, started_at: at, finished_at: at, script_sha256: digest(script), bundle_sha256: bundle, artifacts,
      ...(legacy ? {} : { purpose, entry, counts_for_case: purpose === 'case' }) };
    task.runs.push(value);
    return { value, dir, manifest };
  };
  return { root, manager, projects, p, project, task, save, run };
}

test('native report adapter retains frozen environment and invalid newer-source attempts', async t => {
  const f=await fixture(t),task=f.task();
  task.environment_identity={environment_id:'frozen-env',configuration_sha256:'c'.repeat(64),base_url:'http://127.0.0.1:4460/inspection/'};
  const run=await f.run(f.p,task);await f.save(f.p,[task]);
  const rows=await nativeReportRecords(f.manager,f.p.project_id);
  assert.equal(rows.length,1);assert.deepEqual(rows[0].environment_binding,task.environment_identity);
  assert.equal(rows[0].executed_case_version,2);assert.equal(rows[0].files[0].sha256,rows[0].files[0].sha256.toUpperCase());
  await fs.writeFile(path.join(run.dir,'snapshot','helper.mjs'),'changed');
  const invalid=await nativeReportRecords(f.manager,f.p.project_id);
  assert.equal(invalid.length,1);assert.equal(invalid[0].evidence_status,'INCOMPLETE');assert.equal(invalid[0].counts_for_case,false);
});

test('console projects frozen versions and actual failures by time, without data writes or execution', async t => {
  const f = await fixture(t), task = f.task();
  const failed = await f.run(f.p, task, { status: 'FAILED', at: '2026-10-15T03:00:00.000Z' });
  const old = await f.run(f.p, task, { at: '2026-10-15T01:00:00.000Z' });
  const diag = await f.run(f.p, task, { purpose: 'diagnostic', at: '2026-10-15T04:00:00.000Z' });
  await f.save(f.p, [task]);
  const sessionFile = path.join(f.root, f.p.project_id, 'session.json'), before = await fs.readFile(sessionFile);
  const result = await f.manager.console(f.p.project_id);
  assert.equal(result.records.length, 3);
  assert.equal(result.records[0].run_id, diag.value.id);
  assert.equal(result.records[0].counts_for_case, false);
  assert.deepEqual(result.records.filter(row => row.is_latest_for_case).map(row => [row.run_id, row.status]), [[failed.value.id, 'FAILED']]);
  assert.equal(result.tasks[0].items[0].status, 'FAILED');
  assert.equal(result.tasks[0].status, 'PARTIAL');
  assert.equal(result.scripts.length, 1);
  assert.equal(result.scripts[0].created_at, old.value.started_at);
  assert.deepEqual(result.scripts[0].run_ids, [failed.value.id, old.value.id]);
  assert.equal(result.scripts[0].human_review_status, 'NOT_REVIEWED');
  assert.match(result.scripts[0].script_url, new RegExp(`/native-dsh/tasks/${task.id}/files/`));
  assert.ok(result.records[1].artifacts.some(file => file.kind === 'trace' && file.url));
  assert.deepEqual(await fs.readFile(sessionFile), before);
  assert.equal(f.manager.active, null);
});

test('summary and single-run detail preserve verdicts and recheck tampered helpers on every read', async t => {
  const f=await fixture(t),task=f.task();
  const first=await f.run(f.p,task), second=await f.run(f.p,task,{status:'FAILED',at:'2026-10-15T03:00:00.000Z'});
  first.value.step_replay={steps:[{assertions:[{actual:0,actual_present:true,value_source:'PLAYWRIGHT_MATCHER_RESULT'}]}]};
  await f.run(f.p,task,{purpose:'diagnostic'});await f.save(f.p,[task]);
  const full=await f.manager.console(f.p.project_id),summary=await f.manager.console(f.p.project_id,{summary:true,caseId:'case-one',caseVersion:2});
  assert.deepEqual(summary.records.map(({run_id,status,counts_for_case,source})=>({run_id,status,counts_for_case,source})),full.records.map(({run_id,status,counts_for_case,source})=>({run_id,status,counts_for_case,source})));
  assert.ok(summary.records.every(row=>row.evidence_deferred && !row.step_replay && !row.artifacts && !row.files));
  assert.deepEqual(summary.records.find(row=>row.run_id===first.value.id).assertion_coverage,{total:1,actual:1,missing:0});
  const detail=await f.manager.console(f.p.project_id,{runId:first.value.id});
  assert.equal(detail.records.length,1);assert.deepEqual(detail.records[0].step_replay,first.value.step_replay);
  await fs.writeFile(path.join(second.dir,'snapshot/helper.mjs'),'changed after the previous verification');
  const changed=await f.manager.console(f.p.project_id,{summary:true});
  const row=changed.records.find(row=>row.run_id===second.value.id);
  assert.equal(row.status,'FAILED');assert.equal(row.counts_for_case,false);assert.equal(row.source.reason,'SOURCE_FILE_MISMATCH');
  await assert.rejects(f.manager.console(f.p.project_id,{caseId:'other-case',summary:true}),/SCOPE_INVALID/);
  await assert.rejects(f.manager.console(f.p.project_id,{caseVersion:2}),/SCOPE_INVALID/);
});

test('case-scoped summary retains legacy version bindings and diagnostics without runs',async t=>{
  const f=await fixture(t),task=f.task(), pending=f.task(f.p,{status:'FAILED'});
  const legacy=await f.run(f.p,task,{legacy:true});delete legacy.value.case_version;
  pending.diagnostics=[{schema:'workbench/native-dsh-task-diagnostic-v1',project_id:f.p.project_id,task_id:pending.id,phase:'SAVE',summary:'保留启动诊断'}];
  await f.save(f.p,[task,pending]);
  const result=await f.manager.console(f.p.project_id,{summary:true,caseId:'case-one',caseVersion:2});
  assert.equal(result.records.length,1);assert.equal(result.records[0].case_version,2);assert.equal(result.records[0].counts_for_case,true);
  assert.equal(result.tasks.length,2);assert.equal(result.tasks.find(row=>row.task_id===pending.id).diagnostics[0].summary,'保留启动诊断');
});

test('shared helper changes create distinct frozen script bundles even with the same main script', async t => {
  const f = await fixture(t), task = f.task();
  await f.run(f.p, task);
  await f.run(f.p, task, { helper: 'export const helper = 2;', at: '2026-10-15T02:00:00.000Z' });
  await f.save(f.p, [task]);
  const { scripts } = await f.manager.console(f.p.project_id);
  assert.equal(scripts.length, 2); assert.equal(scripts[0].script_sha256, scripts[1].script_sha256);
  assert.notEqual(scripts[0].bundle_sha256, scripts[1].bundle_sha256);
  assert.notEqual(scripts[0].script_id, scripts[1].script_id);
});

test('legacy classification uses frozen manifest, while missing source remains visible and never falls back to old pass', async t => {
  const f = await fixture(t), task = f.task();
  const old = await f.run(f.p, task, { legacy: true });
  const diagnostic = await f.run(f.p, task, { legacy: true, purpose: 'diagnostic', at: '2026-10-15T02:00:00.000Z' });
  const missing = await f.run(f.p, task, { at: '2026-10-15T03:00:00.000Z' });
  await fs.unlink(path.join(missing.dir, 'snapshot/specs/TC-001.spec.mjs'));
  const unknown = await f.run(f.p, task, { legacy: true, at: '2026-10-15T04:00:00.000Z' });
  await fs.unlink(path.join(unknown.dir, 'source-manifest.json'));
  await f.save(f.p, [task]);
  const result = await f.manager.console(f.p.project_id);
  const byId = id => result.records.find(row => row.run_id === id);
  assert.equal(byId(old.value.id).purpose, 'case'); assert.equal(byId(old.value.id).entry, 'specs/TC-001.spec.mjs');
  assert.equal(byId(diagnostic.value.id).purpose, 'diagnostic');
  assert.equal(byId(missing.value.id).status, 'PASSED');
  assert.equal(byId(missing.value.id).recorded_counts_for_case, true);
  assert.equal(byId(missing.value.id).counts_for_case, false);
  assert.equal(byId(missing.value.id).source.reason, 'SOURCE_FILE_MISSING');
  assert.equal(byId(unknown.value.id).purpose, 'unclassified');
  assert.equal(byId(unknown.value.id).source.reason, 'SOURCE_MANIFEST_MISSING');
  assert.equal(result.records.filter(row => row.is_latest_for_case).length, 0);
  assert.equal(result.tasks[0].items[0].status, 'NOT_RUN');
  assert.equal(result.scripts.length, 1);
});

test('binding uses project, case version and content hash rather than matching external names', async t => {
  const f = await fixture(t), task = f.task();
  const historical = f.task(f.p, { items: [{ ...task.items[0], case_version: 1, content_sha256: oldHash }] });
  await f.run(f.p, historical, { case_version: 1, content_sha256: oldHash });
  const wrong = await f.run(f.p, task, { content_sha256: 'c'.repeat(64) });
  const correct = await f.run(f.p, task, { at: '2026-10-15T02:00:00.000Z' });
  await f.save(f.p, [task, historical]);
  const p2 = f.project(), otherTask = f.task(p2); await f.run(p2, otherTask); await f.save(p2, [otherTask]);
  const result = await f.manager.console(f.p.project_id);
  assert.equal(result.records.find(row => row.run_id === wrong.value.id).binding_status, 'UNBOUND');
  assert.equal(result.records.find(row => row.task_id === historical.id).binding_status, 'HISTORICAL');
  assert.deepEqual(result.records.filter(row => row.is_latest_for_case).map(row => row.run_id), [correct.value.id]);
  assert.equal(result.scripts.length, 2);
  assert.ok(result.records.every(row => row.project_id === f.p.project_id && row.task_id !== otherTask.id));
  assert.equal((await f.manager.console(p2.project_id)).records.length, 1);
  const file = path.join(f.root, f.p.project_id, 'session.json');
  const invalid = JSON.parse(await fs.readFile(file)); invalid.project_id = p2.project_id; await fs.writeFile(file, JSON.stringify(invalid));
  await assert.rejects(f.manager.console(f.p.project_id), /PROJECT_MISMATCH/);
});

test('changed or unregistered frozen source cannot become a script asset', async t => {
  const f = await fixture(t), task = f.task();
  const changed = await f.run(f.p, task); await fs.writeFile(path.join(changed.dir, 'snapshot/helper.mjs'), 'changed after execution');
  const unregistered = await f.run(f.p, task, { at: '2026-10-15T02:00:00.000Z' });
  unregistered.value.artifacts = unregistered.value.artifacts.filter(file => file.relative_path !== 'source-manifest.json');
  await f.save(f.p, [task]);
  const result = await f.manager.console(f.p.project_id);
  assert.equal(result.scripts.length, 0);
  assert.deepEqual(new Set(result.records.map(row => row.source.reason)), new Set(['SOURCE_FILE_MISMATCH', 'SOURCE_ARTIFACT_UNREGISTERED']));
});

test('console GET route is read-only and leaves other native routes intact', async () => {
  const projectId = `project-${randomUUID()}`;
  let call, response;
  const handled = await nativeDshRoute({ request: { method: 'GET' }, response: {}, url: new URL(`http://127.0.0.1/api/case-library/projects/${projectId}/native-dsh/console`),
    manager: { console: async id => { call = id; return { project_id: id, scripts: [], records: [], tasks: [] }; } },
    sendJson: (_, status, body) => { response = { status, body }; },
    readJsonBody() { assert.fail('GET must not read or mutate request body'); }, trustedMutation() { assert.fail('GET must not invoke mutation checks'); } });
  assert.equal(handled, true); assert.equal(call, projectId); assert.equal(response.status, 200); assert.deepEqual(response.body.records, []);
});

test('console exposes sanitized collection gaps without rewriting evidence or the business result', async t => {
  const f = await fixture(t), task = f.task();
  const current = await f.run(f.p, task), legacy = await f.run(f.p, task, { at: '2026-10-14T01:00:00.000Z' });
  Object.assign(current.value, {
    evidence_status: 'INCOMPLETE',
    unbound_assertions: [{ matcher_name: 'toEqual', status: 'PASSED', actual_present: true, actual: { count: 2, access_token: 'private-token-value' },
      raw_error: 'password=private-password-value', location: { file: 'specs/TC-001.spec.mjs', line: 9 } }],
    evidence_mapping: { status: 'UNAVAILABLE', reason: 'STEP_COMMENTS_NOT_UNIQUE_TOP_LEVEL_SEQUENCE', note: 'Bearer abcdefghijklmnopqrstuvwxyz1234' },
    evidence_errors: ['WINDOW_RECORDING_START_FAILED', 'api_key=private-key-value'],
    evidence_config: { credentials: 'must-not-be-projected' },
  });
  await f.save(f.p, [task]);
  const sessionFile = path.join(f.root, f.p.project_id, 'session.json'), before = await fs.readFile(sessionFile);
  const projection = await f.manager.console(f.p.project_id), row = projection.records.find(record => record.run_id === current.value.id);
  assert.equal(row.status, 'PASSED'); assert.equal(row.evidence_status, 'INCOMPLETE');
  assert.equal(row.unbound_assertions[0].actual.count, 2);
  assert.equal(row.unbound_assertions[0].actual.access_token, '[凭据已隐藏]');
  assert.deepEqual(row.unbound_assertions[0].location, { file: 'specs/TC-001.spec.mjs', line: 9 });
  assert.equal(row.evidence_mapping.reason, 'STEP_COMMENTS_NOT_UNIQUE_TOP_LEVEL_SEQUENCE');
  assert.equal(row.evidence_errors[0], 'WINDOW_RECORDING_START_FAILED');
  assert.doesNotMatch(JSON.stringify(row), /private-token-value|private-password-value|private-key-value|abcdefghijklmnopqrstuvwxyz1234|must-not-be-projected/);
  assert.equal(Object.hasOwn(row, 'evidence_config'), false);
  assert.equal(Object.hasOwn(projection.records.find(record => record.run_id === legacy.value.id), 'evidence_mapping'), false);
  row.unbound_assertions[0].actual.count = 99;
  assert.deepEqual(await fs.readFile(sessionFile), before);
});

test('console exposes only bound sanitized task diagnostics without inventing runs or fixing task status', async t => {
  const f = await fixture(t), task = f.task(f.p, { status: 'RUNNING', finished_at: '2026-10-15T01:00:00.000Z' });
  const diagnostic = { schema: 'workbench/native-dsh-task-diagnostic-v1', at: '2026-10-15T00:00:15.000Z',
    project_id: f.p.project_id, task_id: task.id, phase: 'SAVE_MODEL_STAGE', update_phase: 'SAVE',
    name: 'Error', code: 'EACCES', syscall: 'rename', summary: '操作失败：EACCES (rename)' };
  task.diagnostics = [
    { ...diagnostic, project_id: 'other-project', summary: 'OTHER_PROJECT' },
    { ...diagnostic, task_id: 'other-task', summary: 'OTHER_TASK' },
    { ...diagnostic, schema: 'unknown', summary: 'UNKNOWN_SCHEMA' },
    ...Array.from({ length: 21 }, (_, index) => ({ ...diagnostic, summary: index === 0 ? 'TOO_OLD' : diagnostic.summary,
      message: 'RAW_MESSAGE', stack: 'RAW_STACK', path: 'PRIVATE_PATH', prompt: 'PRIVATE_PROMPT' })),
  ];
  await f.save(f.p, [task]);
  const sessionFile = path.join(f.root, f.p.project_id, 'session.json'), before = await fs.readFile(sessionFile);
  const result = await f.manager.console(f.p.project_id), projected = result.tasks[0];
  assert.equal(projected.status, 'RUNNING'); assert.equal(projected.items[0].status, 'NOT_RUN');
  assert.equal(projected.diagnostics.length, 20); assert.deepEqual(projected.diagnostics[0], diagnostic);
  assert.deepEqual(result.records, []); assert.deepEqual(result.scripts, []);
  assert.doesNotMatch(JSON.stringify(projected), /OTHER_PROJECT|OTHER_TASK|UNKNOWN_SCHEMA|TOO_OLD|RAW_MESSAGE|RAW_STACK|PRIVATE_PATH|PRIVATE_PROMPT/);
  assert.deepEqual(await fs.readFile(sessionFile), before);
  const legacy = f.task(f.p, { status: 'FAILED' }); await f.save(f.p, [legacy]);
  assert.equal(Object.hasOwn((await f.manager.console(f.p.project_id)).tasks[0], 'diagnostics'), false);
});
