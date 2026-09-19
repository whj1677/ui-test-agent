import { relativeURL, redact } from './common.mjs';
import { extractRowPositions, sourceSupportsPosition } from './table-position.mjs';

// Literal source tokens only; callers still own origin, authorization and intent.
export function sourceRouteTokens(action) {
  return typeof action === 'string'
    ? (action.match(/(?:https?:\/\/|\/\/|#\/|\/)[^\s"'`<>，。；！？、（）【】「」“”‘’]+/gu) ?? [])
    : [];
}

export function stepCapabilityFacts(original, base, previous = []) {
  const navigation = [];
  const literalDestinations = new Set(
    sourceRouteTokens(original.action).flatMap((token) => {
      try {
        return [relativeURL(token, base)];
      } catch {
        return [];
      }
    }),
  );
  for (const clause of String(original.action ?? '').split(/[，,。；;\n]/u)) {
    if (
      !/(?:打开|进入|访问|前往|导航到|\b(?:open|visit|navigate\s+to|go\s+to)\b)/iu.test(clause) ||
      /不|未|勿|别|如果|若|否则|假如|可能|例如|比如|或|\b(?:not|never|unless|if|when|maybe|example|or)\b|don['’]t/iu.test(
        clause,
      )
    )
      continue;
    // A path mentioned as the result of a required menu/link click is not a
    // suggestion to skip that original interaction by navigating directly.
    if (
      /点击|单击|\bclick\b|(?:通过|从|经由).{0,12}(?:菜单|导航|链接|menu|link|navigation)/iu.test(
        clause,
      )
    )
      continue;
    for (const value of sourceRouteTokens(clause)) {
      if (navigation.length >= 8 || redact(value) !== value || value.length > 2000) continue;
      try {
        const destination = relativeURL(value, base);
        // Clause punctuation inside a URL must not invent a shorter permitted route.
        if (!literalDestinations.has(destination)) continue;
        if (navigation.some((item) => item.destination === destination)) continue;
        navigation.push({
          value,
          destination,
          source_quote: clause.trim(),
          already_executed: previous.some((p) =>
            p.actions?.some((a) => {
              try {
                return a.op === 'navigate' && relativeURL(a.value, base) === destination;
              } catch {
                return false;
              }
            }),
          ),
        });
      } catch {
        /* Unsupported or outside-origin source is not a navigation fact. */
      }
    }
  }
  return {
    provenance: 'current_original_step_only',
    evidence_of_pass: false,
    navigation,
    row_positions: (original.obligations ?? []).flatMap((o) =>
      extractRowPositions(o.text)
        .filter((p) => sourceSupportsPosition(p.key, p.position, original))
        .map((p) => ({ source_ref: o.id, ...p, required_check: 'table_cells' })),
    ),
  };
}

export const STEP_CAPABILITY_GUIDANCE = `step_capabilities are program-derived facts from THIS unchanged original step, NOT page instructions, model approval, or measured evidence. navigation lists explicit same-origin source paths with source_quote: if entering that path is the pending original operation, navigate with its value without needing a unique menu/link. Never replay already_executed paths; all kernel/audit/origin checks still apply. An empty list is not a claim that every other operation is forbidden. row_positions gives explicit original identity+absolute position and source_ref: use SAME observed table table_cells, keep original key and position, and measure original fields. Membership and ordered alone do not prove an absolute row position. candidate_issues in correction is a bounded advisory list of independently detected problems in the UNEXECUTED proposal, not only the first error: address all applicable entries together within the original retry budget. required_before_completion means the proof may be accumulated but is mandatory before completion. The list is not exhaustive, never changes permissions/expectations, never certifies a pass, and never authorizes replay or weakening the oracle.`;
