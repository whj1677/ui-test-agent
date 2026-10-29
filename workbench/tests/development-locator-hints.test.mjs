import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifiedLocatorHints } from '../server/build/development-fast-path.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';

// Pure file/AST tests: no workbench, browser, cloud data or model is started.
async function fixture(t, code = `
  import { test, expect } from '@playwright/test';
  test('original case', async ({page}) => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('.options:visible .option').first().click();
    await expect(page.locator('.table tbody tr.data-row')).toHaveCount(2);
    await expect(page.getByRole('status')).toHaveText('EXPECTED_RESULT_NOT_A_HINT');
  });`) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'locator-hints-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('locator-hints-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const final = path.join(root, 'development/final');
  await fs.mkdir(final, { recursive: true });
  await fs.writeFile(path.join(final, 'candidate.spec.mjs'), code);
  const bundle = await developmentBundle(final, { validate: false });
  const environmentRef = { environment_id: 'env', network_policy: { origin: 'http://127.0.0.1:4322', path_prefix: '/target', configuration_sha256: 'config-1' } };
  const task = { task_id: 'source-1', source: { project_id: 'p' }, input_bundle: { snapshot: { content: { module: 'templates' } } },
    verification_status: 'TECHNICAL_VALIDATION_PASSED', finished_at: '2026-10-13T08:00:00Z', environment_ref: environmentRef,
    auth_requirement: { role: 'tester' }, candidates: [{ bundle, trial_runs: [{ run_type: 'normal', complete_pass: true, same_candidate_hash: true }] }] };
  const store = { taskDirectory: () => root };
  const scope = { projectId: 'p', module: 'templates', environmentRef, role: 'tester', normalUrl: 'http://127.0.0.1:4322/target/home' };
  return { root, final, task, store, scope };
}

test('passing evidence yields bounded advisory expressions with scope and provenance, never actions or assertion values', async t => {
  const f = await fixture(t);
  const hints = await verifiedLocatorHints(f.store, [f.task], f.scope);
  const expressions = hints.map(hint => hint.expression);
  assert.ok(expressions.includes('page.getByRole("dialog").getByRole("button", { name: "Save", exact: true })'));
  assert.equal(expressions[0], 'page.locator(".options:visible .option").first()');
  assert.ok(expressions.includes('page.locator(".table tbody tr.data-row")'));
  assert.doesNotMatch(JSON.stringify(hints), /EXPECTED_RESULT_NOT_A_HINT|toHaveCount|toHaveText|\.click|const dialog|original case/);
  for (const hint of hints) {
    assert.equal(hint.advisory_only, true);
    assert.equal(hint.requires_live_validation, true);
    assert.equal(hint.source_task_id, f.task.task_id);
    assert.equal(hint.source_bundle_sha256, f.task.candidates[0].bundle.sha256);
    assert.equal(hint.source_file_sha256, f.task.candidates[0].bundle.files[0].sha256);
    assert.equal(hint.passed, undefined, 'old evidence does not declare a changed/current page passed');
  }
});

test('project, module, identity, environment configuration and URL scope are isolated', async t => {
  const f = await fixture(t);
  for (const changed of [
    { projectId: 'another' }, { module: 'other' }, { module: '' }, { role: 'owner' }, { role: null },
    { environmentRef: { ...f.scope.environmentRef, environment_id: 'different' } },
    { environmentRef: { ...f.scope.environmentRef, network_policy: { ...f.scope.environmentRef.network_policy, configuration_sha256: 'changed' } } },
    { normalUrl: 'http://outside.test/target/home' }, { normalUrl: 'http://127.0.0.1:4322/target-other/home' },
    { normalUrl: 'http://user:secret@127.0.0.1:4322/target/home' }, { normalUrl: 'http://127.0.0.1:4322/target/home?token=private' },
    { normalUrl: 'not a URL' },
  ]) assert.deepEqual(await verifiedLocatorHints(f.store, [f.task], { ...f.scope, ...changed }), [], JSON.stringify(changed));
});

test('only finalized full passing same-bundle evidence is reusable; tampered files and manifests fail closed', async t => {
  const f = await fixture(t);
  for (const changed of [
    { verification_status: 'INCOMPLETE' }, { finished_at: null }, { candidates: [] },
    { candidates: [{ ...f.task.candidates[0], trial_runs: [{ run_type: 'normal', complete_pass: false, same_candidate_hash: true }] }] },
    { candidates: [{ ...f.task.candidates[0], trial_runs: [{ run_type: 'normal', complete_pass: true, same_candidate_hash: false }] }] },
    { candidates: [{ ...f.task.candidates[0], bundle: { ...f.task.candidates[0].bundle, sha256: 'changed' } }] },
  ]) assert.deepEqual(await verifiedLocatorHints(f.store, [{ ...f.task, ...changed }], f.scope), []);
  await fs.appendFile(path.join(f.final, 'candidate.spec.mjs'), '\n// tampered');
  assert.deepEqual(await verifiedLocatorHints(f.store, [f.task], f.scope), []);
});

