import { fail, keys } from './common.mjs';

// New candidates only: the capability is included in the user-approved hash.
export function prepareControlledReactPlan(plan) {
  if (
    !plan ||
    plan.data_effect !== 'read_only' ||
    !['ui-agent-plan/v2', 'ui-agent-plan/v3'].includes(plan.schema_version) ||
    plan.execution_policy !== undefined
  )
    return plan;
  return { ...plan, execution_policy: { mode: 'guarded-react', max_observations: 2 } };
}
export function validateExecutionPolicy(plan) {
  const policy = plan.execution_policy;
  if (policy === undefined) return;
  keys(policy, ['mode', 'max_observations'], ['mode', 'max_observations']);
  if (
    plan.data_effect !== 'read_only' ||
    policy.mode !== 'guarded-react' ||
    policy.max_observations !== 2 ||
    !['ui-agent-plan/v2', 'ui-agent-plan/v3'].includes(plan.schema_version)
  )
    fail('REACT_POLICY_INVALID');
}
export function canObserveAgain(plan, failure, used, dirty = false) {
  return (
    plan.execution_policy?.mode === 'guarded-react' &&
    plan.execution_policy.max_observations === 2 &&
    plan.data_effect === 'read_only' &&
    !dirty &&
    failure.phase === 'RESOLVE' &&
    failure.dispatched === false &&
    ['LOCATOR_NOT_VISIBLE', 'LOCATOR_NOT_UNIQUE'].includes(failure.code) &&
    used < 2
  );
}
export function validateObserveDecision(reply, failure) {
  keys(reply, ['observe'], ['observe']);
  if (reply.observe !== true || !failure.allowed_tools?.includes('observe'))
    fail('REACT_OBSERVE_NOT_ALLOWED');
  return { observe: true };
}
