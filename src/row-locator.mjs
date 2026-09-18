import { handoffLocator } from '../vendor/manual-ui/handoff_runtime.mjs';
import { validateLocator } from './plans.mjs';
import { fail } from './common.mjs';
import { withinHandles } from './within-locator.mjs';
import { caseNamedHandles } from './wizard-binding.mjs';

export const isRowLocator = (l) => ['row', 'cell'].includes(l?.kind);

// Fixed, read-only DOM algorithm. No selector/code supplied by the model is executed here.
function rowState(table, spec) {
  const visible = (e) =>
    !!e?.isConnected &&
    !!e.getClientRects().length &&
    !e.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !['hidden', 'collapse'].includes(getComputedStyle(e).visibility);
  if (table.tagName !== 'TABLE') return { error: 'ROW_TABLE_UNSUPPORTED' };
  if (!visible(table)) return { missing: true };
  const bodyRows = [...table.tBodies].flatMap((b) => [...b.rows]);
  const headerRows = table.tHead
    ? [...table.tHead.rows]
    : [...table.rows].filter(
        (r) => [...r.cells].length && [...r.cells].every((c) => c.tagName === 'TH'),
      );
  if (
    headerRows.length !== 1 ||
    table.querySelector('table') ||
    table.querySelector('[aria-rowindex]') ||
    table.hasAttribute('aria-rowcount') ||
    [...table.rows].some((r) => [...r.cells].some((c) => c.colSpan !== 1 || c.rowSpan !== 1))
  )
    return { error: 'ROW_TABLE_UNSUPPORTED' };
  const headers = [...headerRows[0].cells].map((c) => c.innerText.trim());
  const columnIndex = (name) => headers.reduce((out, v, i) => (v === name ? [...out, i] : out), []);
  const keyColumns = columnIndex(spec.key.column);
  if (keyColumns.length !== 1) return { error: 'ROW_COLUMN_NOT_UNIQUE' };
  const rows = bodyRows.filter((r) => r !== headerRows[0] && visible(r));
  if (rows.some((r) => r.cells.length !== headers.length))
    return { error: 'ROW_TABLE_UNSUPPORTED' };
  const matches = rows.filter(
    (r) =>
      visible(r.cells[keyColumns[0]]) && r.cells[keyColumns[0]].innerText.trim() === spec.key.value,
  );
  if (matches.length > 1) return { error: 'ROW_KEY_NOT_UNIQUE' };
  if (!matches.length) return { missing: true };
  const row = matches[0];
  let cell = null;
  if (spec.kind === 'cell') {
    const columns = columnIndex(spec.column);
    if (columns.length !== 1) return { error: 'ROW_COLUMN_NOT_UNIQUE' };
    cell = row.cells[columns[0]];
  }
  return { row, cell, keyIndex: keyColumns[0], index: bodyRows.indexOf(row) };
}

