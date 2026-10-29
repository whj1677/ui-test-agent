import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBindings } from '../web-v2/requirements.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function bindingFixture(t) {
  const previousDocument = globalThis.document;
  const context = { current: 'A', root: null, calls: [], toasts: [] };
  globalThis.document = { querySelector: () => context.root };
  t.after(() => { globalThis.document = previousDocument; });
  const project = id => ({ project_id: `binding-nav-${id}`, name: id, revision: 1, cases: [{ case_id: `case-${id}`, current_version: 1,
    versions: [{ version: 1, content_sha256: `hash-${id}`, content: { case_type: 'BACKEND', status: 'CONFIRMED', external_id: 'BE-001', title: '读取记录',
      steps: [{ order: 1, action: 'GET /records', expected: '记录与来源一致' }] } }] }] });
  const show = id => {
    if (context.current !== id) return;
    if (context.root) context.root.isConnected = false;
    context.root = { dataset: { reqBindingProject: `binding-nav-${id}` }, isConnected: true, listeners: {}, nodes: {},
      querySelectorAll: () => [], querySelector(selector) { return this.nodes[selector] ||= { value: '', files: [{ name: 'protocol.md' }] }; },
      addEventListener(event, handler) { (this.listeners[event] ||= []).push(handler); } };
  };
  context.render = (id, overrides = {}) => renderBindings({ project: project(id), query: new URLSearchParams(), isCurrent: () => context.current === id,
    showPage: () => show(id), go: path => context.calls.push(['go', path]), toast: text => context.toasts.push(text),
    requirementsApi: { listSources: async () => { context.calls.push(['read', id]); return { sources: [{ snapshot_id: `source-${id}`, kind: 'PROTOCOL', sha256: 'protocol-sha', segments: [] }] }; },
      getBindings: async () => ({ bindings: [] }), createBinding: async () => ({ binding_id: 'binding-1', status: 'PARTIAL' }), ...overrides } });
  context.click = (dataset, root = context.root) => { const button = { dataset, disabled: false, closest: () => button }; for (const handler of root.listeners.click || []) handler({ target: button }); };
  return context;
}

test('delayed initial binding load cannot attach the previous project to the next root', async t => {
  const f = bindingFixture(t), load = gate();
  const first = f.render('A', { listSources: async () => { await load.promise; return { sources: [] }; } });
  f.current = 'B'; await f.render('B'); load.resolve(); await first;
  assert.equal(f.root.listeners.click.length, 1);
  f.click({ bindGoDesign: '' });
  assert.deepEqual(f.calls.filter(([kind]) => kind === 'go'), [['go', '#/projects/binding-nav-B/requirements']]);
});

test('delayed protocol upload cannot refresh, navigate or attach handlers after leaving its project', async t => {
  const f = bindingFixture(t), upload = gate();
  await f.render('A', { upload: async () => { f.calls.push(['upload', 'A']); return upload.promise; } });
  const oldRoot = f.root;
  f.click({ bindUpload: '' }); await flush();
  f.current = 'B'; await f.render('B'); const nextRoot = f.root;
  upload.resolve({ snapshot_id: 'new-protocol-A' }); await flush();
  f.click({ bindUpload: '' }, oldRoot); f.click({ bindGoCases: '' }, oldRoot); await flush();
  assert.equal(f.root, nextRoot);
  assert.equal(nextRoot.listeners.click.length, 1);
  assert.deepEqual(f.calls.filter(([kind]) => kind === 'upload'), [['upload', 'A']]);
  assert.deepEqual(f.calls.filter(([kind]) => kind === 'go'), []);
  assert.deepEqual(f.toasts, []);
});

test('delayed binding save response cannot contaminate the next project or permit old-root resubmission', async t => {
  const f = bindingFixture(t), save = gate();
  await f.render('A', { createBinding: async () => { f.calls.push(['save', 'A']); return save.promise; } });
  const oldRoot = f.root;
  f.click({ bindSave: '' }); await flush();
  f.current = 'B'; await f.render('B'); const nextRoot = f.root;
  save.resolve({ binding_id: 'binding-A', status: 'PARTIAL' }); await flush();
  f.click({ bindSave: '' }, oldRoot); await flush();
  assert.equal(f.root, nextRoot);
  assert.equal(nextRoot.listeners.click.length, 1);
  assert.deepEqual(f.calls.filter(([kind]) => kind === 'save'), [['save', 'A']]);
  assert.deepEqual(f.toasts, []);
});
