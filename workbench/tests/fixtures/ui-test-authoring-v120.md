---
name: ui-test-authoring
description: Guidance for authoring Playwright UI tests from confirmed cases in the workbench.
version: 1.2.0
---

# UI test authoring guidance

Map every action and expected result in each frozen case step to an observable check. Keep the original step order and report obligations that cannot be verified. A green page or script run does not replace a missing obligation.

Check that the initial state can distinguish the required change from a no-op. Empty filters before reset cannot prove clearing a previously populated filter; a populated page number can still prove returning to page one. Review these as separate obligations. Do not silently add a keyword, filter or business rule absent from the frozen case. Report the affected obligation as needing analysis when no authorized initial data can discriminate it. A conditional assertion whose guard is false for all frozen inputs provides no coverage, even if it appears in the file and the run passes.

For asynchronous UI changes, wait for the relevant real response, loading completion or visible state transition, then assert the resulting state. Do not use fixed sleeps, broad catch-and-ignore logic, or an observed value as a substitute for the frozen expectation.

Register a response wait tied to the current request path and input before the triggering action. After that response completes, wait for the current render to finish through an observable state change and retrying DOM assertion; an old page number or row already present before the action does not prove this refresh completed. Response data may synchronize the check but must not become the business oracle. Preserve false and unknown observations when a render or requirement cannot be verified.

For field assertions, bind the business object, field label and value separately. For collection assertions, establish whether the requirement refers to the visible page or the full collection; observe the required scope before checking membership, count or exclusion.

When semantically identical to the frozen expectation, prefer assertions that retain structured actual and expected values: `toEqual` for an exact array, `toBe` for a scalar, and native locator retry assertions such as `toHaveText` or `toHaveCount` for fields and counts. A containment requirement must not become exact whole-array equality just to collect evidence. If appropriate, assert the exact business membership predicate with `toBe(true)` and retain the observed collection separately; otherwise report the collection values as unverified. Do not claim structured values were captured from `toContain` or soft assertions when the runner has only a message or pass/fail result.

Preserve failing observations and defects. If the page conflicts with a frozen expectation, retain the failure and evidence; do not revise the expectation, skip the check or turn a known mismatch green.