async function scopedHandles(page, spec) {
  const tableLocator = handoffLocator(page, spec.table);
  const tables = await tableLocator.elementHandles();
  let stateHandle, rootHandle;
  let result = [];
  try {
    if (tables.length > 1) fail('ROW_TABLE_NOT_UNIQUE');
    if (!tables.length) return [];
    stateHandle = await tables[0].evaluateHandle(rowState, spec);
    const status = await stateHandle.evaluate((s) => ({
      error: s.error,
      missing: s.missing,
      index: s.index,
    }));
    if (status.error) fail(status.error);
    if (status.missing) return [];
    const rowHandle = await stateHandle.getProperty('row');
    rootHandle = rowHandle.asElement();
    if (!rootHandle) {
      await rowHandle.dispose();
      fail('ROW_SCOPE_CHANGED');
    }
    if (spec.kind === 'cell') {
      const cell = await stateHandle.getProperty('cell');
      const element = cell.asElement();
      if (!element) {
        await cell.dispose();
        fail('ROW_SCOPE_CHANGED');
      }
      result = [element];
    } else if (!spec.target) {
      result = [rootHandle];
      rootHandle = null;
    } else {
      // nth is a temporary snapshot index, NEVER the approved business identity.
      // Prove both the row and resulting targets still belong to the captured nodes.
      const rowLocator = tableLocator.locator(':scope > tbody > tr').nth(status.index);
      const currentRows = await rowLocator.elementHandles();
      try {
        if (
          currentRows.length !== 1 ||
          !(await currentRows[0].evaluate((e, original) => e === original, rootHandle))
        )
          fail('ROW_SCOPE_CHANGED');
      } finally {
        await Promise.allSettled(currentRows.map((h) => h.dispose()));
      }
      result = await handoffLocator(rowLocator, spec.target).elementHandles();
      if (result.length > 1) fail('ROW_TARGET_NOT_UNIQUE');
    }
    for (const element of result) {
      if (
        !(await stateHandle.evaluate(
          (s, { element, table, spec }) => {
            const row = s.row;
            return (
              table.isConnected &&
              row.isConnected &&
              element.isConnected &&
              row.closest('table') === table &&
              (element === row || element.closest('tr') === row) &&
              (!s.cell || element === s.cell) &&
              row.cells[s.keyIndex]?.innerText.trim() === spec.key.value
            );
          },
          { element, table: tables[0], spec },
        ))
      )
        fail('ROW_SCOPE_CHANGED');
    }
    return result;
  } catch (error) {
    await Promise.allSettled(result.map((h) => h.dispose()));
    throw error;
  } finally {
    await rootHandle?.dispose();
    await stateHandle?.dispose();
    await Promise.allSettled(tables.map((h) => h.dispose()));
  }
}

// Compatibility surface used by observation, discovery, actions and atomic assertions.
export function runtimeLocator(page, spec) {
  if (!isRowLocator(spec) && !['within', 'case_named'].includes(spec?.kind))
    return handoffLocator(page, spec);
  validateLocator(spec);
  const handlesFor = () =>
    spec.kind === 'case_named'
      ? caseNamedHandles(page, spec)
      : spec.kind === 'within'
        ? withinHandles(page, spec)
        : scopedHandles(page, spec);
  const use = async (fn) => {
    const handles = await handlesFor();
    try {
      return await fn(handles);
    } finally {
      await Promise.allSettled(handles.map((h) => h.dispose()));
    }
  };
  return {
    elementHandles: handlesFor,
    async elementHandle() {
      const handles = await handlesFor();
      if (handles.length <= 1) return handles[0] ?? null;
      await Promise.allSettled(handles.map((h) => h.dispose()));
      fail('ROW_TARGET_NOT_UNIQUE');
    },
    count: () => use((h) => h.length),
    isVisible: () => use(async (h) => h.length === 1 && (await h[0].isVisible())),
    isEnabled: () => use(async (h) => h.length === 1 && (await h[0].isEnabled())),
    evaluate: (fn, arg) =>
      use((h) => {
        if (h.length !== 1) fail('ROW_TARGET_NOT_UNIQUE');
        return h[0].evaluate(fn, arg);
      }),
    async waitFor({ state = 'visible', timeout = 8000 } = {}) {
      const deadline = Date.now() + timeout;
      do {
        const matched = await use(async (h) =>
          state === 'hidden'
            ? !h.length || !(await h[0].isVisible())
            : h.length === 1 && (await h[0].isVisible()),
        );
        if (matched) return;
        await new Promise((r) => setTimeout(r, Math.min(50, Math.max(0, deadline - Date.now()))));
      } while (Date.now() < deadline);
      fail('LOCATOR_NOT_VISIBLE');
    },
  };
}

export async function assertRowIdentity(page, spec, original) {
  if (!isRowLocator(spec) && !['within', 'case_named'].includes(spec?.kind)) return;
  const current = runtimeLocator(page, spec);
  if (
    !original ||
    (await current.count()) !== 1 ||
    !(await current.evaluate((element, old) => element === old && old.isConnected, original))
  )
    fail(
      spec.kind === 'case_named'
        ? 'CASE_NAMED_CONTEXT_CHANGED'
        : spec.kind === 'within'
          ? 'WITHIN_SCOPE_CHANGED'
          : 'ROW_SCOPE_CHANGED',
    );
}
