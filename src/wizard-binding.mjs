import { handoffLocator } from '../vendor/manual-ui/handoff_runtime.mjs';
import { fail } from './common.mjs';

// Fixed DOM algorithm: the page supplies facts, never selectors or executable code.
function wizardState(guard) {
  const visible = (e) =>
    !!e?.isConnected &&
    !!e.getClientRects().length &&
    !e.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !['hidden', 'collapse'].includes(getComputedStyle(e).visibility);
  const text = (e) => e.textContent.trim();
  const heads = [...document.querySelectorAll('h1')];
  const markers = [...document.querySelectorAll('[aria-current="step"]')];
  const path = location.pathname + location.hash;
  if (
    location.search ||
    path.includes('?') ||
    path.length > 2000 ||
    heads.length !== 1 ||
    markers.length !== 1 ||
    !visible(heads[0]) ||
    !visible(markers[0]) ||
    text(heads[0]).length > 150
  )
    return { error: 'CASE_NAMED_CONTEXT_MISMATCH' };
  const marker = markers[0],
    list = marker.parentElement;
  if (!['OL', 'UL'].includes(list?.tagName) || marker.tagName !== 'LI')
    return { error: 'CASE_NAMED_CONTEXT_MISMATCH' };
  const items = [...list.children];
  if (
    items.length < 2 ||
    items.length > 12 ||
    items.some((e) => e.tagName !== 'LI' || !visible(e) || !text(e) || text(e).length > 150) ||
    new Set(items.map(text)).size !== items.length
  )
    return { error: 'CASE_NAMED_CONTEXT_MISMATCH' };
  const current = text(marker),
    heading = text(heads[0]);
  if (guard && (guard.path !== path || guard.page_heading !== heading || guard.step !== current))
    return { error: 'CASE_NAMED_CONTEXT_MISMATCH' };
  const steps = [...document.querySelectorAll('h2,h3,legend')].filter((e) => text(e) === current);
  if (steps.length !== 1 || !visible(steps[0])) return { error: 'CASE_NAMED_CONTEXT_MISMATCH' };
  const stepHeading = steps[0],
    section = stepHeading.closest('section,fieldset');
  const forms = section ? [...section.querySelectorAll('form')] : [];
  if (
    !section ||
    !visible(section) ||
    forms.length !== 1 ||
    !visible(forms[0]) ||
    section.closest('dialog,[role="dialog"],[aria-modal="true"]')
  )
    return { error: 'CASE_NAMED_FORM_MISMATCH' };
  return {
    root: section,
    form: forms[0],
    marker,
    list,
    heading: heads[0],
    stepHeading,
    fact: { path, page_heading: heading, steps: items.map(text), current_step: current },
  };
}

export async function observeWizard(page) {
  const state = await page.evaluateHandle(wizardState, null);
  try {
    return await state.evaluate((s) => s.fact ?? null);
  } finally {
    await state.dispose();
  }
}

export async function caseNamedHandles(page, spec) {
  const state = await page.evaluateHandle(wizardState, spec.guard);
  let candidates = [],
    retained = [];
  try {
    const error = await state.evaluate((s) => s.error);
    if (error) fail(error);
    const locator =
      spec.target.kind === 'role'
        ? page.getByRole(spec.target.role, {
            name: spec.target.name,
            exact: true,
            includeHidden: true,
          })
        : handoffLocator(page, spec.target);
    candidates = await locator.elementHandles();
    for (const h of candidates) {
      const owned = await state.evaluate(
        (s, e) =>
          e.form === s.form &&
          s.form.contains(e) &&
          e.closest('section,fieldset') === s.root &&
          !e.closest('dialog,[role="dialog"],[aria-modal="true"]'),
        h,
      );
      if (owned) retained.push(h);
    }
    if (retained.length !== 1)
      fail(retained.length ? 'CASE_NAMED_NOT_UNIQUE' : 'CASE_NAMED_NOT_FOUND');
    const typeOK = await retained[0].evaluate((e, type) => {
      const nativeType =
        e.tagName === 'INPUT'
          ? e.type
          : { TEXTAREA: 'textarea', SELECT: 'select', BUTTON: 'button' }[e.tagName];
      return (
        nativeType === type &&
        !e.multiple &&
        !/password|token|secret|api.?key|credential|otp|密码|验证码|密钥/iu.test(
          [e.name, e.id, e.autocomplete, e.getAttribute('aria-label')].join(' '),
        )
      );
    }, spec.control_type);
    if (!typeOK) fail('CASE_NAMED_TYPE_MISMATCH');
    return retained;
  } catch (e) {
    retained = [];
    throw e;
  } finally {
    await Promise.allSettled(
      candidates.filter((h) => !retained.includes(h)).map((h) => h.dispose()),
    );
    await state.dispose();
  }
}

