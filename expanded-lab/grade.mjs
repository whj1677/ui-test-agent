// Read-only product evidence inspection. Never calls a model or changes task state.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stepOutcome } from '../public/evidence-view.js';

export function classify(expected, record, facts, source) {
  if (!record) return 'NOT_STARTED';
  if (expected === 'REVIEW') {
    if (facts.length) return 'UNEXPECTED_EXECUTION';
    return record.status === 'NEEDS_REVIEW' && record.issues?.length
      ? 'REVIEW_RECORDED'
      : 'REVIEW_NOT_ESTABLISHED';
  }
  if (!facts.length)
    return record.status === 'RUNNING'
      ? 'RUNNING'
      : record.plan
        ? 'PLANNED_NOT_EXECUTED'
        : 'NOT_EXECUTED';
  const f = facts.at(-1);
  if (expected === 'FAIL_ASSERTION') {
    if (f.status === 'PASS_ASSERTIONS') return 'FALSE_PASS';
    if (f.status === 'FAIL_ASSERTION' && f.assertions?.some((a) => a.passed === false))
      return 'DIFFERENCE_REQUIRES_TARGET_REVIEW';
    return 'TECHNICAL_BLOCK_NOT_DETECTION';
  }
  if (f.status === 'FAIL_ASSERTION') return 'UNEXPECTED_ASSERTION_FAILURE';
  if (f.status !== 'PASS_ASSERTIONS') return 'TECHNICAL_BLOCK';
  if (!source.steps.every((s) => stepOutcome(f, s.step_id).status === 'PASS'))
    return 'INCOMPLETE_PASS_RECORD';
  return 'COMPLETE_PASS_RECORDED';
}

async function grade() {
  const ledger = JSON.parse(
    await fs.readFile(new URL('../validation/req0017/v9-budget.json', import.meta.url), 'utf8'),
  );
  const sets = await Promise.all(
    [
      'manual-lab/cases/01-valid.json',
      'manual-lab/cases/02-needs-review.json',
      'manual-lab/cases/03-known-defects.json',
      'expanded-lab/cases.json',
    ].map(
      async (p) => JSON.parse(await fs.readFile(new URL('../' + p, import.meta.url), 'utf8')).cases,
    ),
  );
  const contrast = JSON.parse(
    await fs.readFile(new URL('./oracle.json', import.meta.url), 'utf8'),
  ).cases;
  const all = sets.flat();
  if (all.length !== 32) throw Error('MATRIX_CHANGED');
  const base = 'http://127.0.0.1:4179';
  const get = async (p) => {
    const r = await fetch(base + p);
    if (!r.ok) throw Error('HTTP_' + r.status);
    return r.json();
  };
  const states = [];
  for (const task of ledger.tasks) {
    if (!/^[a-f0-9-]{36}$/.test(task.id)) throw Error('INVALID_TASK_ID');
    const [state, facts, baseline] = await Promise.all([
      get('/api/tasks/' + task.id),
      get('/api/tasks/' + task.id + '/facts'),
      get('/api/tasks/' + task.id + '/baseline'),
    ]);
    for (const c of baseline.cases) {
      const source = all.find((x) => x.case_id === c.case_id);
      if (!source) throw Error('UNEXPECTED_CASE');
      for (const field of ['data', 'preconditions', 'page_entry_url'])
        if (JSON.stringify(source[field]) !== JSON.stringify(c[field]))
          throw Error('ORIGINAL_CHANGED:' + c.case_id + ':' + field);
      if (
        source.steps.length !== c.steps.length ||
        source.steps.some((s, i) =>
          ['step_id', 'action', 'expected'].some((k) => s[k] !== c.steps[i][k]),
        )
      )
        throw Error('ORIGINAL_STEPS_CHANGED:' + c.case_id);
    }
    for (const f of facts) {
      const src = all.find((x) => x.case_id === f.case_id);
      if (
        !src ||
        !f.executed_case ||
        src.steps.length !== f.executed_case.steps.length ||
        src.steps.some((s, i) =>
          ['step_id', 'action', 'expected'].some((k) => s[k] !== f.executed_case.steps[i][k]),
        )
      )
        throw Error('EXECUTED_CASE_CHANGED');
      for (const m of f.media ?? []) {
        if (path.basename(m.file) !== m.file || !/^[-a-f0-9]{36}$/.test(f.id))
          throw Error('INVALID_MEDIA_PATH');
        const bytes = await fs.readFile(
          new URL(`../data/v02/tasks/${task.id}/runs/${f.id}/${m.file}`, import.meta.url),
        );
        if (createHash('sha256').update(bytes).digest('hex') !== m.sha256)
          throw Error('MEDIA_HASH_MISMATCH');
      }
    }
    states.push({ task, state, facts });
  }
  const rows = all.map((c) => {
    const matches = states.filter((x) => x.state.cases.some((r) => r.case_id === c.case_id));
    if (matches.length > 1) throw Error('DUPLICATE_CASE_ATTEMPTS_REQUIRE_SEPARATE_ROUND');
    const s = matches[0],
      r = s?.state.cases.find((x) => x.case_id === c.case_id),
      facts = s?.facts.filter((f) => f.case_id === c.case_id) ?? [];
    const expected = c.case_id.startsWith('LAB-R')
      ? 'REVIEW'
      : c.case_id.startsWith('LAB-B')
        ? 'FAIL_ASSERTION'
        : (contrast.find((x) => x.id === c.case_id)?.expected ?? 'PASS_ASSERTIONS');
    return {
      id: c.case_id,
      title: c.title,
      expected,
      task_id: s?.task.id,
      status: r?.status ?? 'NOT_STARTED',
      classification: classify(expected, r, facts, c),
      issues: r?.issues ?? [],
      mapping_reason: r?.mapping_reason,
      steps_total: c.steps.length,
      steps_complete:
        facts.at(-1)?.adaptive_steps?.filter((s) => s.status === 'COMPLETE').length ?? 0,
      assertions: facts.reduce((n, f) => n + (f.assertions?.length ?? 0), 0),
      media: facts.reduce((n, f) => n + (f.media?.length ?? 0), 0),
      original_unchanged: !!s,
      media_sha_verified: !!facts.length,
      runs: facts.map((f) => ({
        id: f.id,
        status: f.status,
        error: f.error,
        failed_assertions: f.assertions
          ?.filter((a) => a.passed === false)
          .map((a) => ({
            step_id: a.step_id,
            check: a.check,
            target: a.target,
            expected: a.expected,
            actual: a.actual,
          })),
      })),
    };
  });
  const summary = {
    captured_at: new Date().toISOString(),
    cases: 32,
    logical_calls: ledger.calls,
    active_tasks: states.filter((x) => x.state.active).map((x) => x.task.id),
    counts: Object.fromEntries(
      [...new Set(rows.map((r) => r.classification))].map((k) => [
        k,
        rows.filter((r) => r.classification === k).length,
      ]),
    ),
    rows,
  };
  await fs.writeFile(
    new URL('../validation/req0017/v9-product-results.json', import.meta.url),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    JSON.stringify({
      captured_at: summary.captured_at,
      cases: 32,
      calls: summary.logical_calls,
      active: summary.active_tasks,
      counts: summary.counts,
    }),
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await grade();
