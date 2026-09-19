import { fail, semanticHash, uid } from './common.mjs';
import { runtimeLocator } from './row-locator.mjs';

// Bounded invariance for ONE observed native table only. Multi-table/object
// scoping is deliberately unsupported. Evidence is runtime-owned, not a literal oracle.
const baselines = new WeakMap();
const limits = Object.freeze({ rows: 50, columns: 20, cells: 200, text: 4096 });

export function needsTableBaseline(originalExpected) {
  if (typeof originalExpected !== 'string') return false;
  return originalExpected.split(/[；;。.!?！？\n]/u).some((clause) => {
    if (!/(?:表格|列表|\b(?:table|list)\b)/iu.test(clause)) return false;
    // Explicit same-step temporal equality is the same existing capability,
    // not equality to a reference document, previous step, or observed values.
    // A conditional/example/alternative is not an unconditional invariant.
    if (/如果|假如|若|否则|可能|例如|比如|或|不成立/u.test(clause)) return false;
    const preActionEquality =
      /(?:表格|列表)(?:内容|数据)?(?:仍|应|必须)?(?:与|和)(?:本步骤|当前步骤)?操作前(?:保持)?(?:完全)?(?:一致|相同)/u.test(
        clause,
      );
    if (preActionEquality) {
      if (/不要求|无需|无须|不需要|不保证|不应|不必|不要|并非|不是|不一定/u.test(clause))
        return false;
      return true;
    }
    // Negative/optional invariance is not authorization to assert equality.
    if (
      /(?:不要求|无需|不需要|不保证|不能|不应|不再|并非|不是|未能|不必|不要|不会|不一定|不保持).{0,12}(?:不变|保持|原样|原状)|(?:不变|保持原样|保持原状)(?:的)?(?:不成立|并非要求)|\b(?:not|never|need\s+not|does\s+not)\b.{0,20}\bunchanged\b/iu.test(
        clause,
      )
    )
      return false;
    return /(?:不变|保持(?:原样|原状)|不(?:应)?应用(?:新)?条件|未应用(?:新)?条件)|\bunchanged\b/iu.test(
      clause,
    );
  });
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// Install only this fixed collector, not model code. The assertion kernel calls
// it inside its existing single-turn, mutation-epoch-checked group sample.
export async function installTableInvariantSampler(page, key) {
  await page.evaluate(
    ({ key, limits }) => {
      const state = window[key] ?? (window[key] = { revision: 0 });
      if (!state.observer) {
        state.observer = new MutationObserver(() => state.revision++);
        state.observer.observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      }
      state.sampleTable = (table) => {
        const invalid = (error) => ({ error });
        const measurable = (node) => {
          if (!node?.isConnected || node.closest('[hidden],[inert],[aria-hidden="true"]'))
            return false;
          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            if (
              style.display === 'none' ||
              ['hidden', 'collapse'].includes(style.visibility) ||
              Number(style.opacity) === 0
            )
              return false;
          }
          return true;
        };
        if (table?.tagName !== 'TABLE') return invalid('TABLE_STRUCTURE_UNSUPPORTED');
        if (
          !measurable(table) ||
          table.querySelector(
            'table,[aria-rowindex],[aria-colindex],[aria-rowcount],[aria-colcount],input,select,textarea,[contenteditable="true"]',
          ) ||
          ['aria-rowcount', 'aria-colcount', 'aria-rowindex', 'aria-colindex'].some((a) =>
            table.hasAttribute(a),
          ) ||
          table.tFoot?.rows.length
        )
          return invalid('TABLE_STRUCTURE_UNSUPPORTED');
        const headerRows = table.tHead
          ? [...table.tHead.rows]
          : [...table.rows].filter(
              (r) => r.cells.length && [...r.cells].every((c) => c.tagName === 'TH'),
            );
        // Unlike table_cells, NEVER filter hidden rows out of an invariant sample.
        const rows = [...table.tBodies]
          .flatMap((b) => [...b.rows])
          .filter((r) => !headerRows.includes(r));
        if (
          headerRows.length !== 1 ||
          !headerRows[0].cells.length ||
          [...table.rows].some(
            (r) =>
              !measurable(r) ||
              [...r.cells].some((c) => !measurable(c) || c.rowSpan !== 1 || c.colSpan !== 1),
          )
        )
          return invalid('TABLE_STRUCTURE_UNSUPPORTED');
        const headers = [...headerRows[0].cells].map((c) => c.innerText.trim());
        if (
          rows.length > limits.rows ||
          headers.length > limits.columns ||
          rows.length * headers.length > limits.cells
        )
          return invalid('TABLE_SAMPLE_LIMIT');
        if (headers.some((h) => !h) || new Set(headers).size !== headers.length)
          return invalid('TABLE_COLUMN_IDENTITY_INVALID');
        if (rows.some((r) => r.cells.length !== headers.length))
          return invalid('TABLE_STRUCTURE_UNSUPPORTED');
        const matrix = {
          headers,
          rows: rows.map((r) => [...r.cells].map((c) => c.innerText.trim())),
        };
        if ([...headers, ...matrix.rows.flat()].some((text) => text.length > limits.text))
          return invalid('TABLE_SAMPLE_LIMIT');
        return matrix;
      };
    },
    { key, limits },
  );
}

