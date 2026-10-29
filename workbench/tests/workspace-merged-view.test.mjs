import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { workspaceViewHref, workspaceViewsHtml } from '../web-v2/workflow.js';
import { pendingReviewItems } from '../web-v2/case-review.js';
import { renderProjectWorkflow } from '../web-v2/project-workflow.js';

// Run the actual app renderers offline without executing app bootstrap or
// copying their selection/navigation logic into the fixture.
const app = await fs.readFile(new URL('../web-v2/app.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = app.indexOf(start), to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `actual renderer boundaries: ${start}`);
  return app.slice(from, to);
}
const rendererSource = [
  section('function esc(', 'function fmtDate('),
  section('function currentContent(', 'function toast('),
  section('function setSidebarNavigation(', 'function isDirty('),
  section('function filteredCases(', 'async function loadAutomationReadiness('),
  section('async function renderCases(', 'async function exportCases('),
].join('\n');
const project = {
  project_id: 'project-merged', name: '合并工作台', revision: 3,
  cases: ['one', 'two', 'three'].map((case_id, index) => ({
    case_id, external_id: `TC-${index + 1}`, title: `用例 ${case_id}`, module: index < 2 ? '模板' : '收益',
    current_version: 1, versions: [{ version: 1, content_sha256: `sha-${case_id}`, content: {
      external_id: `TC-${index + 1}`, title: `用例 ${case_id}`, module: index < 2 ? '模板' : '收益',
      case_type: index < 2 ? 'UI' : 'BACKEND', status: 'PENDING_CONFIRMATION',
      steps: [{ order: 1, action: '核对页面', expected: '显示所选内容' }],
    } }],
  })),
};
const decode = value => String(value).replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const query = hash => new URLSearchParams(hash.split('?')[1] || '');
const selectedIn = hash => (query(hash).get('selected') || '').split(',').filter(Boolean);

function element(attributes = '') {
  const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], decode(match[2])]));
  const value = {
    dataset: {}, attributes: attrs, value: attrs.value || '', href: attrs.href || '', disabled: /\bdisabled\b/.test(attributes),
    checked: /\bchecked\b/.test(attributes), hidden: /\bhidden\b/.test(attributes), textContent: '', inputs: [],
    setAttribute(key, next) { this.attributes[key] = next; if (key === 'href') this.href = next; },
    addEventListener(name, handler) { this[`on${name}`] = handler; },
    classList: { toggle() {} },
    click() { return this.onclick?.(); },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-pw-case]' ? this.inputs : []; },
  };
  let html = '';
  Object.defineProperty(value, 'innerHTML', {
    get: () => html,
    set: next => {
      html = next;
      value.inputs = [...String(next).matchAll(/<input type="checkbox" data-pw-case="([^"]+)"([^>]*)>/g)].map(match => {
        const input = element(match[2]); input.dataset.pwCase = match[1]; return input;
      });
    },
  });
  return value;
}

function view(hash = '#/projects/project-merged/cases') {
  let nodes = new Map(), checks = [], openButtons = [], html = '';
  const pages = [], reviews = [], navigations = [], replacements = [], queries = [], effects = [], sideNav = element();
  const location = { hash };
  const node = selector => {
    queries.push(selector);
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const document = {
    activeElement: null, querySelector: node, getElementById: id => node(`#${id}`),
    querySelectorAll: selector => selector === '.case-check' ? checks : selector === '[data-open-case]' ? openButtons : [],
  };
  const showPage = content => {
    html = content; pages.push(content); nodes = new Map();
    for (const match of content.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) nodes.set(`#${match[3]}`, element(match[2]));
    checks = [...content.matchAll(/<tr data-case-id="([^"]+)"><td><input\b([^>]*)>/g)].map(match => {
      const input = element(match[2]); input.caseId = match[1]; input.closest = () => ({ dataset: { caseId: match[1] } }); return input;
    });
    openButtons = [...content.matchAll(/<button\b([^>]*data-open-case="([^"]+)"[^>]*)>/g)].map(match => {
      const button = element(match[1]); button.dataset.openCase = match[2]; return button;
    });
  };
  const state = { selected: new Map(), page: 1, pageSize: 2, query: '', module: '', status: '', caseType: '', activeProjectId: project.project_id };
  const context = vm.createContext({
    state, sideNav, document, location, URLSearchParams, Set, Map, encodeURIComponent, decodeURIComponent,
    workspaceViewsHtml, pendingReviewItems, showPage, setBreadcrumb() {},
    history: { replaceState(_state, _title, url) { location.hash = url; replacements.push(url); } },
    openCaseContentReview: async options => { reviews.push(options); },
    go: href => { navigations.push(href); location.hash = href; }, toast: (...args) => effects.push(args),
    exportCases: (...args) => effects.push(args),
  });
  vm.runInContext(rendererSource, context);
  return {
    context, state, sideNav, document, location, node, pages, reviews, navigations, replacements, queries, effects, showPage,
    get html() { return html; },
    get checks() { return checks; },
    selected: () => [...(state.selected.get(project.project_id) || [])],
    render: (value = project) => context.renderCases(value),
  };
}

