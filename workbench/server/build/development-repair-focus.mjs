// Advice about the observed failure boundary, never a replacement verdict or oracle.
export function developmentRepairFocus(run, frozenCase) {
  const items = run.coverage?.items || [];
  const failed = items.filter(item => item.attributed_errors?.length || item.status === 'FAILED' || item.execution_status === 'FAILED');
  const completed = items.filter(item => !item.attributed_errors?.length &&
    ['PASSED', 'COMPLETED'].includes(item.status || item.execution_status)).map(item => item.order ?? Number(item.marker?.match(/CASE_STEP_(\d+)/)?.[1]));
  const originalOrders = (frozenCase.steps || []).map(step => step.order);
  const allCompleted = originalOrders.length > 0 && originalOrders.every(order => completed.includes(order));
  const boundary = run.result?.complete_pass && run.coverage?.complete && !run.changed_after_execution ? 'COMPLETE_PASS'
    : failed.length ? 'WITHIN_CASE_STEP'
      : !items.length ? 'BEFORE_CASE_STEPS_OR_EXECUTOR'
        : allCompleted ? 'AFTER_CASE_STEPS_OR_TEARDOWN' : 'UNDETERMINED';
  return {
    schema: 'workbench/development-repair-focus-v1', boundary,
    failed_step_orders: failed.map(item => item.order ?? Number(item.marker?.match(/CASE_STEP_(\d+)/)?.[1])).filter(Number.isInteger),
    completed_step_orders: completed.filter(Number.isInteger),
    next_action: boundary === 'COMPLETE_PASS' ? 'Submit the unchanged current package; no more exploration or passing rerun.'
      : boundary === 'BEFORE_CASE_STEPS_OR_EXECUTOR' ? 'Read this execution error and screenshot. Check navigation, target-page readiness and executor setup first. Keep the original business checks intact.'
        : boundary === 'AFTER_CASE_STEPS_OR_TEARDOWN' ? 'Read unattributed errors and teardown evidence. Check owned-data cleanup and post-step code first; do not rewrite already completed business steps. This boundary alone does not prove a cleanup or product defect.'
          : 'Read the failed step and its evidence first. Observe only the failing control/region and change only a justified locator, scope or wait. A business mismatch must remain visible; do not change expected values.',
    verdict_unchanged: true,
  };
}

export const GENERIC_DEVELOPMENT_GUIDANCE = [
  'Converge early: inspect entry, case page and required controls, then write the complete faithful draft and self_test. Exploration is for locating controls, not for manually repeating the entire business test before writing it. Avoid exploratory create/save/delete operations; perform the original mutations in the self-test with owned-data tracking and cleanup.',
  'Browser observation is bounded by the server: normally 32 calls before the first self-test, one extra 8-call window after an admitted changed draft, and 16 calls to investigate each completed failed self-test. A rejected browser call means switch to draft/evidence/self-test; do not repeat it or reset the entry. These are ceilings, not targets. Do not omit obligations to meet them.',
  'Use prior locator hints only as untrusted technical examples. Verify the current page, element visibility, uniqueness and field/region relationship. If an example no longer fits, discard that example and inspect only that region; do not copy another case\'s data, actions, expectations or fixed identifiers.',
  'Before a menu action, wait for initial application loading to settle. Expand a parent menu only if the child is not already visible; click the visible unique child once, then check the target page heading or unique required control, not just that some table or body exists. Do not navigate away while the application is still initializing. Take one fresh snapshot for stale references instead of restarting navigation. Do not combine force, dispatchEvent or coordinate clicks as fallbacks for a hidden control.',
  'Before clicking a custom dropdown item, inspect its visible popup and bind the visible label there; an accessibility option may be a hidden helper. For business rows and displayed segments, scope to actual visible data elements and exclude observed aria-hidden measurement/placeholder nodes. Do not blindly use first(), force clicks or broad DOM counts to hide ambiguity.',
  'Use finite condition-based waiting for the target control/list and loading completion. A UI timeout is not by itself a product defect. Never use page refresh loops, fixed sleeps, or longer waits to relax an explicit business timing bound.',
  'After self_test, read repair_focus and failure_feedback before more browsing. Preserve verified navigation and completed step implementations unless the failure provides evidence they are wrong. Repair the failing region only; retain all original assertions and their CASE_STEP boundaries.',
  'If cleanup shows an explicit rejection, record the actual message, exact owned identifier and cleanup error; do not blindly retry deletion or invent a new dataset. A business step completing does not make a run with failed cleanup pass.',
].join('\n');