test('dynamic locators, sensitive literals, URLs, arbitrary helpers and unsafe selectors are excluded without broadening', async t => {
  const f = await fixture(t, `
    async function run(page, dynamic) {
      await page.getByRole('button', {name: dynamic}).click();
      await page.locator('.dynamic-row').filter({hasText: dynamic}).click();
      await page.locator('.value-row').filter({hasText: 'fixture-data'}).click();
      await page.locator('input[value="private-data"]').click();
      await page.locator('xpath=//button').click();
      await page.locator('div:has-text("fixture")').click();
      await page.getByText('https://private.test/path').click();
      await page.getByText('alice@example.com').click();
      await page.getByLabel('Password').fill('DO_NOT_COPY');
      await page.getByTestId('session-token').click();
      await page.locator(\`.item-\${dynamic}\`).click();
      await customHelper('EXECUTABLE_HELPER_NOT_ALLOWED');
      await page.getByRole('button', {name: (() => 'dynamic')()}).click();
      await page['locator']('.computed-call').click();
      await page.locator('.safe-control').filter({visible: true}).click();
    }
  `);
  const hints = await verifiedLocatorHints(f.store, [f.task], f.scope);
  assert.deepEqual(hints.map(hint => hint.expression), ['page.locator(".safe-control").filter({ visible: true })']);
});

test('text and named data-role assertion targets never copy business expected values or fixture names', async t => {
  const f = await fixture(t, `
    async function run(page) {
      await expect(page.getByText('EXPECTED_BUSINESS_TEXT')).toBeVisible();
      await expect(page.locator('.do-not-broaden').getByText('SCOPED_EXPECTED_TEXT')).toBeVisible();
      await page.getByText('Menu text also omitted').click();
      await expect(page.getByRole('row', {name: 'CUSTOMER_RECORD'})).toBeVisible();
      await page.getByRole('row', {name: 'CUSTOMER_RECORD'}).getByRole('button', {name: 'Delete'}).click();
      await expect(page.getByRole('cell', {name: 'EXPECTED_PRICE'})).toBeVisible();
      await expect(page.getByRole('heading', {name: 'EXPECTED_HEADING'})).toBeVisible();
      await expect(page.getByRole('status', {name: 'EXPECTED_STATUS'})).toBeVisible();
      await expect(page.getByRole('alert', {name: 'EXPECTED_ALERT'})).toBeVisible();
      await page.getByRole('option', {name: 'FIXTURE_REGION'}).click();
      await page.getByRole('dialog', {name: 'FIXTURE_DETAIL_TITLE'}).getByRole('button', {name: 'Close'}).click();
      await page.getByRole('button', {name: 'Save'}).click();
      await expect(page.getByRole('status')).toHaveText('EXPECTED_STATUS');
      await page.getByLabel('Search').fill('FIXTURE_SEARCH_VALUE');
      await page.getByTestId('submit-control').click();
    }
  `);
  const hints = await verifiedLocatorHints(f.store, [f.task], f.scope);
  assert.deepEqual(hints.map(hint => hint.expression), [
    'page.getByRole("button", { name: "Save" })',
    'page.getByRole("status")',
    'page.getByLabel("Search")',
    'page.getByTestId("submit-control")',
  ]);
  assert.doesNotMatch(JSON.stringify(hints), /EXPECTED_|FIXTURE_|CUSTOMER_RECORD|do-not-broaden|Menu text|Delete|Close/);
});

test('aliases respect block/function shadowing and mutable or reassigned bindings are not expanded', async t => {
  const f = await fixture(t, `
    async function run(page) {
      const dialog = page.getByRole('dialog');
      { const dialog = arbitraryHelper(); await dialog.getByLabel('Bad inner alias').fill('x'); }
      async function nested(dialog) { await dialog.getByLabel('Bad parameter alias').click(); }
      await dialog.getByLabel('Good outer alias').fill('x');
      let mutable = page.locator('.mutable');
      await mutable.getByLabel('Bad mutable alias').click();
      const changed = page.locator('.changed'); changed = null;
      await changed.getByLabel('Bad reassigned alias').click();
    }
  `);
  const hints = await verifiedLocatorHints(f.store, [f.task], f.scope);
  const result = JSON.stringify(hints);
  assert.match(result, /Good outer alias/);
  assert.doesNotMatch(result, /Bad inner alias|Bad parameter alias|Bad mutable alias|Bad reassigned alias/);
});

test('source scanning and outputs stay bounded; duplicates do not multiply and optional corrupt source does not block', async t => {
  const f = await fixture(t, `async function run(page) { ${Array.from({length: 30}, (_, i) => `await page.getByTestId('control-${i}').click();`).join('\n')} }`);
  let reads = 0;
  const store = { taskDirectory: () => { reads++; return f.root; } };
  const tasks = Array.from({length: 20}, (_, i) => ({ ...f.task, task_id: `source-${i}`, finished_at: `2026-10-13T08:${String(i).padStart(2, '0')}:00Z` }));
  const hints = await verifiedLocatorHints(store, tasks, f.scope);
  assert.equal(hints.length, 12);
  assert.equal(hints[0].source_task_id, 'source-19');
  assert.ok(reads <= 3);
  await fs.writeFile(path.join(f.final, 'candidate.spec.mjs'), 'broken syntax (');
  f.task.candidates[0].bundle = await developmentBundle(f.final, { validate: false });
  reads = 0;
  assert.deepEqual(await verifiedLocatorHints(store, tasks, f.scope), []);
  assert.equal(reads, 3);
});
