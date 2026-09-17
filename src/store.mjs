import { applyInputOverrides } from './input-review.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, uid, now, fail, safeId } from './common.mjs';
import { requireNoMaintenance } from './data-maintenance.mjs';

export class Store {
  constructor(root) {
    this.root = path.resolve(root);
    this.locks = new Map();
    this.eventLocks = new Map();
    this.eventHeads = new Map();
    this.writerLock = null;
  }
  dir(id) {
    return path.join(this.root, 'tasks', safeId(id));
  }
  async init() {
    await fs.mkdir(path.join(this.root, 'tasks'), { recursive: true });
  }
  async acquireLock() {
    if (this.writerLock) return this.writerLock;
    await this.init();
    await requireNoMaintenance(this.root);
    const record = {
      schema_version: 'ui-agent-writer-lock/v1',
      id: uid(),
      pid: process.pid,
      created_at: now(),
    };
    try {
      await immutableJSON(path.join(this.root, '.writer.lock'), record);
    } catch (e) {
      if (e.code === 'EEXIST') fail('DATA_DIRECTORY_LOCKED', 409);
      throw e;
    }
    this.writerLock = record;
    // A maintenance operation may start between the first check and exclusive creation.
    // It refuses this new lock, and we release our own lock before any task is touched.
    try {
      await requireNoMaintenance(this.root);
    } catch (error) {
      await this.releaseLock();
      throw error;
    }
    return record;
  }
  async releaseLock() {
    if (!this.writerLock) return;
    const file = path.join(this.root, '.writer.lock');
    let owner;
    try {
      owner = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      fail('DATA_DIRECTORY_LOCK_CHANGED', 409);
    }
    if (owner.id !== this.writerLock.id) fail('DATA_DIRECTORY_LOCK_CHANGED', 409);
    await fs.unlink(file);
    this.writerLock = null;
  }
  async list() {
    const ids = await fs.readdir(path.join(this.root, 'tasks'));
    const results = [];
    for (const id of ids) {
      try {
        const s = await this.read(id);
        results.push({
          id: s.id,
          name: s.name,
          created_at: s.created_at,
          updated_at: s.updated_at,
          total: s.cases.length,
          status: s.status,
        });
      } catch {
        results.push({ id, status: 'CORRUPT', name: '任务文件需检查' });
      }
    }
    return results.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }
  async create({ name, target, baseline, filename, sourceBytes }) {
    const id = uid(),
      dir = this.dir(id);
    await fs.mkdir(dir, { recursive: true });
    const bytes = Buffer.from(JSON.stringify(baseline, null, 2) + '\n');
    await fs.writeFile(path.join(dir, 'baseline.json'), bytes, { flag: 'wx' });
    if (sourceBytes)
      await fs.writeFile(
        path.join(dir, 'input' + path.extname(filename).toLowerCase()),
        sourceBytes,
        { flag: 'wx' },
      );
    const state = {
      id,
      name,
      target,
      created_at: now(),
      updated_at: now(),
      revision: 0,
      status: 'IMPORTED',
      baseline_sha256: hash(bytes),
      filename,
      authorization: { nonproduction: false, writes: false, readOnlyEndpoints: [] },
      auth_marker: null,
      auth_mode: 'manual',
      cases: baseline.cases.map((c) => ({
        case_id: c.case_id,
        status: 'NEEDS_REVIEW',
        confirmations: [],
        issues: [],
        reviewed: false,
        plan: null,
        plan_approved: false,
        attempts: [],
        repair_count: 0,
        cleanup_required: false,
      })),
      events: [],
    };
    await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify(state, null, 2));
    await this.update(id, (s) => this.event(s, 'IMPORTED', { count: s.cases.length }));
    return id;
  }
  async read(id) {
    let state;
    try {
      state = JSON.parse(await fs.readFile(path.join(this.dir(id), 'state.json'), 'utf8'));
    } catch {
      fail('TASK_NOT_FOUND', 404);
    }
    const bytes = await fs.readFile(path.join(this.dir(id), 'baseline.json'));
    if (hash(bytes) !== state.baseline_sha256) fail('BASELINE_CHANGED', 409);
    return state;
  }
  async baseline(id) {
    await this.read(id);
    return JSON.parse(await fs.readFile(path.join(this.dir(id), 'baseline.json'), 'utf8'));
  }
  async cleanupBlockers(target) {
    const origin = new URL(target).origin;
    const blockers = [];
    // A process-wide busy flag prevents concurrency, not sequential task bypass.
    // Persisted task records keep this restriction across normal restarts.
    for (const task of await this.list()) {
      if (task.status === 'CORRUPT') {
        blockers.push({ task_id: task.id, task_name: task.name, reason: 'STATE_UNVERIFIED' });
        continue;
      }
      const state = await this.read(task.id);
      if (new URL(state.target).origin !== origin) continue;
      for (const record of state.cases) {
        if (
          record.cleanup_required ||
          (['RUNNING', 'INTERRUPTED'].includes(record.status) &&
            record.plan?.data_effect === 'mutation' &&
            !record.recovery_confirmation)
        ) {
          blockers.push({
            task_id: state.id,
            task_name: state.name,
            case_id: record.case_id,
            reason: 'CLEANUP_REQUIRED',
          });
        }
      }
    }
    return blockers;
  }
  async update(id, fn) {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const state = await this.read(id);
        const result = await fn(state);
        state.updated_at = now();
        state.revision++;
        const temp = path.join(this.dir(id), `state-${uid()}.tmp`);
        await fs.writeFile(temp, JSON.stringify(state, null, 2));
        // Windows readers/virus scanners can briefly hold the destination. Retry only the file commit,
        // never the business operation which produced the event.
        for (let attempt = 0; ; attempt++) {
          try {
            await fs.rename(temp, path.join(this.dir(id), 'state.json'));
            break;
          } catch (e) {
            if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || attempt >= 8) throw e;
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
          }
        }
        return result ?? state;
      });
    this.locks.set(id, next);
    try {
      return await next;
    } finally {
      if (this.locks.get(id) === next) this.locks.delete(id);
    }
  }
  event(s, type, detail = {}) {
    s.events.push({ seq: s.events.length + 1, at: now(), type, ...detail });
  }
  async beginRun(id, input) {
    const state = await this.read(id),
      runId = safeId(input.id);
    if (
      !Array.isArray(input.case_ids) ||
      !input.case_ids.length ||
      new Set(input.case_ids).size !== input.case_ids.length ||
      input.case_ids.some((c) => !state.cases.some((r) => r.case_id === c))
    )
      fail('RUN_SCOPE_INVALID');
    for (const hashes of [input.case_hashes, input.plan_hashes])
      if (
        hashes &&
        (!hashes ||
          typeof hashes !== 'object' ||
          Array.isArray(hashes) ||
          Object.entries(hashes).some(
            ([key, value]) => !input.case_ids.includes(key) || !validHash(value),
          ))
      )
        fail('RUN_SCOPE_INVALID');
    const scope = {
      ...structuredClone(input),
      schema_version: 'ui-agent-run-scope/v1',
      id: runId,
      task_id: id,
      created_at: now(),
      baseline_sha256: state.baseline_sha256,
      ...(this.build ? { agent_build: this.build } : {}),
      case_ids: [...input.case_ids],
    };
    const dir = path.join(this.dir(id), 'jobs', runId);
    await fs.mkdir(dir, { recursive: true });
    const sha256 = await immutableJSON(path.join(dir, 'scope.json'), scope),
      receipt = { id: runId, sha256, created_at: scope.created_at, case_ids: scope.case_ids };
    await this.update(id, (s) => {
      s.run_scopes ??= [];
      s.run_scopes.push(receipt);
    });
    return receipt;
  }
  async runScope(id, receipt) {
    const bytes = await fs.readFile(
      path.join(this.dir(id), 'jobs', safeId(receipt.id), 'scope.json'),
    );
    if (hash(bytes) !== receipt.sha256) fail('RUN_SCOPE_CHANGED', 409);
    const scope = JSON.parse(bytes);
    if (scope.id !== receipt.id || scope.task_id !== id) fail('RUN_SCOPE_CHANGED', 409);
    return scope;
  }
  async recordExecutionEvent(id, attemptId, event) {
    safeId(attemptId);
    if (!event || typeof event.type !== 'string' || !event.type) fail('EXECUTION_EVENT_INVALID');
    const key = id + '/' + attemptId,
      previous = this.eventLocks.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        try {
          await fs.access(path.join(this.dir(id), 'runs', attemptId, 'facts.json'));
          fail('EXECUTION_ALREADY_SEALED', 409);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        const directory = path.join(this.dir(id), 'runs', attemptId, 'events');
        await fs.mkdir(directory, { recursive: true });
        let head = this.eventHeads.get(key);
        if (!head) {
          const receipts = await this.executionEvents(id, attemptId);
          head = receipts.at(-1) ?? { seq: 0, sha256: null };
          this.eventHeads.set(key, head);
        }
        const seq = head.seq + 1,
          record = {
            ...structuredClone(event),
            schema_version: 'ui-agent-execution-event/v1',
            task_id: id,
            attempt_id: attemptId,
            seq,
            at: now(),
            previous_sha256: head.sha256,
          };
        const file = String(seq).padStart(6, '0') + '.json',
          sha256 = await immutableJSON(path.join(directory, file), record),
          receipt = { seq, sha256, file };
        this.eventHeads.set(key, receipt);
        return receipt;
      });
    this.eventLocks.set(key, next);
    try {
      return await next;
    } finally {
      if (this.eventLocks.get(key) === next) this.eventLocks.delete(key);
    }
  }
  async executionEvents(id, attemptId, expected) {
    const directory = path.join(this.dir(id), 'runs', safeId(attemptId), 'events');
    let names;
    try {
      names = (await fs.readdir(directory)).sort();
    } catch (e) {
      if (e.code === 'ENOENT' && !expected?.length) return [];
      throw e;
    }
    if (names.some((n) => !/^\d{6}\.json$/.test(n))) fail('EXECUTION_EVENTS_CHANGED', 409);
    const receipts = [];
    for (const [index, file] of names.entries()) {
      const bytes = await fs.readFile(path.join(directory, file)),
        sha256 = hash(bytes);
      let record;
      try {
        record = JSON.parse(bytes);
      } catch {
        fail('EXECUTION_EVENTS_CHANGED', 409);
      }
      if (
        file !== String(index + 1).padStart(6, '0') + '.json' ||
        record.seq !== index + 1 ||
        record.task_id !== id ||
        record.attempt_id !== attemptId ||
        record.previous_sha256 !== (receipts.at(-1)?.sha256 ?? null)
      )
        fail('EXECUTION_EVENTS_CHANGED', 409);
      receipts.push({ seq: index + 1, sha256, file });
    }
    if (
      expected &&
      (expected.length !== receipts.length ||
        expected.some(
          (r, i) =>
            r.file !== receipts[i].file ||
            r.sha256 !== receipts[i].sha256 ||
            r.seq !== receipts[i].seq,
        ))
    )
      fail('EXECUTION_EVENTS_CHANGED', 409);
    return receipts;
  }
  async fact(id, result) {
    const directory = path.join(this.dir(id), 'runs', safeId(result.id));
    await fs.mkdir(directory, { recursive: true });
    const execution_event_receipts = await this.executionEvents(id, result.id);
    const key = id + '/' + result.id,
      head = this.eventHeads.get(key),
      tail = execution_event_receipts.at(-1) ?? { seq: 0, sha256: null };
    if (head && (head.seq !== tail.seq || head.sha256 !== tail.sha256))
      fail('EXECUTION_EVENTS_CHANGED', 409);
    const fact = {
      ...result,
      ...(this.build ? { agent_build: this.build } : {}),
      evidence_schema_version: 'ui-agent-fact/v2',
      execution_event_receipts,
    };
    const sha256 = await immutableJSON(path.join(directory, 'facts.json'), fact);
    this.eventHeads.delete(key);
    return { id: result.id, sha256, status: result.status, at: result.finished_at };
  }
  async facts(id, attempt) {
    const bytes = await fs.readFile(
      path.join(this.dir(id), 'runs', safeId(attempt.id), 'facts.json'),
    );
    if (hash(bytes) !== attempt.sha256) fail('EVIDENCE_CHANGED', 409);
    const fact = JSON.parse(bytes);
    if (fact.id !== attempt.id) fail('EVIDENCE_CHANGED', 409);
    if (fact.execution_event_receipts)
      await this.executionEvents(id, attempt.id, fact.execution_event_receipts);
    return fact;
  }
  async executionProjection(id, suppliedState, { allScopes = false } = {}) {
    const state = suppliedState ?? (await this.read(id)),
      baseline = await this.baseline(id),
      issues = [];
    const scopeCache = new Map(),
      getScope = async (scopeId) => {
        if (!scopeCache.has(scopeId))
          scopeCache.set(
            scopeId,
            (async () => {
              const receipts = (state.run_scopes ?? []).filter((r) => r.id === scopeId);
              if (receipts.length !== 1) fail('FACT_SCOPE_MISSING', 409);
              const value = await this.runScope(id, receipts[0]);
              if (
                value.baseline_sha256 !== state.baseline_sha256 ||
                !Array.isArray(value.case_ids) ||
                new Set(value.case_ids).size !== value.case_ids.length ||
                value.case_ids.some((cid) => !baseline.cases.some((c) => c.case_id === cid))
              )
                fail('RUN_SCOPE_CHANGED', 409);
              return value;
            })(),
          );
        return scopeCache.get(scopeId);
      };
    let scope = null,
      scopeSource = allScopes ? 'ALL_TASK_SCOPES' : 'LEGACY_BASELINE',
      scopeInvalid = false;
    if (!allScopes && state.run_scopes?.length) {
      scopeSource = 'FROZEN_RUN_SCOPE';
      try {
        scope = await getScope(state.run_scopes.at(-1).id);
      } catch (e) {
        scopeInvalid = true;
        issues.push({ code: e.code ?? 'RUN_SCOPE_INVALID', scope_id: state.run_scopes.at(-1).id });
      }
    }
    const selected = scope && !scopeInvalid ? scope.case_ids : baseline.cases.map((c) => c.case_id),
      cases = [];
    for (const caseId of selected) {
      const record = state.cases.find((c) => c.case_id === caseId),
        caseIssues = [],
        attempts = [];
      for (const receipt of record?.attempts ?? []) {
        try {
          const fact = await this.facts(id, receipt);
          if (fact.case_id !== caseId) fail('FACT_CASE_MISMATCH', 409);
          const ownScope = fact.run_scope_id ? await getScope(fact.run_scope_id) : null;
          if (!ownScope && fact.schema_version === 'ui-agent-facts/v2')
            fail('FACT_SCOPE_MISSING', 409);
          if (scope && fact.run_scope_id !== scope.id) continue;
          if (
            ownScope &&
            (!ownScope.case_ids.includes(caseId) ||
              fact.baseline_sha256 !== ownScope.baseline_sha256 ||
              (ownScope.case_hashes?.[caseId] && fact.case_hash !== ownScope.case_hashes[caseId]) ||
              (ownScope.plan_hashes?.[caseId] &&
                (fact.approved_plan_hash ?? fact.plan_hash) !== ownScope.plan_hashes[caseId]))
          )
            fail('FACT_SCOPE_MISMATCH', 409);
          attempts.push({ receipt, fact });
        } catch (e) {
          const issue = {
            code: e.code ?? 'FACT_UNREADABLE',
            case_id: caseId,
            attempt_id: receipt.id,
          };
          caseIssues.push(issue);
          attempts.push({ receipt, issue });
        }
      }
      attempts.sort((a, b) =>
        (a.fact?.finished_at ?? a.receipt.at ?? '').localeCompare(
          b.fact?.finished_at ?? b.receipt.at ?? '',
        ),
      );
      const latest = attempts.filter((a) => a.fact).at(-1)?.fact;
      const invalid = scopeInvalid || caseIssues.length > 0;
      const status = invalid
        ? 'EVIDENCE_INCOMPLETE'
        : (latest?.status ?? (scope ? 'NOT_EXECUTED' : preparationStatus(record?.status)));
      if (latest && record?.status !== latest.status)
        caseIssues.push({
          code: 'PROJECTION_STATUS_MISMATCH',
          case_id: caseId,
          projection_status: record?.status,
          fact_status: latest.status,
        });
      if (latest?.evidence_status === 'PARTIAL' || latest?.media_warning)
        caseIssues.push({ code: 'FACT_EVIDENCE_PARTIAL', case_id: caseId, attempt_id: latest.id });
      cases.push({
        case_id: caseId,
        status,
        business_status: invalid
          ? 'UNVERIFIED'
          : (latest?.business_status ??
            (latest?.status === 'PASS_ASSERTIONS'
              ? 'ASSERTIONS_PASSED'
              : latest?.status === 'FAIL_ASSERTION'
                ? 'ASSERTION_MISMATCH'
                : 'NOT_EXECUTED')),
        cleanup_status: invalid ? 'UNVERIFIED' : (latest?.cleanup_status ?? 'NOT_REQUIRED'),
        evidence_status:
          invalid || latest?.evidence_status === 'PARTIAL' || latest?.media_warning
            ? 'PARTIAL'
            : latest
              ? 'VERIFIED'
              : 'NOT_EXECUTED',
        attempts,
        latest,
        issues: caseIssues,
      });
    }
    // A fact without its committed receipt cannot be authenticated from the index. Surface it;
    // do not silently promote an orphan or invent a checksum from the file being verified.
    const known = new Set(state.cases.flatMap((c) => (c.attempts ?? []).map((a) => a.id)));
    let runNames = [];
    try {
      runNames = await fs.readdir(path.join(this.dir(id), 'runs'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    for (const runId of runNames) {
      if (known.has(runId) || !/^[a-f0-9-]{36}$/.test(runId)) continue;
      try {
        const orphan = JSON.parse(
          await fs.readFile(path.join(this.dir(id), 'runs', runId, 'facts.json'), 'utf8'),
        );
        if (scope && orphan.run_scope_id !== scope.id) continue;
        const issue = { code: 'ORPHAN_FACT_UNINDEXED', attempt_id: runId, case_id: orphan.case_id };
        issues.push(issue);
        const c = cases.find((c) => c.case_id === orphan.case_id);
        if (c) {
          c.issues.push(issue);
          c.status = 'EVIDENCE_INCOMPLETE';
          c.business_status = 'UNVERIFIED';
          c.evidence_status = 'PARTIAL';
        }
      } catch (e) {
        if (e.code !== 'ENOENT') {
          issues.push({ code: 'ORPHAN_FACT_UNREADABLE', attempt_id: runId });
          continue;
        }
        try {
          const events = await this.executionEvents(id, runId);
          if (!events.length) continue;
          const first = JSON.parse(
            await fs.readFile(
              path.join(this.dir(id), 'runs', runId, 'events', events[0].file),
              'utf8',
            ),
          );
          if (scope && first.run_scope_id && first.run_scope_id !== scope.id) continue;
          const issue = { code: 'UNSEALED_EXECUTION', attempt_id: runId, case_id: first.case_id };
          issues.push(issue);
          const c = cases.find((c) => c.case_id === first.case_id);
          if (c) {
            c.issues.push(issue);
            c.status = 'EVIDENCE_INCOMPLETE';
            c.business_status = 'UNVERIFIED';
            c.cleanup_status = 'UNVERIFIED';
            c.evidence_status = 'PARTIAL';
          }
        } catch (eventError) {
          issues.push({
            code: eventError.code ?? 'UNSEALED_EXECUTION_UNREADABLE',
            attempt_id: runId,
          });
        }
      }
    }
    issues.push(...cases.flatMap((c) => c.issues));
    const counts = {
      total: cases.length,
      attempted: cases.filter((c) => c.attempts.length).length,
      pass: cases.filter((c) => c.business_status === 'ASSERTIONS_PASSED').length,
      fail: cases.filter((c) => c.business_status === 'ASSERTION_MISMATCH').length,
      technical_failed: cases.filter((c) => c.status === 'TECHNICAL_FAILED').length,
      cleanup_required: cases.filter((c) =>
        ['FAILED', 'PENDING', 'UNVERIFIED'].includes(c.cleanup_status),
      ).length,
      evidence_incomplete: cases.filter((c) => c.evidence_status === 'PARTIAL').length,
    };
    return { scope, scope_source: scopeSource, scope_valid: !scopeInvalid, cases, issues, counts };
  }
  async recoverInterrupted() {
    for (const t of await this.list())
      if (t.status === 'RUNNING' || t.status === 'ANALYZING')
        await this.update(t.id, (s) => {
          s.status = 'INTERRUPTED';
          for (const c of s.cases)
            if (c.status === 'RUNNING') {
              c.status = 'INTERRUPTED';
              c.cleanup_required = c.plan?.data_effect === 'mutation';
            }
          this.event(s, 'INTERRUPTED', { reason: '服务重启；不会自动重放已开始的操作。' });
        });
  }
}

export function effectiveCase(original, record) {
  const result = applyInputOverrides(original, record.data_overrides ?? {});
  for (const confirmation of record.confirmations ?? []) {
    const step = result.steps.find((s) => s.step_id === confirmation.step_id);
    if (step) {
      step.action = confirmation.action;
      step.expected = confirmation.expected;
      if (confirmation.obligations) step.obligations = structuredClone(confirmation.obligations);
    }
  }
  return result;
}

const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function preparationStatus(status) {
  return [
    'NEEDS_REVIEW',
    'NEEDS_MAPPING',
    'BLOCKED_MAPPING',
    'PLAN_REVIEW',
    'READY',
    'RUNNING',
    'STOPPED',
    'INTERRUPTED',
  ].includes(status)
    ? status
    : 'NOT_EXECUTED';
}
async function immutableJSON(file, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'),
    handle = await fs.open(file, 'wx');
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return hash(bytes);
}
