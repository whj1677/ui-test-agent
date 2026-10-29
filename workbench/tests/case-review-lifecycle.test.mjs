import test from 'node:test';
import assert from 'node:assert/strict';
import { openCaseContentReview } from '../web-v2/case-review.js';

const route = '#/projects/project-lifecycle/cases';
const project = {
  project_id: 'project-lifecycle', revision: 7,
  cases: [{
    case_id: 'case-lifecycle', external_id: 'UI-1', current_version: 1,
    versions: [{ version: 1, content_sha256: 'frozen-content-sha', content: {
      external_id: 'UI-1', title: '取消模板编辑', case_type: 'UI', status: 'PENDING_CONFIRMATION',
      preconditions: '独立测试模板', test_data: '', steps: [{ order: 1, action: '取消编辑', expected: '模板不变化' }],
    } }],
  }],
};

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function control({ value = '', checked = false, disabled = false } = {}) {
  let disabledValue = disabled, text = '';
  return {
    value, checked, disabledWrites: [], textWrites: [],
    get disabled() { return disabledValue; },
    set disabled(next) { disabledValue = next; this.disabledWrites.push(next); },
    get textContent() { return text; },
    set textContent(next) { text = next; this.textWrites.push(next); },
  };
}

function fixture(t) {
  const saved = Object.fromEntries(['document', 'window', 'location', 'fetch'].map(key => [key, {
    existed: Object.hasOwn(globalThis, key), value: globalThis[key],
  }]));
  t.after(() => {
    for (const [key, previous] of Object.entries(saved)) {
      if (previous.existed) globalThis[key] = previous.value;
      else delete globalThis[key];
    }
  });
  const callbacks = [], requests = [], events = new Map(), dialogs = [], root = { firstElementChild: null };
  const location = { hash: route };
  Object.defineProperty(root, 'innerHTML', {
    set(html) {
      if (root.firstElementChild) root.firstElementChild.isConnected = false;
      const controls = new Map([
        ['[data-review-person]', control({ value: '王测试' })],
        ['[data-review-ack]', control()],
        ['[data-review-submit]', control({ disabled: true })],
        ['[data-review-error]', control()],
      ]);
      const closers = [control(), control()];
      const inputsAndButtons = [controls.get('[data-review-person]'), controls.get('[data-review-ack]'),
        controls.get('[data-review-submit]'), ...closers];
      const dialog = {
        html, isConnected: true, controls, inputsAndButtons,
        querySelector: selector => controls.get(selector),
        querySelectorAll: selector => selector === '[data-review-close]' ? closers :
          selector === 'input,button' ? inputsAndButtons : [],
        remove() {
          this.isConnected = false;
          if (root.firstElementChild === this) root.firstElementChild = null;
        },
      };
      root.firstElementChild = dialog; dialogs.push(dialog);
    },
  });
  globalThis.location = location;
  globalThis.window = {
    location,
    addEventListener(name, handler) {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(handler);
    },
    removeEventListener(name, handler) {
      events.get(name)?.delete(handler);
      if (!events.get(name)?.size) events.delete(name);
    },
  };
  globalThis.document = { querySelector: selector => selector === '#modal-root' ? root : null };
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/environment') && !options.method) {
      return { ok: true, status: 200, json: async () => ({ ui: { operator: '王测试' } }) };
    }
    assert.equal(url, '/api/case-library/projects/project-lifecycle/cases/confirm-content');
    assert.equal(options.method, 'POST');
    const pending = deferred();
    requests.push({ ...pending, body: JSON.parse(options.body) });
    return pending.promise;
  };
  return {
    root, dialogs, callbacks, requests, events,
    async open() {
      await openCaseContentReview({ project, isCurrent: () => location.hash === route,
        onConfirmed: updated => { callbacks.push(updated); } });
      return root.firstElementChild;
    },
    submit(dialog) {
      const acknowledge = dialog.controls.get('[data-review-ack]');
      acknowledge.checked = true; acknowledge.onchange();
      assert.equal(dialog.controls.get('[data-review-submit]').disabled, false);
      return dialog.controls.get('[data-review-submit]').onclick();
    },
    navigate(hash) {
      location.hash = hash;
      for (const handler of [...(events.get('hashchange') || [])]) handler();
    },
    settle(index, ok = true, value = { ...project, revision: 8 }) {
      requests[index].resolve({ ok, status: ok ? 200 : 409,
        json: async () => ok ? value : { error: 'CASE_CONTENT_REVIEW_CONFLICT' } });
    },
  };
}

