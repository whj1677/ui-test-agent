import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// Real file input and DOM behavior with an in-memory API; no workbench or SUT is
// started here. Acceptance against the formal 4322 instance is separate.
test('file import and version toggle do not submit environment settings or lose a rejected file', async t => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.WORKBENCH_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(7000);
  await page.route('**/*', route => route.abort());
  const apiSource = await fs.readFile(new URL('../web-v2/api.js', import.meta.url), 'utf8');
  const apiUrl = `data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`;
  const source = (await fs.readFile(new URL('../web-v2/frontend-handoffs.js', import.meta.url), 'utf8')).replace("'./api.js'", JSON.stringify(apiUrl));
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  await page.setContent('<form id="environment"><input name="base_url" value="saved-draft"><button type="submit">保存环境</button></form><section id="handoffs"></section>');
  await page.evaluate(async moduleUrl => {
    window.environmentSubmits = 0; document.querySelector('#environment').addEventListener('submit', event => { event.preventDefault(); window.environmentSubmits++; });
    window.requests = []; window.rows = []; window.rejectNext = true;
    window.fetch = async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      window.requests.push({ url, method: options.method || 'GET', body });
      if (!options.method) return { ok: true, status: 200, json: async () => ({ handoffs: window.rows }) };
      if (window.rejectNext) { window.rejectNext = false; return { ok: false, status: 422, json: async () => ({ error: 'FRONTEND_HANDOFF_PACKAGE_INVALID' }) }; }
      const item = { handoff_id: 'handoff-' + 'a'.repeat(64), sha256: 'a'.repeat(64), module: { name: '电价模板', aliases: [] },
        imported_at: '2026-10-14', source_revision: 'frontend-v1', package_id: 'export-v1', page_count: 1, control_count: 4,
        unresolved: [{ topic: '部署版本', reason: '待核对' }], enabled: body.enabled };
      window.rows = [item]; return { ok: true, status: 200, json: async () => item };
    };
    const { renderFrontendHandoffs } = await import(moduleUrl);
    await renderFrontendHandoffs({ projectId: 'project-example', container: document.querySelector('#handoffs') });
  }, moduleUrl);
  const input = page.getByLabel('前端模块导出文件'), submit = page.getByRole('button', { name: '导入并启用' });
  assert.equal(await submit.isDisabled(), true);
  await input.setInputFiles({ name: 'module.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"example"}') });
  await submit.click();
  await page.getByText('导出物格式不符合要求', { exact: false }).waitFor();
  assert.equal(await input.evaluate(node => node.files.length), 1);
  assert.equal(await submit.isDisabled(), false);
  await submit.click();
  await page.getByRole('button', { name: '停用交接资料' }).waitFor();
  assert.equal(await input.evaluate(node => node.files.length), 0);
  assert.equal(await page.locator('[name=base_url]').inputValue(), 'saved-draft');
  await page.getByRole('button', { name: '停用交接资料' }).click();
  await page.getByRole('button', { name: '启用此版本' }).waitFor();
  const state = await page.evaluate(() => ({ requests: window.requests, environmentSubmits: window.environmentSubmits }));
  assert.equal(state.environmentSubmits, 0);
  assert.equal(state.requests.filter(item => item.method === 'POST').length, 3);
  assert.deepEqual(state.requests.filter(item => item.method === 'POST').at(-1).body, { enabled: false });
  assert.ok(state.requests.every(item => item.url.includes('/project-example/frontend-handoffs')));
});
