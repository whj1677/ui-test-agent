import { fail, now, semanticHash, publicError, keys, nonempty, redact } from './common.mjs';
import { snapshot, assertUnique } from './browser.mjs';
import { StepBudget } from './step-budget.mjs';
import { planHash } from './plans.mjs';
import { validateAdaptiveFragment, fragmentAuditPlan } from './adaptive-plan.mjs';
import { runtimeLocator } from './row-locator.mjs';
import {
  adaptiveCorrection,
  adaptiveProgress,
  canReconsiderBlock,
  isProtocolError,
} from './adaptive-recovery.mjs';
import { captureTableBaselines, needsTableBaseline } from './table-invariant.mjs';

export async function assertAdaptiveActionTarget(locator, action, originalAction = '') {
  if (!locator || ['wait', 'dismiss_optional'].includes(action.op)) return;
  if (['click', 'press', 'fill', 'select', 'check', 'uncheck'].includes(action.op)) {
    const identity = await locator.evaluate((element) => ({
      connected: element.isConnected,
      name: [
        element.getAttribute('aria-label'),
        element.innerText,
        ...Array.from(element.labels ?? []).map((label) => label.innerText),
        ...String(element.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent),
        element.matches('input[type=button],input[type=submit]') ? element.value : '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim(),
      sensitive: element.matches(
        'input[type=password],input[autocomplete="one-time-code"],input[type=file]',
      ),
    }));
    if (!identity.connected) fail('LOCATOR_NOT_VISIBLE');
    if (
      identity.sensitive ||
      /密码|口令|密钥|验证码|password|credential|api.?key|token/iu.test(identity.name)
    )
      fail('SENSITIVE_CONTROL_FORBIDDEN');
    // Inspect the actual node too: neutral CSS/testid must not hide a known write label.
    if (
      /保存|提交|删除|新建|创建|重置数据|清空数据|导入|上传|发布|支付|付款|审批|注销|退出登录|\b(?:save|submit|delete|create|remove|publish|upload|import|pay|approve|logout)\b/iu.test(
        identity.name,
      )
    )
      fail('ADAPTIVE_ACTION_WRITE_FORBIDDEN');
    if (
      /重置|\breset\b/iu.test(identity.name) &&
      !(
        /查询|搜索|筛选|过滤|\b(?:query|search|filter)\b/iu.test(originalAction) &&
        /重置|\breset\b/iu.test(originalAction)
      )
    )
      fail('ADAPTIVE_ACTION_WRITE_FORBIDDEN');
    const interactive = await locator.evaluate((element, op) => {
      if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
      const tag = element.tagName,
        role = element.getAttribute('role');
      if (op === 'select') return tag === 'SELECT';
      if (['fill', 'check', 'uncheck'].includes(op)) return ['INPUT', 'TEXTAREA'].includes(tag);
      return (
        ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY'].includes(tag) ||
        (tag === 'A' && element.hasAttribute('href')) ||
        [
          'button',
          'link',
          'tab',
          'menuitem',
          'treeitem',
          'combobox',
          'option',
          'checkbox',
          'radio',
          'switch',
        ].includes(role)
      );
    }, action.op);
    if (!interactive) fail('ADAPTIVE_TARGET_NOT_INTERACTIVE');
  }
}

async function currentActionTarget(page, action, budget, originalAction) {
  if (!action.target || ['wait', 'dismiss_optional'].includes(action.op)) return;
  const locator = await assertUnique(page, action.target, budget.remaining(2000));
  await assertAdaptiveActionTarget(locator, action, originalAction);
}

// The model proposes one short segment; it never receives a browser/code handle.
// All dispatched work still goes through the existing action and evidence kernel.
export async function executeAdaptiveStep(session, run) {
  const { step, stepIndex, result, page, recording, signal, guard, emit, plan, onAdaptive } = run;
  if (!onAdaptive) fail('ADAPTIVE_MODEL_REQUIRED');
  const budget = new StepBudget(step.timeout_ms);
  const completed = [],
    rejected = new Set(),
    executedKeys = new Set(),
    pages = [];
  let replans = 0;
  let protocolRepairs = 0,
    blockReviews = 0,
    correction;
  let assertionRepair = null;
  let executedAudit,
    noProgressReviews = 0;
  let tableBaselines;
  await recording.beginStep(step, stepIndex);
  await emit('STEP_STARTED', { step_id: step.step_id, action: step.source_action });
  const check = () => {
    if (signal?.aborted) fail('STOPPED');
    if (guard.blocked) fail(guard.blocked);
    if (guard.dirty) fail('ADAPTIVE_WRITE_FORBIDDEN');
    budget.remaining();
  };
  for (let segment = 0; segment < plan.execution_policy.max_segments_per_step;) {
    check();
    run.setPhase('ADAPTIVE_PLANNING');
    const current = await snapshot(page, { marker: session.marker });
    pages.push(current);
    if (current.login_page) fail('AUTH_REQUIRED');
    if (new URL(current.url).origin !== new URL(run.task.target).origin)
      fail('ADAPTIVE_ORIGIN_CHANGED');
    if (current.network_issues?.length) fail('PAGE_EVIDENCE_INCOMPLETE');
    if (!tableBaselines && needsTableBaseline(step.source_expected)) {
      // Capture once before the model or any action, never after a mutation.
      tableBaselines = await captureTableBaselines(page, current, {
        run_id: result.id,
        step_id: step.step_id,
      });
      await emit('ADAPTIVE_BASELINE_CAPTURED', {
        step_id: step.step_id,
        message: '已冻结本步骤操作前表格快照；后续逐动作核对内容是否变化，不以行数代替。',
      });
    }
    check();
    const observationHash = semanticHash({
      url: current.url,
      controls: current.controls,
      text: current.text,
    });
    await emit('ADAPTIVE_OBSERVED', {
      step_id: step.step_id,
      segment: segment + 1,
      observation_hash: observationHash,
      message: '已观察当前页面，正在决定当前原步骤的下一小段操作。',
    });
    const record = {
      step_id: step.step_id,
      segment: segment + 1,
      at: now(),
      observation_hash: observationHash,
      status: 'PLANNING',
      dispatched: false,
    };
    result.adaptive_segments.push(record);
    let fragment, point, reply;
    const beforeActions = result.actions.length;
    try {
      reply = await onAdaptive(
        'plan',
        {
          original: run.c,
          contract: plan,
          step,
          current,
          previous: completed,
          progress: adaptiveProgress(
            run.c.steps.find((item) => item.step_id === step.step_id),
            completed,
            executedAudit,
          ),
          repair_assertions: assertionRepair,
          ...(correction ? { correction } : {}),
          ...(tableBaselines
            ? { table_baseline: { captured: true, scope: 'before_first_action_of_current_step' } }
            : {}),
          completed_steps: result.adaptive_steps,
          failures: result.adaptive_segments.filter(
            (r) => r.step_id === step.step_id && r.status === 'REJECTED',
          ),
          remaining: {
            segments: plan.execution_policy.max_segments_per_step - segment,
            replans: plan.execution_policy.max_replans_per_step - replans,
            protocol_repairs: 2 - protocolRepairs,
          },
        },
        budget.deadline,
      );
      check();
      if (reply?.blocked === true) {
        keys(reply, ['blocked', 'reason'], ['blocked', 'reason']);
        if (!nonempty(reply.reason) || reply.reason.length > 1200) fail('BLOCK_REASON_REQUIRED');
        record.reason = redact(reply.reason);
        await emit('ADAPTIVE_BLOCKED', { step_id: step.step_id, message: record.reason });
        if (blockReviews < 1 && canReconsiderBlock(current, step)) {
          blockReviews++;
          const error = Object.assign(new Error('ADAPTIVE_MODEL_BLOCKED'), {
            code: 'ADAPTIVE_MODEL_BLOCKED',
          });
          record.status = 'REJECTED';
          record.error = error.code;
          correction = adaptiveCorrection(error, reply, step);
          await emit('ADAPTIVE_BLOCK_REVIEW', {
            step_id: step.step_id,
            message: '当前仍有原步骤支持的导航线索，正在复核阻塞理由；尚未派发操作。',
          });
          continue;
        }
        fail('ADAPTIVE_MODEL_BLOCKED');
      }
      fragment = validateAdaptiveFragment(reply, {
        c: run.c,
        plan,
        step,
        previous: completed,
        base: run.task.target,
      });
      const assertionContract = (items) => items.map(({ target, ...item }) => item);
      if (
        assertionRepair &&
        (fragment.actions.length ||
          semanticHash(assertionContract(fragment.assertions)) !== semanticHash(assertionRepair))
      )
        fail('ADAPTIVE_ASSERTION_CONTRACT_CHANGED');
      record.proposal_hash = semanticHash(fragment);
      record.transition_hash = semanticHash({
        observation: observationHash,
        actions: fragment.actions.map(({ action_id, ...action }) => action),
        assertions: fragment.assertions,
      });
      // A read-only completion declaration is a new state transition, not a
      // replayed action. It still needs full audit and fresh assertion execution.
      if (
        executedKeys.has(record.transition_hash) &&
        !(fragment.complete && !fragment.actions.length)
      )
        fail('ADAPTIVE_NO_PROGRESS');
      if (rejected.has(observationHash + ':' + record.proposal_hash)) fail('ADAPTIVE_NO_PROGRESS');
      const usedIds = new Set(result.actions.map((a) => a.action_id));
      if (fragment.actions.some((a) => usedIds.has(a.action_id)))
        fail('ADAPTIVE_ACTION_ALREADY_ATTEMPTED');
      for (const action of fragment.actions)
        await currentActionTarget(page, action, budget, step.source_action);
      if (!fragment.actions.length) {
        for (const assertion of fragment.assertions) {
          if (assertion.check === 'count' || assertion.check.startsWith('url_')) continue;
          if ((await runtimeLocator(page, assertion.target).count()) > 1) {
            assertionRepair = assertionContract(fragment.assertions);
            fail('LOCATOR_NOT_UNIQUE');
          }
        }
      }
      const bundle = fragmentAuditPlan(run.c, step, completed, fragment, run.task.target);
      const audit = await onAdaptive(
        'audit',
        { ...bundle, fragment, current, pages, previous: completed, complete: fragment.complete },
        budget.deadline,
      );
      check();
      record.audit = audit;
      if (
        fragment.complete
          ? audit.outcome !== 'ACCEPT'
          : audit.issues.some((i) => i.code !== 'ASSERTION_GAP')
      )
        fail('ADAPTIVE_SEGMENT_REJECTED');
      record.status = 'ACCEPTED';
      await emit('ADAPTIVE_SEGMENT_ACCEPTED', {
        step_id: step.step_id,
        segment: segment + 1,
        complete: fragment.complete,
        message: '当前短段已完成技术审查；只执行原用例范围内的操作。',
      });
      point = {
        checkpoint_id: `adaptive-${stepIndex + 1}-${result.adaptive_segments.length}`,
        actions: fragment.actions,
        assertions: fragment.assertions,
        within_ms: fragment.within_ms,
      };
      // Append BEFORE execution. A failure remains in this run, never rewritten as success.
      const executed = result.executed_plan.steps[stepIndex];
      executed.checkpoints.push(structuredClone(point));
      result.plan_hash = planHash(result.executed_plan);
      result.checkpoints.push({
        step_id: step.step_id,
        checkpoint_id: point.checkpoint_id,
        status: 'NOT_EXECUTED',
        assertion_count: point.assertions.length,
      });
      run.setPhase('RESOLVE');
      await session.executeStep({
        ...run,
        segment: true,
        budget,
        tableBaselines,
        onRepair: undefined,
        step: { ...step, checkpoints: [point] },
      });
      check();
      record.dispatched = result.actions.slice(beforeActions).some((a) => a.dispatched);
      record.status = 'EXECUTED';
      executedKeys.add(record.transition_hash);
      completed.push(fragment);
      executedAudit = audit;
      correction = undefined;
      assertionRepair = null;
      segment++;
      if (fragment.complete) {
        result.adaptive_steps.push({
          step_id: step.step_id,
          status: 'COMPLETE',
          segments: segment,
          audit,
          at: now(),
        });
        await emit('ADAPTIVE_STEP_COMPLETE', {
          step_id: step.step_id,
          message: '本步骤的原预期检查已完成，继续下一原步骤。',
        });
        await emit('STEP_FINISHED', { step_id: step.step_id });
        return;
      }
    } catch (error) {
      record.error = publicError(error);
      record.status = 'REJECTED';
      const attempts = result.actions.slice(beforeActions);
      record.dispatched = attempts.some((a) => a.dispatched !== false);
      // No retry after dispatch, assertion/evidence failure, cancellation, network or budget errors.
      const beforeDispatch =
        !point ||
        (attempts.length > 0 &&
          attempts.every((a) => a.phase === 'RESOLVE' && a.dispatched === false));
      const noProgressRetry =
        error.code === 'ADAPTIVE_NO_PROGRESS' &&
        !point &&
        fragment?.actions.length === 0 &&
        noProgressReviews < 1 &&
        executedKeys.has(record.transition_hash) &&
        !rejected.has(observationHash + ':' + record.proposal_hash);
      const localError =
        noProgressRetry ||
        /^(?:ADAPTIVE_(?:SEGMENT_REJECTED|INPUT|VALUE|FRAGMENT|ACTION|TARGET)|INVALID_|ASSERTION_|ORACLE_|PLAN_|LOCATOR_NOT_|ROW_)/.test(
          error.code ?? '',
        );
      correction = adaptiveCorrection(error, reply ?? error.adaptive_reply, step, record.audit);
      const protocolError = isProtocolError(error);
      const protocolRetry = protocolError && protocolRepairs < 2;
      if (
        !beforeDispatch ||
        (!protocolRetry &&
          (protocolError ||
            !localError ||
            replans >= plan.execution_policy.max_replans_per_step)) ||
        error.adaptive_audit_exhausted ||
        signal?.aborted ||
        guard.blocked ||
        guard.dirty
      )
        throw error;
      if (point) {
        // Keep the failed segment/evidence, but it is not part of the successful replay trace.
        result.executed_plan.steps[stepIndex].checkpoints.pop();
        result.plan_hash = planHash(result.executed_plan);
        record.action_attempts = result.actions.splice(beforeActions);
        record.checkpoint_attempt = result.checkpoints.pop();
      }
      // Schema correction does not consume semantic replans, nor add any time.
      if (protocolRetry) {
        protocolRepairs++;
        await emit('ADAPTIVE_PROTOCOL_REPAIR', {
          step_id: step.step_id,
          code: record.error,
          attempt: protocolRepairs,
          message: '模型响应格式有误，正在定点修正；保留业务目标和已执行动作。',
        });
        continue;
      }
      rejected.add(observationHash + ':' + (record.proposal_hash ?? 'invalid'));
      if (noProgressRetry) noProgressReviews++;
      replans++;
      await emit('ADAPTIVE_REPLANNING', {
        step_id: step.step_id,
        code: record.error,
        replan: replans,
        message: '当前操作尚未派发，保留失败记录并根据现场重新规划；不重放已执行动作。',
      });
    }
  }
  fail('ADAPTIVE_SEGMENT_LIMIT');
}