function confirmed(ids) {
  const updated = structuredClone(project); updated.revision += 1;
  for (const item of updated.cases) if (ids.includes(item.case_id)) {
    item.current_version = 2;
    item.versions.push({ version: 2, content_sha256: `confirmed-${item.case_id}`,
      content: { ...structuredClone(item.versions[0].content), status: 'CONFIRMED' } });
  }
  return updated;
}

test('both compatible views share one sidebar entry and explicit selected-scope tabs', () => {
  const f = view();
  for (const section of ['cases', 'automation', '']) {
    f.context.setSidebarNavigation(project, section);
    const labels = [...f.sideNav.innerHTML.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(match => match[1].replace(/<[^>]*>/g, ''));
    assert.deepEqual(labels, ['← 全部项目', '工作台', '测试记录', '项目设置']);
    assert.doesNotMatch(f.sideNav.innerHTML, /用例库|href="#[^"]*\/cases"/);
    assert.equal((f.sideNav.innerHTML.match(/aria-current="page"/g) || []).length, 1);
    assert.match(f.sideNav.innerHTML, /href="#\/projects\/project-merged" aria-current="page"/);
  }
  const tabs = workspaceViewsHtml(project, 'cases', ['two', 'two', 'one']);
  assert.match(tabs, /id="workspace-cases"[^>]*aria-current="page"/);
  assert.match(tabs, />脚本与运行<\/a>/);
  assert.deepEqual(selectedIn(workspaceViewHref(project.project_id, 'scripts', ['two', 'two', 'one'])), ['two', 'one']);
  assert.equal(query(workspaceViewHref(project.project_id, 'cases', [])).has('selected'), true);
});

test('the case view keeps editing, review and export without duplicate generation or execution actions', async () => {
  const f = view(); await f.render();
  assert.match(f.html, /id="workspace-cases"[^>]*aria-current="page"/);
  assert.match(f.html, /批量核对所选用例/); assert.match(f.html, /导出所选/);
  assert.doesNotMatch(f.html, /<details[^>]*>[\s\S]*高级操作/);
  assert.doesNotMatch(f.html, /<(?:button|a)\b[^>]*>[^<]*(?:生成[^<]*脚本|运行[^<]*用例)/);
  assert.ok(!f.queries.some(selector => /generate|run-selected|automation-run|batch-run/.test(selector)),
    'removed advanced actions must not retain direct handler bindings');
  assert.deepEqual(f.effects, []); assert.deepEqual(f.reviews, []);
});

test('query selections replace stale cached IDs; check, uncheck and clear persist without reviving old scope', async () => {
  const f = view('#/projects/project-merged/cases?selected=one,foreign,one');
  f.state.selected.set(project.project_id, new Set(['three'])); await f.render();
  assert.deepEqual(f.selected(), ['one']);
  assert.equal(f.checks.find(input => input.caseId === 'one').checked, true);
  let two = f.checks.find(input => input.caseId === 'two'); two.checked = true; two.onchange();
  assert.deepEqual(f.selected(), ['one', 'two']); assert.deepEqual(selectedIn(f.location.hash), ['one', 'two']);
  assert.deepEqual(selectedIn(f.node('#workspace-scripts').href), ['one', 'two']);
  const one = f.checks.find(input => input.caseId === 'one'); one.checked = false; one.onchange();
  assert.deepEqual(f.selected(), ['two']); assert.deepEqual(selectedIn(f.location.hash), ['two']);
  f.node('#clear-selection').onclick();
  assert.deepEqual(f.selected(), []); assert.equal(query(f.location.hash).has('selected'), true);
  assert.equal(query(f.location.hash).get('selected'), '');
  f.node('#case-search').oninput({ target: { value: '用例' } });
  f.node('#next-page').onclick(); await f.render();
  assert.deepEqual(f.selected(), []); assert.ok(f.checks.every(input => !input.checked));
  assert.deepEqual(selectedIn(f.node('#workspace-scripts').href), []);
  assert.equal(query(f.node('#workspace-scripts').href).has('selected'), true);
});

test('confirmation without a return route preserves precisely the reviewed selection in the merged view', async () => {
  const f = view('#/projects/project-merged/cases?selected=two'); await f.render();
  f.node('#confirm-selected-content').onclick();
  assert.deepEqual([...f.reviews[0].ids], ['two']); assert.equal(f.reviews[0].isCurrent(), true);
  const updated = confirmed(['two']); await f.reviews[0].onConfirmed(updated);
  assert.equal(f.state.project, updated); assert.deepEqual(f.selected(), ['two']);
  assert.deepEqual(selectedIn(f.node('#workspace-scripts').href), ['two']);
  assert.match(f.html, /批量核对所选用例（0）/);
  assert.deepEqual(f.navigations, []);
});

for (const returnQuery of ['prepare=ui', 'prepare=ui&selected=']) test(`confirmation adds the reviewed scope when the return route has ${returnQuery.includes('selected') ? 'an empty scope' : 'no scope'}`, async () => {
  const back = `#/projects/project-merged?${returnQuery}`;
  const f = view(`#/projects/project-merged/cases?selected=two&return=${encodeURIComponent(back)}`);
  await f.render(); f.node('#confirm-selected-content').onclick(); await f.reviews[0].onConfirmed(confirmed(['two']));
  assert.equal(f.navigations.length, 1);
  assert.deepEqual(selectedIn(f.navigations[0]), ['two'], 'review must not return to an unbounded whole-project generation scope');
  assert.equal(query(f.navigations[0]).get('prepare'), 'ui');
});

test('confirmation preserves a frozen return scope containing ready siblings as well as the blocked reviewed case', async () => {
  const back = '#/projects/project-merged?prepare=ui&selected=one,two';
  const f = view(`#/projects/project-merged/cases?selected=two&return=${encodeURIComponent(back)}`);
  await f.render(); f.node('#confirm-selected-content').onclick();
  assert.deepEqual([...f.reviews[0].ids], ['two']);
  await f.reviews[0].onConfirmed(confirmed(['two']));
  assert.deepEqual(selectedIn(f.navigations[0]), ['one', 'two'], 'the already ready sibling must not be silently discarded');
});

test('review-all with no explicit selection seeds the current filter rather than a stale selection from another visit', async () => {
  const f = view(`#/projects/project-merged/cases?review=all&module=${encodeURIComponent('模板')}`);
  f.state.selected.set(project.project_id, new Set(['three'])); await f.render();
  assert.deepEqual(f.selected(), ['one', 'two']);
  assert.deepEqual([...f.reviews[0].ids], ['one', 'two']); assert.equal(f.reviews[0].isCurrent(), true);
  assert.equal(query(f.location.hash).has('review'), false);
  await f.reviews[0].onConfirmed(confirmed(['one', 'two']));
  assert.deepEqual(f.selected(), ['one', 'two']);
  assert.deepEqual(selectedIn(f.node('#workspace-scripts').href), ['one', 'two']);
});

test('the scripts view receives the selected cases and updates the cases-tab destination as selection changes', async t => {
  const saved = Object.fromEntries(['fetch', 'document', 'window', 'location'].map(key => [key, {
    exists: Object.hasOwn(globalThis, key), value: globalThis[key],
  }]));
  let dispose;
  t.after(() => {
    dispose?.();
    for (const [key, previous] of Object.entries(saved)) {
      if (previous.exists) globalThis[key] = previous.value; else delete globalThis[key];
    }
  });
  const f = view('#/projects/project-merged?selected=one,two'), requests = [], launches = [];
  const readyProject = confirmed(['one', 'two', 'three']);
  globalThis.document = f.document; globalThis.location = f.location;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options }); let body = {};
    if (url.endsWith('/environment')) body = { ui: { id: 'ui-env', ready: true }, ui_environment_id: 'ui-env', backend: { id: 'be-env' } };
    else if (url.endsWith('/script-operations/preflight')) body = { items: JSON.parse(options.body).items.map(item => ({ ...item, state: 'QUEUED' })) };
    else if (url.endsWith('/batches/preflight')) body = { items: readyProject.cases.map(item => ({ case_id: item.case_id, case_version: 2, state: 'QUEUED' })) };
    else if (url.includes('/preparation')) body = { items: [], protocols: [] };
    else if (url.endsWith('/generation-batches')) body = { batches: [] };
    else if (url.endsWith('/script-operations')) body = { operations: [] };
    else if (url.endsWith('/backend')) body = { plans: [] };
    else throw Error(`Unexpected offline request: ${url}`);
    return { ok: true, status: 200, json: async () => body };
  };
  dispose = await renderProjectWorkflow({ project: readyProject, showPage: f.showPage,
    launchBatch: (...args) => launches.push(args), go() {} });
  assert.match(f.html, /id="workspace-scripts"[^>]*aria-current="page"/);
  assert.deepEqual(selectedIn(f.node('#workspace-cases').href), ['one', 'two']);
  let inputs = f.node('#pw-run-table').inputs;
  assert.deepEqual(inputs.filter(input => input.checked).map(input => input.dataset.pwCase), ['one', 'two']);
  const one = inputs.find(input => input.dataset.pwCase === 'one'); one.checked = false; one.onchange();
  assert.deepEqual(selectedIn(f.node('#workspace-cases').href), ['two']);
  inputs = f.node('#pw-run-table').inputs;
  const two = inputs.find(input => input.dataset.pwCase === 'two'); two.checked = false; two.onchange();
  assert.deepEqual(selectedIn(f.node('#workspace-cases').href), []);
  assert.equal(query(f.node('#workspace-cases').href).has('selected'), true);
  f.location.hash = f.node('#workspace-cases').href;
  f.state.selected.set(project.project_id, new Set(['three'])); await f.render(readyProject);
  assert.deepEqual(f.selected(), [], 'returning through an explicitly empty tab cannot resurrect a cached library scope');
  assert.deepEqual(launches, []);
  assert.ok(!requests.some(request => request.options.method === 'POST' && /\/script-operations$|\/generation-batches$/.test(request.url)));
});
