import { caseHash } from './plans.mjs';
import { semanticHash, now, fail, publicError } from './common.mjs';
import { prepareAdaptive } from './adaptive-preparation.mjs';

export const preparationRoot = (job) => job.parent ?? job;
export const discoveryState = (state, job) =>
  job.worker_id ? state.preparation.workers[job.worker_id].discovery : state.discovery;
export function setDiscoveryState(state, job, value) {
  if (job.worker_id) state.preparation.workers[job.worker_id].discovery = value;
  else state.discovery = value;
}

export function reusableCaseEvidence(state, row, c, contextKey) {
  const checkpoint = row.preparation_checkpoint;
  const age = Date.now() - Date.parse(checkpoint?.captured_at);
  return (
    checkpoint?.context_key === contextKey &&
    checkpoint.case_hash === caseHash(c) &&
    age >= 0 &&
    age < 15 * 60_000 &&
    row.discovery?.status === 'CAPTURED' &&
    (state.snapshots ?? []).some(
      (p) => p.discovery_case_id === c.case_id && p.discovery_job_id === row.discovery.job_id,
    )
  );
}

export function preparationContext(controller, state) {
  return semanticHash({
    session: controller.discoverySessionKey,
    target: state.target,
    authorization: state.authorization,
    auth_mode: state.auth_mode,
    auth_marker: state.auth_marker,
    handoff: state.handoff?.integrity ?? null,
    interactions: state.discovery_interactions ?? [],
    query_capability_version: 1,
  });
}

export function preparationProjection(state) {
  const p = state.preparation;
  if (!p) return state.discovery;
  const workers = Object.values(p.workers ?? {});
  const batchWorkers = workers.filter((w) => w.batch_index === p.batch_index);
  const cases = state.cases.filter((c) => p.case_ids.includes(c.case_id));
  return {
    ...state.discovery,
    status:
      p.status === 'RUNNING'
        ? 'RUNNING'
        : p.status === 'STOPPED'
          ? 'STOPPED'
          : p.status === 'NEEDS_ATTENTION'
            ? 'FAILED'
            : cases.every((c) => c.discovery?.status === 'CAPTURED')
              ? 'CAPTURED'
              : 'PARTIAL',
    budget: p.budget,
    batch_index: p.batch_index,
    batch_count: p.batch_count,
    job_id: p.job_id,
    current_case: workers.find((w) => w.status === 'RUNNING')?.case_id ?? null,
    steps: workers.reduce((n, w) => n + (w.discovery?.steps ?? 0), 0),
    pages: workers.reduce((n, w) => n + (w.discovery?.pages ?? 0), 0),
    model_calls: batchWorkers.reduce((n, w) => n + (w.discovery?.model_calls ?? 0), 0),
    project_model_calls: workers.reduce((n, w) => n + (w.discovery?.model_calls ?? 0), 0),
    completed_cases: cases.filter((c) => c.discovery?.status === 'CAPTURED').length,
    blocked_cases: cases.filter((c) => c.discovery?.status === 'BLOCKED').length,
    reason: p.reason ?? null,
    started_at: p.started_at,
    finished_at: p.finished_at,
  };
}

// A permit pool bounds all model requests within a preparation job. Browser
// workers also have a bounded pool. Waiting stays within the phase deadline.
export function modelPool(limit = 2) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < limit && queue.length) {
      const waiter = queue.shift();
      if (waiter.signal.aborted) {
        waiter.reject(waiter.signal.reason);
        continue;
      }
      waiter.signal.removeEventListener('abort', waiter.onAbort);
      active++;
      waiter.resolve(() => {
        active--;
        pump();
      });
    }
  };
  return (signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);
      const waiter = { resolve, reject, signal };
      queue.push(waiter);
      waiter.onAbort = () => {
        const index = queue.indexOf(waiter);
        if (index >= 0) {
          queue.splice(index, 1);
          reject(signal.reason);
        }
      };
      signal.addEventListener('abort', waiter.onAbort, { once: true });
      pump();
    });
}