export async function captureTableBaselines(page, current, { run_id, step_id } = {}) {
  if (typeof run_id !== 'string' || !run_id || typeof step_id !== 'string' || !step_id)
    fail('TABLE_BASELINE_SCOPE_REQUIRED');
  const targets = new Map();
  for (const control of current?.controls ?? []) {
    if (control.role !== 'table' || !control.locator) continue;
    const target = structuredClone(control.locator);
    targets.set(semanticHash(target), target);
  }
  if (!targets.size) fail('TABLE_BASELINE_TABLE_REQUIRED');
  if (targets.size !== 1) fail('TABLE_BASELINE_TABLE_NOT_UNIQUE');
  const key = '__ui_table_baseline_' + uid().replaceAll('-', '');
  const handles = [];
  try {
    await installTableInvariantSampler(page, key);
    const before = await page.evaluate(
      (key) => ({ revision: window[key].revision, url: location.href }),
      key,
    );
    for (const target of targets.values()) {
      const matches = await runtimeLocator(page, target).elementHandles();
      handles.push(...matches);
      if (matches.length !== 1) fail('TABLE_BASELINE_TABLE_NOT_UNIQUE');
    }
    const sample = await page.evaluate(
      ({ key, before, handles }) => {
        if (
          !window[key] ||
          before.url !== location.href ||
          before.revision !== window[key].revision ||
          handles.some((h) => !h.isConnected)
        )
          return { error: 'TABLE_BASELINE_SAMPLE_UNSTABLE' };
        return {
          fullURL: location.href,
          at: new Date().toISOString(),
          matrices: handles.map(window[key].sampleTable),
        };
      },
      { key, before, handles },
    );
    if (sample.error) fail(sample.error);
    for (const matrix of sample.matrices) if (matrix.error) fail(matrix.error);
    const tables = [...targets].map(([locator_hash, target]) => ({ locator_hash, target }));
    const token = freeze({ run_id, step_id, captured_at: sample.at, tables });
    baselines.set(token, {
      page,
      fullURL: sample.fullURL,
      matrices: freeze(sample.matrices),
      failures: new Map(),
    });
    return token;
  } finally {
    await Promise.allSettled(handles.map((h) => h.dispose()));
    await page
      .evaluate((key) => {
        window[key]?.observer.disconnect();
        delete window[key];
      }, key)
      .catch(() => {});
  }
}

export function assertTableBaselineScope(token, page, { run_id, step_id } = {}) {
  const state = token && baselines.get(token);
  if (!state) fail('TABLE_BASELINE_REQUIRED');
  if (!run_id || !step_id) fail('TABLE_BASELINE_SCOPE_REQUIRED');
  if (state.page !== page || token.run_id !== run_id || token.step_id !== step_id)
    fail('TABLE_BASELINE_SCOPE_MISMATCH');
  if (page.url() !== state.fullURL) fail('TABLE_BASELINE_URL_CHANGED');
  return state;
}

export function requireTableBaseline(token, page, scope, target) {
  const state = assertTableBaselineScope(token, page, scope);
  const index = token.tables.findIndex((table) => table.locator_hash === semanticHash(target));
  if (index < 0) fail('TABLE_BASELINE_LOCATOR_MISMATCH');
  return { state, index };
}

// Positional equality is intentional: row/column movement is itself a change.
// Never coerce numeric display strings or ignore extra columns.
export function compareTableBaseline(token, page, scope, target, actual, fullURL) {
  const { state, index } = requireTableBaseline(token, page, scope, target);
  if (fullURL !== state.fullURL) fail('TABLE_BASELINE_URL_CHANGED');
  const before = state.matrices[index],
    differences = [];
  if (actual.headers.length !== before.headers.length)
    differences.push({
      reason: 'column_count_changed',
      expected: before.headers.length,
      actual: actual.headers.length,
    });
  if (actual.rows.length !== before.rows.length)
    differences.push({
      reason: 'row_count_changed',
      expected: before.rows.length,
      actual: actual.rows.length,
    });
  for (let column = 0; column < Math.max(before.headers.length, actual.headers.length); column++) {
    if (before.headers[column] !== actual.headers[column])
      differences.push({
        column_index: column,
        reason: 'column_changed',
        expected: before.headers[column] ?? null,
        actual: actual.headers[column] ?? null,
      });
  }
  for (let row = 0; row < Math.max(before.rows.length, actual.rows.length); row++) {
    for (
      let column = 0;
      column < Math.max(before.headers.length, actual.headers.length);
      column++
    ) {
      const expected = before.rows[row]?.[column] ?? null,
        value = actual.rows[row]?.[column] ?? null;
      if (expected !== value)
        differences.push({
          row_index: row,
          column_index: column,
          column: before.headers[column] ?? actual.headers[column],
          reason: 'cell_changed',
          expected,
          actual: value,
        });
    }
  }
  const comparison = {
    passed: differences.length === 0,
    invalid: false,
    differences,
    checked_cells: before.rows.length * before.headers.length,
    before,
    after: actual,
    baseline_at: token.captured_at,
    run_id: token.run_id,
    step_id: token.step_id,
    locator_hash: token.tables[index].locator_hash,
    url_hash: semanticHash(state.fullURL),
    scope: 'sampled_after_each_action',
  };
  if (!comparison.passed && !state.failures.has(index))
    state.failures.set(index, freeze(comparison));
  // Once observed, a mismatch cannot be erased by restoring the table/retrying.
  return state.failures.get(index) ?? comparison;
}