export async function captureCaseNamedGuard(page, spec, target) {
  const state = await page.evaluateHandle(wizardState, spec.guard);
  let guard;
  try {
    const error = await state.evaluate((s) => s.error);
    if (error) fail(error);
    guard = await state.evaluateHandle(
      (s, { target, spec }) => {
        const nodes = [s.root, s.form, s.marker, s.list, s.heading, s.stepHeading, target];
        const url = location.href;
        const attrs = (e) =>
          [...e.attributes]
            .filter(
              (a) => !['value', 'class', 'style', 'aria-invalid', 'aria-busy'].includes(a.name),
            )
            .map((a) => [a.name, a.value]);
        const matching = () => [...s.form.querySelectorAll('input,textarea,select,button')];
        const signature = () =>
          JSON.stringify([
            nodes.map(attrs),
            s.heading.textContent,
            s.stepHeading.textContent,
            [...s.list.children].map((e) => [attrs(e), e.textContent]),
            matching().map((e) => [
              attrs(e),
              e.labels ? [...e.labels].map((l) => l.textContent) : e.textContent,
            ]),
          ]);
        const initial = signature();
        const controls = matching();
        const valid = () =>
          location.href === url &&
          nodes.every((n) => n.isConnected) &&
          target.form === s.form &&
          s.form.contains(target) &&
          target.closest('section,fieldset') === s.root &&
          s.stepHeading.closest('section,fieldset') === s.root &&
          s.root.querySelectorAll('form').length === 1 &&
          document.querySelectorAll('[aria-current="step"]').length === 1 &&
          s.marker.getAttribute('aria-current') === 'step' &&
          [...document.querySelectorAll('h2,h3,legend')].filter(
            (e) => e.textContent.trim() === spec.guard.step,
          ).length === 1 &&
          document.querySelectorAll('h1').length === 1 &&
          signature() === initial &&
          matching().length === controls.length &&
          controls.every((n, i) => matching()[i] === n);
        let blocked = false;
        const safeValid = () => {
          try {
            return valid();
          } catch {
            return false;
          }
        };
        const events = [
          'pointerdown',
          'mousedown',
          'mouseup',
          'click',
          'keydown',
          'keypress',
          'keyup',
          'beforeinput',
          'input',
          'change',
          'submit',
        ];
        const handler = (event) => {
          if (
            event.target !== target &&
            !target.contains(event.target) &&
            !(event.type === 'submit' && event.target === s.form)
          )
            return;
          if (blocked || !safeValid()) {
            blocked = true;
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        };
        return {
          valid: safeValid,
          blocked: () => blocked,
          arm() {
            if (blocked || !safeValid()) return false;
            for (const event of events) document.addEventListener(event, handler, true);
            return true;
          },
          disarm() {
            for (const event of events) document.removeEventListener(event, handler, true);
            return blocked;
          },
        };
      },
      { target, spec },
    );
    const current = await caseNamedHandles(page, spec);
    try {
      if (
        !(await current[0].evaluate((e, old) => e === old, target)) ||
        !(await guard.evaluate((g) => g.valid()))
      )
        fail('CASE_NAMED_CONTEXT_CHANGED');
    } finally {
      await Promise.allSettled(current.map((h) => h.dispose()));
    }
    return guard;
  } catch (e) {
    await guard?.dispose();
    throw e;
  } finally {
    await state.dispose();
  }
}
