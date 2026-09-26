export function validateTimingEvidence(requirements, entries, identity) {
  if (!requirements.length) return { required: false, complete: true, observations: [] };
  const observations = entries.flatMap(entry => (entry.timing_observations || []).map(value => ({ entry, value })));
  const checks = requirements.map(requirement => {
    const found = observations.filter(item => item.value.id === requirement.id);
    const item = found[0];
    const sameIdentity = item && item.entry.run_id === identity.run_id &&
      item.entry.candidate_sha256 === identity.candidate_sha256 &&
      item.entry.step_id === `CASE_STEP_${requirement.step}` && item.entry.depth === 0;
    const value = item?.value;
    const sameBounds = value && value.target === requirement.target && value.min_ms === requirement.min_ms &&
      value.max_ms === requirement.max_ms && value.tolerance_added_ms === 0;
    const duration = value?.observed_duration_ms;
    const cycle = value?.cycles?.length === 1 && value.cycles[0];
    const cycleValid = cycle && [cycle.appeared_ms, cycle.disappeared_ms, cycle.duration_ms].every(Number.isFinite) &&
      cycle.appeared_ms >= 0 && cycle.disappeared_ms >= cycle.appeared_ms && cycle.duration_ms === duration &&
      Math.abs(cycle.disappeared_ms - cycle.appeared_ms - cycle.duration_ms) <= 1e-6;
    const complete = requirement.status === 'RUNTIME_REQUIRED' && found.length === 1 && sameIdentity && sameBounds &&
      value.status === 'PASSED' && cycleValid && Number.isFinite(duration) &&
      duration >= requirement.min_ms && duration <= requirement.max_ms;
    return { ...requirement, observed_duration_ms: duration ?? null, cycles: value?.cycles || [],
      status: complete ? 'PASSED' : 'FAILED', reason: complete ? null : value?.reason || 'TIMING_EVIDENCE_MISSING_OR_INVALID',
      measurement: value?.measurement ?? null, tolerance_added_ms: 0 };
  });
  return { required: true, complete: checks.every(item => item.status === 'PASSED'), observations: checks };
}

export function applyTimingVerdict(result, timing) {
  if (!timing?.required || timing.complete) return result;
  return { ...result, complete_pass: false, test_status: 'FAILED',
    error: { code: 'FROZEN_TIMING_REQUIREMENT_FAILED', observations: timing.observations } };
}
