export const BROWSER_SEMANTICS_VERSION = 'browser-semantics-v1';
export const BROWSER_SEMANTICS_RULES = [
  'Frozen case expectations are the sole expected-result source; browser observations only supply control and locator implementation facts, never replacement expectations.',
  'Distinguish user-visible option labels from HTML option values. Select by the required label when the case names visible text. Do not add internal encoding constraints absent from the case.',
  'Observe the current selected option after each change (for example live selectedOptions or option:checked). The initial [selected] attribute alone does not express current selection. Check every later required selected state as well.',
  'For visible/displayed control counts, restrict to visible controls within the region named by the case; hidden DOM nodes in other panels are not displayed controls. Match the assertion scope to the original requirement.',
  'toHaveValue and toHaveCount remain valid when the original requirement actually concerns those values or that complete collection. Choose the assertion by semantics, not by a blanket matcher ban.',
].join('\n');
