import { keys, fail, semanticHash, nonempty, relativeURL } from './common.mjs';
import { validateLocator } from './plans.mjs';

// Operator-supplied technical declarations, never model-generated permissions.
export function validateDiscoveryInteractions(entries, baseline) {
  if (!Array.isArray(entries) || entries.length > 120) fail('DISCOVERY_CONTRACT_INVALID');
  const unique = new Set();
  for (const entry of entries) {
    keys(
      entry,
      ['case_id', 'entry_path', 'locator', 'operation', 'values', 'evidence'],
      ['case_id', 'entry_path', 'locator', 'operation', 'values', 'evidence'],
    );
    const c = baseline.cases.find((c) => c.case_id === entry.case_id);
    if (!c || !['fill', 'select'].includes(entry.operation)) fail('DISCOVERY_CONTRACT_INVALID');
    if (
      typeof entry.entry_path !== 'string' ||
      !entry.entry_path.startsWith('/') ||
      entry.entry_path.startsWith('//')
    )
      fail('DISCOVERY_CONTRACT_PATH_INVALID');
    relativeURL(entry.entry_path, 'http://127.0.0.1/');
    validateLocator(entry.locator);
    if (
      /password|密码|token|secret|credential|api.?key|cookie|authorization/i.test(
        JSON.stringify(entry.locator),
      )
    )
      fail('DISCOVERY_SENSITIVE_CONTROL');
    if (
      !Array.isArray(entry.values) ||
      !entry.values.length ||
      new Set(entry.values).size !== entry.values.length ||
      entry.values.length > (entry.operation === 'fill' ? 3 : 8) ||
      entry.values.some(
        (v) => typeof v !== 'string' || v.length > 200 || /[\u0000-\u001f]/u.test(v),
      )
    )
      fail('DISCOVERY_CONTRACT_VALUE_INVALID');
    const sources = c.steps.map((s) => s.action),
      collect = (value) => {
        if (typeof value === 'string' || typeof value === 'number') sources.push(String(value));
        else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object') Object.values(value).forEach(collect);
      };
    collect(c.data);
    collect(c.test_data);
    if (
      entry.operation === 'fill' &&
      entry.values.some((v) => v !== '' && !sources.some((text) => text.includes(v)))
    )
      fail('DISCOVERY_VALUE_NOT_FROM_CASE');
    keys(
      entry.evidence,
      ['kind', 'ref', 'no_business_write'],
      ['kind', 'ref', 'no_business_write'],
    );
    if (
      entry.evidence.kind !== 'source_review' ||
      !nonempty(entry.evidence.ref) ||
      entry.evidence.ref.length > 1000 ||
      entry.evidence.no_business_write !== true
    )
      fail('DISCOVERY_CONTRACT_EVIDENCE_REQUIRED');
    const key = semanticHash([entry.case_id, entry.entry_path, entry.locator, entry.operation]);
    if (unique.has(key)) fail('DISCOVERY_CONTRACT_DUPLICATE');
    unique.add(key);
  }
  return structuredClone(entries);
}

export function observationKey(snapshot) {
  return semanticHash({
    url: snapshot.url,
    title: snapshot.title,
    text: snapshot.text,
    controls: snapshot.controls,
  });
}
export function discoveryActionKey(snapshot, candidate) {
  return semanticHash({
    state: observationKey(snapshot),
    locator: candidate.locator,
    operation: candidate.operation ?? 'click',
    value: candidate.value ?? null,
  });
}
export function createDiscoveryMemory(c, handoff) {
  const source = new Map();
  for (const a of handoff?.actions ?? [])
    for (const control of a.controls ?? [])
      if (control.locator) {
        const knowledge_status = a.knowledge_status ?? 'unresolved',
          key = semanticHash([control.locator, knowledge_status]);
        source.set(key, {
          id: control.id,
          locator: control.locator,
          knowledge_status,
          source_refs: control.source_refs ?? a.source_refs ?? [],
          evidence:
            knowledge_status === 'code_confirmed'
              ? 'SOURCE_CONFIRMED_CANDIDATE'
              : knowledge_status === 'inferred_candidate'
                ? 'SOURCE_INFERRED'
                : 'SOURCE_UNRESOLVED',
        });
      }
  return {
    case_id: c.case_id,
    objectives: c.steps.map((s) => ({
      step_id: s.step_id,
      operation: s.action,
      observation_requirement: s.expected,
    })),
    cleanup_requirement: c.cleanup ?? null,
    source_controls: [...source.values()],
    states: [],
    transitions: [],
    observed_controls: [],
    seen_controls: new Set(),
    seen_states: new Set(),
  };
}
export function rememberObservation(memory, observation, transition) {
  const key = observationKey(observation.snapshot);
  if (transition) memory.transitions.push({ ...transition, to_state: key });
  if (!memory.seen_states.has(key)) {
    memory.seen_states.add(key);
    memory.states.push({
      state_key: key,
      page_id: observation.page_id,
      url: observation.snapshot.url,
      title: observation.snapshot.title,
    });
  }
  let added = 0;
  for (const control of observation.snapshot.controls ?? []) {
    const controlKey = semanticHash(control.locator);
    if (memory.seen_controls.has(controlKey)) continue;
    memory.seen_controls.add(controlKey);
    added++;
    memory.observed_controls.push({
      locator: control.locator,
      name: control.name,
      first_state: key,
      evidence: 'DOM_OBSERVED',
    });
  }
  return { state_key: key, new_controls: added, state_count: memory.states.length };
}
export function discoveryMemoryInput(memory) {
  return {
    case_id: memory.case_id,
    objectives: memory.objectives,
    cleanup_requirement: memory.cleanup_requirement,
    visited_states: memory.states.slice(-14),
    transitions: memory.transitions.slice(-14),
    observed_controls: memory.observed_controls.slice(-180),
    source_controls: memory.source_controls,
    unobserved_source_controls: memory.source_controls.filter(
      (c) => !memory.seen_controls.has(semanticHash(c.locator)),
    ),
    scope:
      'Technical observation only. Unobserved source controls are candidates for runtime checks, not automatically missing facts. No business expected result or cleanup ownership has been verified.',
  };
}
