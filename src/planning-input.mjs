import { caseEntryURL, entryNavigationSteps, withoutEntryHints } from './case-entry-url.mjs';
import { dynamicRowEvidence } from './dynamic-row-evidence.mjs';

// Only already captured, safe same-origin routes are promoted.
// Page prose and model suggestions are never route evidence.
export function observedEntryPath(page, targetOrigin) {
  if (page?.login_page || !targetOrigin) return null;
  try {
    if (page.entry_hint_observation) return caseEntryURL(page.url, targetOrigin)?.path ?? null;
    const url = new URL(page.url);
    if (
      url.origin !== new URL(targetOrigin).origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return url.pathname;
  } catch {
    return null;
  }
}

// A read-only projection of the validated handoff, not a newly signed artifact.
export function scopedHandoff(handoff, caseId) {
  if (!handoff) return null;
  const case_bindings = handoff.case_bindings.filter((b) => b.case_id === caseId);
  const ids = new Set(case_bindings.flatMap((b) => b.steps.map((s) => s.action_id)));
  const actions = handoff.actions.filter((a) => ids.has(a.id));
  const refs = new Map();
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.source_refs))
      for (const ref of value.source_refs) {
        if (!refs.has(ref.path)) refs.set(ref.path, new Set());
        refs.get(ref.path).add(ref.anchor_id);
      }
    for (const [key, child] of Object.entries(value)) if (key !== 'source_refs') collect(child);
  }
  collect({ case_bindings, actions, authentication: handoff.authentication });
  const files = handoff.source.files
    .filter((f) => refs.has(f.path))
    .map((f) => ({ ...f, anchors: f.anchors.filter((a) => refs.get(f.path).has(a.id)) }));
  const { integrity, ...rest } = handoff;
  return {
    ...rest,
    view_kind: 'case_scoped_projection',
    source_artifact_integrity: integrity,
    source: { ...handoff.source, files },
    case_bindings,
    actions,
  };
}

export function planningInput(state, c, row, inputHash) {
  const handoff = scopedHandoff(state.handoff, c.case_id);
  const pages = (state.snapshots ?? []).filter(
    (p) =>
      (!p.entry_hint_observation ||
        (p.entry_hint_case_hash === inputHash && row.entry_hint?.status === 'OBSERVED')) &&
      (!p.discovery_case_id ||
        (p.discovery_case_id === c.case_id &&
          (!row.discovery?.job_id || p.discovery_job_id === row.discovery.job_id))),
  );
  const navigationSteps = entryNavigationSteps(c);
  const start = row.navigation_start ?? state.navigation_start;
  const startPath = observedEntryPath(start, state.target);
  if (
    navigationSteps.length &&
    startPath &&
    (!row.discovery?.job_id || start.navigation_job_id === row.discovery.job_id)
  )
    pages.unshift(start);
  // Put short, case-bound navigation/control facts before long source snippets.
  // These are locator candidates, never observations of test success.
  const controls = new Map();
  for (const action of handoff?.actions ?? [])
    for (const control of action.controls ?? []) {
      if (control.locator)
        controls.set(JSON.stringify(control.locator), { id: control.id, locator: control.locator });
    }
  const technical_context = {
    ...(navigationSteps.length
      ? {
          navigation: {
            execution_entry_path: startPath ?? caseEntryURL(state.target, state.target)?.path,
            start_evidence: startPath
              ? 'authenticated_start_observed'
              : 'target_only_requires_verification',
            required_navigation_steps: navigationSteps.map((s) => s.step_id),
            instruction:
              '有无入口URL均须保留原用例的菜单/导航点击；起始页观察是技术事实，需核对原用例首页前置条件，不能用直达子页替代导航验收。',
          },
        }
      : {}),
    entry_paths: [...new Set((handoff?.actions ?? []).map((a) => a.entry_path).filter(Boolean))],
    observed_entry_paths: [
      ...new Set(pages.map((page) => observedEntryPath(page, state.target)).filter(Boolean)),
    ],
    source_control_candidates: [...controls.values()],
    blocked_requests: pages.flatMap((page) => page.network_issues ?? []),
    blocked_requests_notice:
      '被拦截请求不代表只读查询；相关页面可能缺少数据，不能据此断言业务数据为空或自动扩大权限。可以继续寻找不依赖该请求的页面。',
    runtime_confirmation_required: true,
    dynamic_row_bindings: dynamicRowEvidence(pages),
    shared_control_evidence: row.shared_control_evidence ?? [],
    recovery_probes: (row.evidence_recoveries ?? []).flatMap((r) => r.useful_probes ?? []),
    ...(c.page_entry_url
      ? {
          entry_hint: {
            kind: 'operator_hint_not_source_evidence',
            status: row.entry_hint?.case_hash === inputHash ? row.entry_hint.status : 'UNOBSERVED',
            instruction:
              '入口URL仅是找页面的提示；只能使用实际观察到的页面与控件，不推导业务结果，不代替原步骤。',
            ...(entryNavigationSteps(c).length
              ? {
                  execution_entry_path: startPath ?? caseEntryURL(state.target, state.target)?.path,
                  required_navigation_steps: entryNavigationSteps(c).map((step) => step.step_id),
                  navigation_instruction:
                    '执行必须从上述首页开始，按原步骤点击菜单或导航并验证；不得用入口直达或navigate动作替代这些点击。',
                }
              : {}),
          },
        }
      : {}),
  };
  const mode = state.handoff?.authentication?.mode ?? 'operator_confirmed';
  const authentication = {
    mode,
    session_preflight_enforced: true,
    ...(mode === 'none'
      ? {}
      : { preflight_url: state.target, preflight_marker: state.auth_marker }),
  };
  return {
    original: withoutEntryHints(c),
    case_hash: inputHash,
    target_origin: new URL(state.target).origin,
    technical_context,
    pages,
    ...(row.discovery_memory && row.discovery_memory.job_id === row.discovery?.job_id
      ? { discovery_memory: row.discovery_memory }
      : {}),
    authentication,
    handoff,
    revision_feedback: row.plan_feedback ?? [],
  };
}