test('current content confirmation calls the success callback once and disposes its modal', async t => {
  const f = fixture(t), dialog = await f.open();
  const submitting = f.submit(dialog);
  assert.equal(f.requests.length, 1);
  assert.ok(dialog.inputsAndButtons.every(item => item.disabled));
  // The original handler cannot submit another request while the first is pending.
  await dialog.controls.get('[data-review-submit]').onclick();
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.requests[0].body, {
    revision: 7, reviewer: '王测试', confirm_content: true,
    items: [{ case_id: 'case-lifecycle', case_version: 1, content_sha256: 'frozen-content-sha' }],
  });
  const updated = { ...project, revision: 8 };
  f.settle(0, true, updated); await submitting;
  assert.deepEqual(f.callbacks, [updated]);
  assert.equal(f.root.firstElementChild, null);
  assert.equal(dialog.isConnected, false);
  assert.equal(f.events.size, 0);
  await dialog.controls.get('[data-review-submit]').onclick();
  assert.equal(f.requests.length, 1);
  assert.equal(f.callbacks.length, 1);
});

test('leaving during submission closes immediately and a late success cannot revive after returning to the same route', async t => {
  const f = fixture(t), oldDialog = await f.open();
  const submitting = f.submit(oldDialog);
  f.navigate('#/projects/another-project/cases');
  assert.equal(oldDialog.isConnected, false);
  assert.equal(f.root.firstElementChild, null);
  assert.equal(f.events.size, 0);
  assert.equal(f.requests.length, 1, 'the dispatched confirmation request remains in flight');
  f.navigate(route);
  const newDialog = await f.open();
  assert.notEqual(newDialog, oldDialog);
  const beforeControls = newDialog.inputsAndButtons.map(item => [...item.disabledWrites]);
  f.settle(0); await submitting;
  assert.deepEqual(f.callbacks, []);
  assert.equal(f.root.firstElementChild, newDialog);
  assert.equal(newDialog.isConnected, true);
  assert.deepEqual(newDialog.inputsAndButtons.map(item => item.disabledWrites), beforeControls);
  assert.equal(f.events.get('hashchange').size, 1, 'the new dialog keeps its own navigation listener');
});

test('a late failure after navigation neither restores detached controls nor overwrites the new modal', async t => {
  const f = fixture(t), oldDialog = await f.open();
  const submitting = f.submit(oldDialog);
  const oldWrites = oldDialog.inputsAndButtons.map(item => [...item.disabledWrites]);
  f.navigate('#/projects/another-project/cases');
  assert.equal(oldDialog.isConnected, false);
  assert.equal(f.root.firstElementChild, null);
  f.navigate(route);
  const newDialog = await f.open();
  const newError = newDialog.controls.get('[data-review-error]');
  newError.textContent = '新弹窗已有提示';
  const beforeControls = newDialog.inputsAndButtons.map(item => [...item.disabledWrites]);
  f.settle(0, false); await submitting;
  assert.deepEqual(f.callbacks, []);
  assert.equal(f.root.firstElementChild, newDialog);
  assert.equal(newDialog.isConnected, true);
  assert.deepEqual(oldDialog.inputsAndButtons.map(item => item.disabledWrites), oldWrites);
  assert.ok(oldDialog.inputsAndButtons.every(item => item.disabled));
  assert.deepEqual(oldDialog.controls.get('[data-review-error]').textWrites, []);
  assert.deepEqual(newDialog.inputsAndButtons.map(item => item.disabledWrites), beforeControls);
  assert.deepEqual(newError.textWrites, ['新弹窗已有提示']);
  assert.equal(f.events.get('hashchange').size, 1);
});
