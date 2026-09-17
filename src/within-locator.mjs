import { handoffLocator } from '../vendor/manual-ui/handoff_runtime.mjs';
import { fail } from './common.mjs';

// Fixed semantic scopes only. No model selectors or code enter the DOM algorithm.
function ownedBy(element, root) {
  const semanticRole = (e) =>
    e.getAttribute('role') || { ARTICLE: 'article', LI: 'listitem', DIALOG: 'dialog' }[e.tagName];
  for (let node = element; node; node = node.parentElement) {
    if (['article', 'listitem', 'dialog'].includes(semanticRole(node))) return node === root;
  }
  return false;
}

export async function withinHandles(page, spec) {
  let scoped = page.getByRole(spec.scope.role, {
    ...(spec.scope.name !== undefined ? { name: spec.scope.name, exact: true } : {}),
    includeHidden: true,
  });
  if (spec.scope.heading !== undefined)
    scoped = scoped.filter({
      has: page.getByRole('heading', {
        name: spec.scope.heading,
        exact: true,
        includeHidden: true,
      }),
    });
  const roots = await scoped.elementHandles();
  let targets = [],
    retained = false;
  try {
    if (roots.length > 1) fail('WITHIN_SCOPE_NOT_UNIQUE');
    if (!roots.length) return [];
    const root = roots[0];
    if (spec.scope.heading !== undefined) {
      const anchors = await scoped
        .getByRole('heading', { name: spec.scope.heading, exact: true, includeHidden: true })
        .elementHandles();
      try {
        if (anchors.length !== 1 || !(await anchors[0].evaluate(ownedBy, root)))
          fail('WITHIN_IDENTITY_UNOWNED');
      } finally {
        await Promise.allSettled(anchors.map((h) => h.dispose()));
      }
    }
    if (!spec.target) {
      targets = [root];
      retained = true;
    } else {
      targets = await handoffLocator(scoped, spec.target).elementHandles();
      if (targets.length > 1) fail('WITHIN_TARGET_NOT_UNIQUE');
      for (const target of targets)
        if (!(await target.evaluate(ownedBy, root))) fail('WITHIN_TARGET_UNOWNED');
    }
    for (const target of targets)
      if (
        !(await target.evaluate(
          (e, r) => e.isConnected && r.isConnected && (e === r || r.contains(e)),
          root,
        ))
      )
        fail('WITHIN_SCOPE_CHANGED');
    return targets;
  } catch (error) {
    await Promise.allSettled(targets.filter((h) => !roots.includes(h)).map((h) => h.dispose()));
    retained = false;
    throw error;
  } finally {
    if (!retained) await Promise.allSettled(roots.map((h) => h.dispose()));
  }
}

// Capture before evidence callbacks, then arm around the existing Playwright operation.
// The DOM identity world is internal and never enters logs/model context. It detects
// recycled/moved nodes and identity collisions, not the truth of application business effects.
export async function captureWithinGuard(page, spec, target) {
  if (spec?.kind !== 'within') return null;
  const current = await withinHandles(page, spec);
  try {
    if (current.length !== 1 || !(await current[0].evaluate((e, old) => e === old, target)))
      fail('WITHIN_SCOPE_CHANGED');
  } finally {
    await Promise.allSettled(current.map((h) => h.dispose()));
  }
  const guard = await target.evaluateHandle((element, { role }) => {
    const semanticRole = (e) =>
      e.getAttribute('role') || { ARTICLE: 'article', LI: 'listitem', DIALOG: 'dialog' }[e.tagName];
    const owner = (e) => {
      for (let n = e; n; n = n.parentElement)
        if (['article', 'listitem', 'dialog'].includes(semanticRole(n))) return n;
      return null;
    };
    const root = owner(element),
      url = location.href,
      form = element.form;
    const attrs = (e) =>
      [
        'role',
        'aria-label',
        'aria-labelledby',
        'id',
        'name',
        'type',
        'href',
        'form',
        'formaction',
        'formmethod',
      ].map((k) => [k, e.getAttribute(k)]);
    const label = (e) => [
      attrs(e),
      (e.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent || ''),
    ];
    const heads = (e) =>
      [...e.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')]
        .filter((h) => owner(h) === e)
        .map((h) => [label(h), h.textContent]);
    const fingerprint = (e) => JSON.stringify([label(e), heads(e)]);
    const containers = () =>
      [
        ...document.querySelectorAll(
          'article,li,dialog,[role="article"],[role="listitem"],[role="dialog"]',
        ),
      ].filter((e) => semanticRole(e) === role);
    const world = containers().map((node) => ({ node, signature: fingerprint(node) }));
    const targetSignature = JSON.stringify([
      label(element),
      ['BUTTON', 'A'].includes(element.tagName) ? element.textContent : null,
    ]);
    const unchanged = () => {
      if (
        !element.isConnected ||
        !root?.isConnected ||
        owner(element) !== root ||
        location.href !== url
      )
        return false;
      const nodes = containers();
      return (
        nodes.length === world.length &&
        world.every((old) => nodes.includes(old.node) && old.signature === fingerprint(old.node)) &&
        targetSignature ===
          JSON.stringify([
            label(element),
            ['BUTTON', 'A'].includes(element.tagName) ? element.textContent : null,
          ])
      );
    };
    let blocked = false,
      armed = false;
    const events = [
      'pointerdown',
      'mousedown',
      'mouseup',
      'click',
      'auxclick',
      'dblclick',
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
        event.target !== element &&
        !element.contains(event.target) &&
        !(event.type === 'submit' && event.target === form)
      )
        return;
      if (!unchanged()) {
        blocked = true;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    return {
      valid: unchanged,
      arm() {
        if (!unchanged()) return false;
        for (const name of events) document.addEventListener(name, handler, true);
        armed = true;
        return true;
      },
      disarm() {
        if (armed) for (const name of events) document.removeEventListener(name, handler, true);
        armed = false;
        return blocked;
      },
      blocked() {
        return blocked;
      },
    };
  }, spec.scope);
  // The first resolution and the signature capture are separate browser turns.
  // Re-prove the approved identity after capture; a recycled node must not be
  // accepted merely because its new identity became the signature baseline.
  try {
    const verified = await withinHandles(page, spec);
    try {
      if (verified.length !== 1 || !(await verified[0].evaluate((e, old) => e === old, target)))
        fail('WITHIN_SCOPE_CHANGED');
    } finally {
      await Promise.allSettled(verified.map((h) => h.dispose()));
    }
    if (!(await guard.evaluate((state) => state.valid()))) fail('WITHIN_SCOPE_CHANGED');
    return guard;
  } catch (error) {
    await releaseWithinGuard(guard);
    throw error;
  }
}
export async function releaseWithinGuard(guard) {
  if (!guard) return;
  try {
    await guard.evaluate((state) => state.disarm());
  } catch {
  } finally {
    await guard.dispose().catch(() => {});
  }
}
