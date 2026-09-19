import { fail } from './common.mjs';

// A read-only semantic lookup by the observed term, never by the expected value.
// The enclosing within locator independently verifies object scope/ownership.
export async function definitionHandles(scope, spec) {
  const state = await scope.evaluateHandle((root, name) => {
    const terms = [...root.querySelectorAll('dt')];
    const text = (e) => (e.textContent ?? '').replace(/\s+/gu, ' ').trim();
    const matches = terms.filter((e) => e.closest('dl') && text(e) === name);
    if (matches.length > 1) return { error: 'DEFINITION_NOT_UNIQUE' };
    if (!matches.length) return { missing: true };
    const term = matches[0],
      value = term.nextElementSibling;
    if (
      term.previousElementSibling?.tagName === 'DT' ||
      value?.tagName !== 'DD' ||
      value.nextElementSibling?.tagName === 'DD' ||
      value.closest('dl') !== term.closest('dl') ||
      value.querySelector('dl,table,input,select,textarea,button,a,[contenteditable="true"]')
    )
      return { error: 'DEFINITION_STRUCTURE_UNSUPPORTED' };
    return { value };
  }, spec.name);
  let handle;
  try {
    const status = await state.evaluate((s) => ({ error: s.error, missing: s.missing }));
    if (status.error) fail(status.error);
    if (status.missing) return [];
    handle = await state.getProperty('value');
    const value = handle.asElement();
    if (!value) fail('DEFINITION_CHANGED');
    return [value];
  } catch (error) {
    await handle?.dispose();
    throw error;
  } finally {
    await state.dispose();
  }
}
