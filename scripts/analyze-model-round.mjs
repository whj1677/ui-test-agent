// Maintenance-only, read-only analysis. Never sends prompts or changes stored facts.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const list = value => Array.isArray(value) ? value : [];
export function classifyRequest(record, reply) {
  const input = record.input ?? {};
  const correction = input.review_correction ?? input.correction;
  const code = correction?.code ?? null;
  const reasons = list(correction?.audit?.issues).map(x => x.reason ?? '');
  const referenceCarrier = reasons.some(x => /未在候选中绑定义务|未知.*引用|重复.*引用/u.test(x));
  let category;
  if (input.review_correction) category = 'format_reference_repair';
  else if (input.partial_assertion_review) category = 'partial_assertion_review';
  else if (record.phase === 'adaptive_audit') {
    const fragment = input.current_fragment;
    category = input.complete === true && fragment &&
      Array.isArray(fragment.actions) && Array.isArray(fragment.assertions) &&
      !fragment.actions.length && !fragment.assertions.length &&
      list(input.previous).length > 0
      ? 'completion_verification' : 'candidate_review';
  } else if (record.phase === 'adaptive_plan') {
    if (code && (/^(PROTOCOL_|ADAPTIVE_PROTOCOL_|ADAPTIVE_REFERENCE_|ADAPTIVE_SOURCE_|INVALID_)/u.test(code) ||
      code === 'DEEPSEEK_JSON_INVALID' || referenceCarrier)) category = 'format_reference_repair';
    else if (input.repair_focus || (code && /UNPROVEN|INCOMPLETE/u.test(code)))
      category = 'missing_assertion_supplement';
    else if (input.repair_assertions) category = 'assertion_binding_repair';
    else if (correction) category = 'semantic_candidate_repair';
    else if (list(input.previous).some(x => list(x.assertions).length) &&
      list(input.progress?.remaining_obligations).length &&
      Array.isArray(reply?.actions) && !reply.actions.length && list(reply?.assertions).length)
      category = 'incremental_assertion_planning';
    else category = 'ordinary_planning';
  } else category = record.phase === 'input_review' ? 'input_review' : 'other';
  return { category, correction_code: code,
    classification_basis: referenceCarrier ? 'program_feedback_text_marker' : 'structured_request_fields',
    tags: {
      has_correction: !!correction, has_repair_focus: !!input.repair_focus,
      complete_candidate: input.complete === true,
      candidate_issues: list(correction?.candidate_issues).map(x => x.code),
    } };
}

function aggregate(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const label = row[key] ?? 'unknown';
    if (!groups.has(label)) groups.set(label, {
      label, calls: 0, transport_attempts: 0, transport_ms: 0,
      latency_ms: 0, missing_latency_calls: 0, missing_transport_calls: 0,
      prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, missing_usage_calls: 0,
      prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 0, missing_cache_usage_calls: 0,
    });
    const group = groups.get(label);
    group.calls++;
    group.transport_attempts += row.transport_attempts;
    if (row.transport_ms === null) group.missing_transport_calls++;
    else group.transport_ms += row.transport_ms;
    if (row.latency_ms === null) group.missing_latency_calls++;
    else group.latency_ms += row.latency_ms;
    if (!row.usage || !['prompt_tokens', 'completion_tokens', 'total_tokens'].every(k => finite(row.usage[k])))
      group.missing_usage_calls++;
    for (const k of ['prompt_tokens', 'completion_tokens', 'total_tokens'])
      if (finite(row.usage?.[k])) group[k] += row.usage[k];
    if (!['prompt_cache_hit_tokens', 'prompt_cache_miss_tokens'].every(k => finite(row.usage?.[k])))
      group.missing_cache_usage_calls++;
    for (const k of ['prompt_cache_hit_tokens', 'prompt_cache_miss_tokens'])
      if (finite(row.usage?.[k])) group[k] += row.usage[k];
  }
  return [...groups.values()].sort((a, b) => b.transport_ms - a.transport_ms);
}

