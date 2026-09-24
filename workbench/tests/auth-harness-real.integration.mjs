// Explicitly invoked only after separate authorization for a real model call.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuthFixture } from '../auth-fixture/server.mjs';
import { TargetAuthSessions } from '../server/auth/session.mjs';
import { localAuthEnvironments } from '../server/auth/catalog.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { parseCandidateReport } from '../server/build/report.mjs';
import { runHarnessTask } from '../../harness-probe/src/harness-runner.mjs';

if (process.env.AUTH01_ALLOW_REAL_HARNESS !== '1') throw new Error('AUTH01_REAL_HARNESS_NOT_AUTHORIZED');
const dshHome = process.env.WORKBENCH_DSH_HOME;
if (!dshHome) throw new Error('WORKBENCH_DSH_HOME_REQUIRED');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const fixture = createAuthFixture();
const origin = await fixture.listen(0);
const environment = localAuthEnvironments(origin)[0];
const sessions = new TargetAuthSessions({ environments: [environment], browserExecutable: executable, headless: true });
const scope = { project_id: 'project-auth01-real-harness', environment_id: environment.environment_id, role: 'inspector' };
const local = path.join(root, '.local');
await fs.mkdir(local, { recursive: true });
const workspace = await fs.mkdtemp(path.join(local, 'auth01-real-harness-'));
const output = path.join(workspace, 'output');
await fs.mkdir(output);
const candidatePath = path.join(output, 'candidate.spec.mjs');
const summary = { schema: 'auth01/real-harness-check-v1', result: 'INCOMPLETE', scope: { ...scope },
  model: 'deepseek-flash', harness_starts: 0, model_calls: null, workspace };
try {
  await sessions.open(scope);
  const item = sessions.sessions.get(JSON.stringify([scope.project_id, scope.environment_id, scope.role]));
  await item.page.getByLabel('账号').fill('inspector');
  await item.page.getByLabel('密码').fill('demo-inspector');
  await item.page.getByRole('button', { name: '登录' }).click();
  await item.page.getByTestId('protected-value').waitFor();
  const checked = await sessions.check(scope);
  assert.equal(checked.status, 'VALID');
  assert.equal(item.page.url(), 'about:blank', 'login input tab must be gone before model startup');
  const endpoint = await sessions.attachEndpoint(scope, checked.session_version);
  const task = [
    'This is an authorized local synthetic authentication fixture. The operator has already logged in before this session started.',
    `Use the browser tools to navigate only to ${origin}/protected and observe the visible protected page.`,
    'Create exactly one Playwright Test candidate in output/candidate.spec.mjs.',
    'The candidate must navigate to process.env.PROBE_URL, assert the protected device label is exactly 设备 DEV-AUTH-01, and assert that the role shown is inspector.',
    'Do not perform login, request credentials, inspect browser cookies/tokens, access other sites, or alter the fixture.',
  ].join('\n');
  const result = await runHarnessTask({
    task, workspace, dshHome, patchPath: path.join(root, '..', 'harness-probe', 'config', 'browser-flash.cordis.yml'),
    candidatePath, browserExecutable: executable, browserAttachEndpoint: endpoint,
    timeoutMs: 300_000, maxToolCalls: 15,
  });
  summary.harness_starts = result.process.pid ? 1 : 0;
  summary.model_calls = result.events.filter((event) => event.type === 'usage' || event.type === 'model_request').length || null;
  summary.tool_calls = result.assessment.toolCalls;
  summary.browser_tool_calls = result.assessment.browserToolCalls;
  summary.harness_exit_code = result.process.exitCode;
  summary.harness_termination = result.process.termination;
  summary.harness_success = result.assessment.success;
  summary.provider_usage = result.events.findLast((event) => event?.usage)?.usage || null;
  summary.candidate_generated = Boolean(result.candidate);
  if (!result.assessment.success) throw new Error('AUTH01_REAL_HARNESS_INCOMPLETE');
  const code = await fs.readFile(candidatePath, 'utf8');
  assert(!/demo-inspector|auth01_session|cookie|password|login/i.test(code), 'candidate must not contain login or credential handling');
  const state = await sessions.stateForExecution(scope, checked.session_version);
  const raw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable: executable,
    fixtureUrl: `${origin}/protected`, runDirectory: path.join(workspace, 'verification'),
    authStorageState: state });
  const report = await parseCandidateReport(raw.reportPath, raw.process);
  summary.executor_status = report.test_status;
  summary.executor_complete_pass = report.complete_pass;
  summary.executor_exit_code = raw.process.exitCode;
  summary.result = report.complete_pass ? 'HARNESS_AND_EXECUTOR_AUTH_REUSE_VERIFIED' : 'HARNESS_OBSERVED_EXECUTOR_FAILED';
  assert.equal(report.complete_pass, true, 'candidate must execute in a new authenticated context');
} catch (error) {
  summary.error_code = error.message;
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(workspace, 'summary.json'), JSON.stringify(summary, null, 2));
  await sessions.close();
  await fixture.close();
  console.log(JSON.stringify(summary));
}
