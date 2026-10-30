import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError, downloadPackage, uploadCaseFile } from '../web-v2/api.js';
import { requirementsApi } from '../web-v2/requirements-api.js';
import { caseAssistantApi } from '../web-v2/case-assistant-api.js';

const excelType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const downloads = [
  { run: () => downloadPackage('project/a', ['case/1', 'case 2']), type: 'application/json',
    path: '/api/case-library/projects/project%2Fa/export?case_ids=case%2F1,case%202', name: 'project/a-cases.json', error: 'CASE_EXPORT_RESPONSE_INVALID' },
  ...['json', 'xlsx'].map(format => ({
    run: () => requirementsApi.exportCases('project/a', { caseType: 'BACKEND', format }),
    type: format === 'xlsx' ? excelType : 'application/json',
    path: `/api/case-library/projects/project%2Fa/export?case_type=BACKEND&format=${format}`,
    name: `cases.${format}`, error: 'CASE_EXPORT_RESPONSE_INVALID',
  })),
  ...['UI', 'BACKEND'].map(caseType => ({
    run: () => caseAssistantApi.export('project/a', 'conversation/b', 'turn/c', caseType), type: excelType,
    path: `/api/case-library/projects/project%2Fa/case-assistant/conversations/conversation%2Fb/turns/turn%2Fc/export?case_type=${caseType}`,
    name: `${caseType === 'UI' ? '前端' : '后端'}测试用例.xlsx`, error: 'CASE_ASSISTANT_EXPORT_RESPONSE_INVALID',
  })),
];

test('all download entrypoints retain encoded identities and return the response blob and decoded filename', async t => {
  const blob = new Blob(['export bytes']);
  let expected;
  const fetch = t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, expected.path);
    assert.deepEqual(options, {});
    return { ok: true, status: 200, headers: new Headers({
      'content-type': `${expected.type}; charset=utf-8`,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent('用例导出.' + (expected.type === excelType ? 'xlsx' : 'json'))}`,
    }), blob: async () => blob };
  });
  for (const entry of downloads) {
    expected = entry;
    const result = await entry.run();
    assert.equal(result.blob, blob);
    assert.equal(result.name, '用例导出.' + (entry.type === excelType ? 'xlsx' : 'json'));
  }
  assert.equal(fetch.mock.callCount(), downloads.length);
});

test('all download entrypoints normalize disconnection without retrying', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  for (const entry of downloads) {
    await assert.rejects(entry.run(), error => error instanceof ApiError && error.code === 'WORKBENCH_UNREACHABLE' && error.status === 0);
  }
  assert.equal(fetch.mock.callCount(), downloads.length);
});

test('all download entrypoints preserve server error codes and handle non-JSON HTTP errors', async t => {
  let structured = true;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503, json: async () => {
    if (structured) return { error: 'CASE_PROJECT_NOT_FOUND' };
    throw new SyntaxError('HTML response');
  }, blob: () => assert.fail('error responses must not become downloads') }));
  for (const value of [true, false]) {
    structured = value;
    for (const entry of downloads) await assert.rejects(entry.run(), {
      name: 'ApiError', code: value ? 'CASE_PROJECT_NOT_FOUND' : 'HTTP_503', status: 503,
    });
  }
});

test('all download entrypoints reject successful HTML, missing and mismatched media types before reading blobs', async t => {
  let type;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
    headers: new Headers(type ? { 'content-type': type } : {}),
    blob: () => assert.fail('invalid content must not become a download'),
  }));
  for (const entry of downloads) {
    for (const value of ['text/html', '', `${entry.type}-invalid`, entry.type === excelType ? 'application/json' : excelType]) {
      type = value;
      await assert.rejects(entry.run(), { name: 'ApiError', code: entry.error, status: 200 });
    }
  }
});

test('all download entrypoints retain usable fallback names for missing or malformed filename headers', async t => {
  const blob = new Blob(['valid content']);
  let expected, disposition;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
    headers: new Headers({ 'content-type': expected.type, ...(disposition ? { 'content-disposition': disposition } : {}) }),
    blob: async () => blob,
  }));
  for (const entry of downloads) {
    expected = entry;
    for (const value of ['', "attachment; filename*=UTF-8''invalid%ZZ.xlsx"]) {
      disposition = value;
      const result = await entry.run();
      assert.equal(result.name, entry.name);
      assert.equal(result.blob, blob);
    }
  }
});

test('unsupported requirement export formats still reach the server and retain its rejection', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async path => {
    assert.equal(path, '/api/case-library/projects/p/export?case_type=UI&format=csv');
    return { ok: false, status: 400, json: async () => ({ error: 'CASE_EXPORT_FORMAT_INVALID' }) };
  });
  await assert.rejects(requirementsApi.exportCases('p', { caseType: 'UI', format: 'csv' }), {
    name: 'ApiError', code: 'CASE_EXPORT_FORMAT_INVALID', status: 400,
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test('shared requests keep JSON responses, no-content responses and upload bytes intact', async t => {
  const file = new File(['case csv'], '测试.csv');
  const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"value":1}' };
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (path, received) => {
    if (path === '/api/case-library/uploads') {
      assert.equal(received.method, 'POST');
      assert.equal(received.body, file);
      assert.equal(received.headers['content-type'], 'text/csv');
      assert.equal(received.headers['x-file-name'], encodeURIComponent(file.name));
    } else {
      assert.equal(path, '/api/test');
      assert.equal(received, options);
    }
    return { ok: true, status, json: async () => {
      assert.notEqual(status, 204, 'no-content responses must not be parsed as JSON');
      return { saved: true };
    } };
  });
  assert.deepEqual(await api('/api/test', options), { saved: true });
  assert.deepEqual(await uploadCaseFile(file), { saved: true });
  status = 204;
  assert.equal(await api('/api/test', options), null);
});