export function analyzeRecords(records) {
  const requests = new Map();
  for (const r of records.filter(x => x.type === 'MODEL_REQUEST')) {
    if (!r.request_id || requests.has(r.request_id)) throw Error('DUPLICATE_OR_MISSING_REQUEST_ID');
    requests.set(r.request_id, r);
  }
  const rows = [];
  for (const [id, request] of requests) {
    const related = records.filter(r => r.request_id === id);
    const started = related.filter(r => r.type === 'MODEL_TRANSPORT_STARTED');
    const finished = related.filter(r => r.type === 'MODEL_TRANSPORT_FINISHED');
    if (new Set(started.map(r => r.attempt)).size !== started.length ||
      new Set(finished.map(r => r.attempt)).size !== finished.length) throw Error('DUPLICATE_TRANSPORT_ATTEMPT');
    const response = related.filter(r => ['MODEL_RESPONSE_PARSED', 'MODEL_RESPONSE_REJECTED'].includes(r.type));
    if (response.length > 1) throw Error('MULTIPLE_LOGICAL_RESPONSES');
    const providers = related.filter(r => r.type === 'MODEL_PROVIDER_RESULT');
    if (providers.length > 1) throw Error('MULTIPLE_PROVIDER_RESULTS');
    const end = providers[0] ?? response[0] ?? related.find(r => r.type === 'MODEL_DECISION');
    const startAt = Date.parse(request.at), endAt = Date.parse(end?.at);
    rows.push({
      request_id: id, case_id: request.case_id, phase: request.phase,
      step_id: request.input?.step?.step_id ?? request.input?.original?.steps?.[0]?.step_id ?? null,
      ...classifyRequest(request, response[0]?.parsed_value ?? providers[0]?.parsed_value),
      prompt_chars: typeof request.prompt === 'string' ? request.prompt.length : null,
      input_chars: request.input ? JSON.stringify(request.input).length : null,
      observation_count: Array.isArray(request.input?.pages) ? request.input.pages.length : (request.input?.current ? 1 : 0),
      prior_segments: list(request.input?.previous).length,
      started_at: request.at,
      latency_ms: Number.isFinite(startAt) && Number.isFinite(endAt) && endAt >= startAt ? endAt - startAt : null,
      transport_attempts: started.length,
      transport_ms: started.length && finished.length === started.length &&
        finished.every(r => finite(r.duration_ms)) ? finished.reduce((sum, r) => sum + r.duration_ms, 0) : null,
      usage: response[0]?.usage ?? providers[0]?.usage ?? null,
      response_error: response[0]?.error_code ?? null,
    });
  }
  const orphanRecords = records.filter(r => /^MODEL_TRANSPORT_|^MODEL_RESPONSE_|^MODEL_PROVIDER_RESULT$/u.test(r.type ?? '') &&
    r.request_id && !requests.has(r.request_id)).length;
  return { rows, by_category: aggregate(rows, 'category'), by_phase: aggregate(rows, 'phase'),
    by_case: aggregate(rows, 'case_id'), logical_calls: rows.length, orphan_records: orphanRecords };
}

export async function analyzeRound(directory) {
  const round = JSON.parse(await fs.readFile(path.join(directory, 'round.json'), 'utf8'));
  if (!round.tasks?.length || round.tasks.some(t => !t.finished_at)) throw Error('ROUND_NOT_FINISHED');
  const records = [], recording = [];
  for (const task of round.tasks) {
    const diagnosticDir = path.join(directory, 'product-data', 'tasks', task.id, 'diagnostics');
    for (const name of (await fs.readdir(diagnosticDir)).filter(n => n.endsWith('.json')).sort())
      records.push(JSON.parse(await fs.readFile(path.join(diagnosticDir, name), 'utf8')).record);
    const runsDir = path.join(directory, 'product-data', 'tasks', task.id, 'runs');
    for (const run of await fs.readdir(runsDir, { withFileTypes: true })) {
      if (!run.isDirectory()) continue;
      const factPath = path.join(runsDir, run.name, 'facts.json');
      let fact;
      try { fact = JSON.parse(await fs.readFile(factPath, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      const captions = list(fact.recording?.timeline).filter(x => x.kind === 'caption');
      const valid = captions.filter(x => finite(x.from_ms) && finite(x.to_ms) && x.to_ms >= x.from_ms);
      const intervals = valid.map(x => [x.from_ms, x.to_ms]).sort((a, b) => a[0] - b[0]);
      let end = -Infinity, union = 0;
      for (const [start, finish] of intervals) { union += Math.max(0, finish - Math.max(start, end)); end = Math.max(end, finish); }
      recording.push({ case_id: fact.case_id, run_id: fact.id, captions: captions.length,
        caption_intervals_missing: captions.length - valid.length, caption_wait_union_ms: union,
        scope: 'Recorded caption presentation holds only; not all browser/recording overhead' });
    }
  }
  const report = analyzeRecords(records);
  if (report.logical_calls !== round.budget.calls) throw Error('BUDGET_REQUEST_COUNT_MISMATCH');
  if (report.orphan_records) throw Error('ORPHAN_MODEL_RECORDS');
  return {
    schema: 'model-round-diagnosis/v1', round: path.basename(directory),
    scope: 'Read-only accounting, not semantic acceptance or controlled causal comparison',
    method: 'Request-ID dedup; mutually exclusive purpose with phase as separate axis; text marker explicitly labelled; audit of proposed complete fragments with measurements remains candidate review; empty completion proposal review separate; no raw prompts or page data exported; missing telemetry is unknown; time sums are not wall-clock.',
    wall_clock_ms: round.budget.elapsed_ms,
    recording,
    ...report,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  console.log(JSON.stringify(await analyzeRound(path.resolve(process.argv[2])), null, 2));
