import { completionIssues } from './completion-evidence.mjs';

// Maintenance-only experiment profiles; not derived from cases, pages or UI configuration.
export function requireDiagnosticProfile(profile = 'baseline') {
  if (!['baseline', 'reasoning-low', 'preflight-hints'].includes(profile))
    throw Object.assign(new Error('INVALID_DIAGNOSTIC_PROFILE'), { code: 'INVALID_DIAGNOSTIC_PROFILE' });
  return profile;
}

export function planningPreflight(input) {
  const original = input.original.steps.find(s => s.step_id === input.step.step_id);
  const checkpoints = [];
  let pending = [];
  for (const fragment of input.previous ?? []) {
    pending.push(...fragment.actions);
    if (fragment.assertions.length) {
      checkpoints.push({ actions: pending, assertions: fragment.assertions });
      pending = [];
    }
  }
  if (pending.length) checkpoints.push({ actions: pending, assertions: [] });
  let issues, unknown = false;
  try {
    issues = completionIssues(original, { checkpoints }, { adaptiveReadonly: true });
  } catch {
    issues = [];
    unknown = true;
  }
  return {
    provenance: 'original_current_step_and_executed_fragments',
    evidence_of_pass: false,
    permissions_changed: false,
    future_targets: 'pending_binding_not_a_dispatch_gate',
    protocol: { max_actions_per_reply: 1, max_assertions_per_step: 20, source_refs: 'current_original_obligations' },
    source_refs: original.obligations.map(o => o.id),
    pending_necessary_checks: issues.slice(0, 24),
    truncated: issues.length > 24,
    unknown,
    exhaustive: false,
  };
}

export function diagnosticPlanningRequest(prompt, input, profile = 'baseline') {
  requireDiagnosticProfile(profile);
  if (profile !== 'preflight-hints') return { prompt, input };
  return {
    prompt: 'Planning preflight below is advisory, not measured evidence or a new permission. Preserve ALL original obligations, including unsupported wording. Future targets stay pending until they appear; do not require full pre-observation or replay executed actions. Only existing execution and final review determine completion.\n' + prompt,
    input: { ...input, planning_preflight: planningPreflight(input) },
  };
}