export async function prepareBatch(controller, root, ids) {
  let cursor = 0,
    fatal = null;
  const work = async (slot) => {
    while (cursor < ids.length && !fatal && !root.abort.signal.aborted) {
      const caseId = ids[cursor++];
      const job = {
        ...root,
        parent: root,
        worker_id: caseId,
        current_case: caseId,
        current_model: null,
        phase_deadline: null,
        discovery_deadline: null,
        discovery_calls: 0,
        current_case_calls: 0,
      };
      for (const key of ['calls', 'total_calls', 'total_discovery_calls', 'diagnostic_failed'])
        Object.defineProperty(job, key, {
          get: () => root[key],
          set: (value) => {
            root[key] = value;
          },
        });
      job.budget = {
        ...root.budget,
        discovery: {
          ...root.budget.discovery,
          timeout_ms: root.time_budget.per_case[caseId].discovery_ms,
          model_call_limit: root.budget.discovery.model_calls_per_case,
          step_limit: root.budget.discovery.steps_per_case + 1,
        },
      };
      root.workers.set(caseId, job);
      const started = Date.now();
      await controller.store.update(root.id, (s) => {
        s.preparation.workers[caseId] = {
          case_id: caseId,
          slot,
          batch_index: root.batch_index + 1,
          status: 'RUNNING',
          phase: 'discovery',
          started_at: now(),
          budget: root.time_budget.per_case[caseId],
          discovery: {},
          reused: false,
        };
      });
      try {
        controller.assertCurrent(job);
        const state = await controller.store.read(root.id);
        const row = state.cases.find((r) => r.case_id === caseId);
        const c = root.cases.find((c) => c.case_id === caseId);
        if (
          controller.planningMode === 'adaptive' &&
          !state.authorization.writes &&
          root.kind !== 'discover'
        ) {
          job.phase = 'planning';
          job.phase_deadline = Date.now() + root.time_budget.per_case[caseId].planning_ms;
          await prepareAdaptive(controller, job, await controller.store.baseline(root.id), c);
          continue;
        }
        if (root.kind !== 'plan' && !reusableCaseEvidence(state, row, c, root.context_key))
          await controller.explore(job, [caseId], { finish: false, plan: false });
        else
          await controller.store.update(root.id, (s) => {
            s.preparation.workers[caseId].reused = true;
            controller.store.event(s, 'PREPARATION_EVIDENCE_REUSED', {
              case_id: caseId,
              message: '复用当前登录、版本与有效期内的用例页面证据；仍需核对计划，不代表业务通过。',
            });
          });
        const captured = await controller.store.read(root.id);
        const current = captured.cases.find((r) => r.case_id === caseId);
        if (current.discovery?.status === 'CAPTURED' || root.kind === 'plan') {
          await controller.store.update(root.id, (s) => {
            const r = s.cases.find((r) => r.case_id === caseId);
            const routes = new Set(
              (s.snapshots ?? [])
                .filter(
                  (p) =>
                    p.discovery_case_id === caseId && p.discovery_job_id === r.discovery?.job_id,
                )
                .map((p) => {
                  try {
                    return new URL(p.url).pathname;
                  } catch {
                    return '';
                  }
                }),
            );
            // Freeze the shared hints per Case before planning. Other workers
            // cannot change the input hash of a plan already being reviewed.
            if (!r.shared_control_evidence || !s.preparation.workers[caseId].reused)
              r.shared_control_evidence = [...(root.moduleEvidence?.values() ?? [])].filter((m) =>
                routes.has(m.route),
              );
            if (!s.preparation.workers[caseId].reused)
              r.preparation_checkpoint = {
                context_key: root.context_key,
                case_hash: caseHash(c),
                captured_at: now(),
              };
          });
          if (current.reviewed) {
            job.stage = 'PLANNING';
            job.phase = 'planning';
            job.phase_deadline = Date.now() + root.time_budget.per_case[caseId].planning_ms;
            await controller.store.update(root.id, (s) => {
              s.preparation.workers[caseId].phase = 'planning';
              s.preparation.workers[caseId].phase_started_at = now();
              controller.store.event(s, 'PREPARATION_PLANNING_STARTED', {
                case_id: caseId,
                message:
                  '页面取证结束，开始生成、审查与修复计划；此阶段独立计时，尚未执行业务测试。',
              });
            });
            await controller.work(job, [caseId], { kind: 'plan', finish: false });
            if (Date.now() >= job.phase_deadline) fail('PREPARATION_PLAN_TIMEOUT');
          }
        }
        controller.assertCurrent(job);
      } catch (error) {
        const code = publicError(error);
        const timeout = [
          'DISCOVERY_TIMEOUT',
          'PREPARATION_CASE_TIMEOUT',
          'PREPARATION_PLAN_TIMEOUT',
        ].includes(code);
        if (
          timeout ||
          [
            'DISCOVERY_STEP_LIMIT',
            'DISCOVERY_MODEL_BUDGET_EXHAUSTED',
            'MODEL_CALL_BUDGET_EXHAUSTED',
          ].includes(code)
        ) {
          await controller.store.update(root.id, (s) => {
            const r = s.cases.find((r) => r.case_id === caseId);
            r.status = 'BLOCKED_BUDGET';
            r.mapping_reason = job.phase === 'planning' ? 'PREPARATION_PLAN_TIMEOUT' : code;
            r.plan_approved = false;
            controller.store.event(s, 'PREPARATION_CASE_PAUSED', {
              case_id: caseId,
              code: r.mapping_reason,
              message:
                '该用例预算已到，证据和历史消耗已保留；继续处理其他用例，可稍后增加时间续跑。',
            });
          });
        } else {
          fatal = error;
          if (code !== 'STOPPED') root.failure_code = code;
          root.abort.abort(error);
        }
      } finally {
        if (!root.abort.signal.aborted && !root.diagnostic_failed)
          await controller.updateCaseAdvice(job, caseId);
        job.phase_deadline = null;
        job.discovery_deadline = null;
        root.workers.delete(caseId);
        await controller.store.update(root.id, (s) => {
          const worker = s.preparation.workers[caseId];
          const row = s.cases.find((r) => r.case_id === caseId);
          worker.status =
            root.abort.signal.aborted || row.status === 'BLOCKED_BUDGET'
              ? 'PAUSED'
              : row.plan && row.status === 'PLAN_REVIEW'
                ? 'PLAN_READY'
                : row.discovery?.status === 'CAPTURED' && !row.reviewed
                  ? 'NEEDS_REVIEW'
                  : 'PAUSED';
          worker.finished_at = now();
          worker.elapsed_ms = Date.now() - started;
          row.preparation_usage ??= { elapsed_ms: 0, logical_calls: 0, rounds: 0 };
          row.preparation_usage.elapsed_ms += worker.elapsed_ms;
          row.preparation_usage.logical_calls += job.worker_calls ?? 0;
          row.preparation_usage.rounds++;
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: root.options.concurrency }, (_, i) =>
      work(i + 1).catch((error) => {
        fatal ??= error;
        if (error.code !== 'STOPPED') root.failure_code ??= publicError(error);
        root.abort.abort(error);
      }),
    ),
  );
  if (fatal) throw fatal;
  controller.assertCurrent(root);
}
