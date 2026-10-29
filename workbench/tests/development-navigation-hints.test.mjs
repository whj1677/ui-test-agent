import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifiedNavigationHints } from '../server/build/development-fast-path.mjs';
import { digest } from '../server/build/development-session.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';

async function fixture(t, url = 'http://127.0.0.1:4322/target/templates') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'navigation-hints-'));
  t.after(async () => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('navigation-hints-')); await fs.rm(root, { recursive: true, force: true }); });
  const final = path.join(root, 'development/final'); await fs.mkdir(final, { recursive: true });
  await fs.writeFile(path.join(final, 'candidate.spec.mjs'), "import {test,expect} from '@playwright/test'; test('case',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.getByRole('status')).toHaveText('good');});});");
  const bundle = await developmentBundle(final);
  const bytes = JSON.stringify([
    { type: 'tool_call', callId: 'menu', tool: 'mcp__playwright-mcp__browser_click' },
    { type: 'tool_result', callId: 'menu', status: 'completed', result: "### Ran Playwright code\n```js\nawait page.getByText('Templates').click();\n```\n### Page\n- Page URL: " + url },
  ]);
  await fs.writeFile(path.join(root, 'development/harness-events.json'), bytes);
  const environmentRef = { environment_id: 'env', network_policy: { origin: 'http://127.0.0.1:4322', path_prefix: '/target', configuration_sha256: 'config-1' } };
  const task = { task_id: 'source-1', source: { project_id: 'p' }, input_bundle: { snapshot: { content: { module: 'templates' } } },
    verification_status: 'TECHNICAL_VALIDATION_PASSED', finished_at: '2026-10-13T08:00:00Z', environment_ref: environmentRef,
    auth_requirement: { role: 'tester' }, candidates: [{ bundle, trial_runs: [{ run_type: 'normal', complete_pass: true, same_candidate_hash: true }] }],
    files: [{ relative_path: 'development/harness-events.json', sha256: digest(bytes) }] };
  const store = { taskDirectory: () => root };
  const scope = { projectId: 'p', module: 'templates', environmentRef, role: 'tester', normalUrl: 'http://127.0.0.1:4322/target/home' };
  return { root, final, task, store, scope };
}

test('passing same-scope evidence supplies navigation only; scopes and changed evidence invalidate reuse', async t => {
  const f = await fixture(t);
  const hints = await verifiedNavigationHints(f.store, [f.task], f.scope);
  assert.equal(hints.length, 1); assert.equal(hints[0].source_task_id, 'source-1');
  assert.deepEqual(hints[0].navigation_actions, ["await page.getByText('Templates').click();"]);
  for (const changed of [{ projectId: 'another' }, { module: 'prices' }, { role: 'owner' }, { environmentRef: { ...f.scope.environmentRef, environment_id: 'other' } }])
    assert.deepEqual(await verifiedNavigationHints(f.store, [f.task], { ...f.scope, ...changed }), []);
  assert.deepEqual(await verifiedNavigationHints(f.store, [{ ...f.task, verification_status: 'INCOMPLETE' }], f.scope), []);
  await fs.appendFile(path.join(f.final, 'candidate.spec.mjs'), '\n// changed');
  assert.deepEqual(await verifiedNavigationHints(f.store, [f.task], f.scope), []);
});

for (const url of ['http://outside.test/target/templates', 'http://127.0.0.1:4322/target-extra/templates', 'http://127.0.0.1:4322/target/templates?token=secret'])
  test(`navigation reuse excludes a foreign scope or sensitive query: ${url.split('?')[0]}`, async t => {
    const f = await fixture(t, url); assert.deepEqual(await verifiedNavigationHints(f.store, [f.task], f.scope), []);
  });
