import { fail, uid, now, semanticHash } from './common.mjs';
import { validateIntent } from './intent-plan.mjs';

const dispose = (handles) => Promise.allSettled(handles.map((h) => h.dispose()));
export async function runtimeIntentHandles(page, spec) {
  validateIntent(spec);
  if (
    new URL(page.url()).pathname !== spec.page.path ||
    new URL(page.url()).search ||
    new URL(page.url()).hash
  )
    fail('BINDING_PAGE_MISMATCH');
  const heads = page.locator('h1');
  if (
    (await heads.count()) !== 1 ||
    !(await heads.isVisible()) ||
    (await heads.innerText()).trim() !== spec.page.heading
  )
    fail('BINDING_PAGE_MISMATCH');
  const scopes = await page
    .getByRole(spec.scope.role, { name: spec.scope.name, exact: true, includeHidden: true })
    .elementHandles();
  let targets = [];
  try {
    if (scopes.length > 1) fail('BINDING_SCOPE_AMBIGUOUS');
    if (!scopes.length || !(await scopes[0].isVisible())) return [];
    const scoped = page.getByRole(spec.scope.role, {
      name: spec.scope.name,
      exact: true,
      includeHidden: true,
    });
    const identities = await scoped
      .getByRole('heading', { name: spec.scope.identity, exact: true, includeHidden: true })
      .elementHandles();
    try {
      if (
        identities.length !== 1 ||
        !(await identities[0].isVisible()) ||
        !(await identities[0].evaluate(
          (e, root) => e.closest('article,dialog,[role="article"],[role="dialog"]') === root,
          scopes[0],
        ))
      )
        fail('BINDING_OBJECT_MISMATCH');
    } finally {
      await dispose(identities);
    }
    targets = await scoped
      .getByRole(spec.role, { name: spec.name, exact: true, includeHidden: true })
      .elementHandles();
    if (targets.length > 1) fail('BINDING_TARGET_AMBIGUOUS');
    for (const target of targets) {
      const valid = await target.evaluate(
        (e, { root, role }) => {
          if (e.closest('article,dialog,[role="article"],[role="dialog"]') !== root) return false;
          if (role === 'button') return e.tagName === 'BUTTON' && e.type === 'button';
          if (role === 'textbox')
            return (
              e.tagName === 'TEXTAREA' ||
              (e.tagName === 'INPUT' && ['text', 'search', 'email', 'url', 'tel'].includes(e.type))
            );
          if (role === 'tab')
            return e.getAttribute('role') === 'tab' && (!e.form || e.type === 'button');
          return true;
        },
        { root: scopes[0], role: spec.role },
      );
      if (!valid) fail('BINDING_TYPE_MISMATCH');
    }
    return targets;
  } catch (e) {
    await dispose(targets);
    throw e;
  } finally {
    await dispose(scopes);
  }
}

// Browser-internal tripwire. No model code or persisted node attributes are used.
export async function captureRuntimeGuard(page, spec, target) {
  const guard = await target.evaluateHandle((element, spec) => {
    const roots = () => [
      ...document.querySelectorAll('article,dialog,[role="article"],[role="dialog"]'),
    ];
    const owner = (e) => e.closest('article,dialog,[role="article"],[role="dialog"]');
    const root = owner(element),
      url = location.href;
    const signature = (e) =>
      JSON.stringify([
        e.getAttribute('role'),
        e.getAttribute('aria-label'),
        e.getAttribute('aria-labelledby'),
        e.getAttribute('type'),
        e.getAttribute('id'),
        e.getAttribute('name'),
        e.textContent,
      ]);
    // Container topology, headings, labels and actionable targets only, not changing field values.
    const nodes = () => [
      ...document.querySelectorAll('h1'),
      ...roots().flatMap((r) => [
        r,
        ...r.querySelectorAll(
          'h2,h3,h4,h5,h6,[role="heading"],button,[role="tab"],input,textarea,label',
        ),
      ]),
    ];
    const sign = (e) =>
      roots().includes(e)
        ? JSON.stringify([
            e.getAttribute('role'),
            e.getAttribute('aria-label'),
            e.getAttribute('aria-labelledby'),
          ])
        : signature(e);
    const world = nodes().map((e) => [e, sign(e)]);
    const unchanged = () => {
      const current = nodes();
      return (
        location.href === url &&
        element.isConnected &&
        root?.isConnected &&
        owner(element) === root &&
        current.length === world.length &&
        world.every(([e, s]) => current.includes(e) && sign(e) === s)
      );
    };
    let blocked = false,
      armed = false;
    const events = ['pointerdown', 'mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'submit'];
    const handler = (e) => {
      if ((e.target === element || element.contains(e.target)) && !unchanged()) {
        blocked = true;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    return {
      valid: unchanged,
      arm() {
        if (!unchanged()) return false;
        for (const e of events) document.addEventListener(e, handler, true);
        armed = true;
        return true;
      },
      disarm() {
        if (armed) for (const e of events) document.removeEventListener(e, handler, true);
        armed = false;
      },
      blocked() {
        return blocked;
      },
    };
  }, spec);
  try {
    await assertRuntimeTarget(page, spec, target);
    if (!(await guard.evaluate((g) => g.valid()))) fail('BINDING_STALE');
    return guard;
  } catch (e) {
    await guard.dispose();
    throw e;
  }
}

export async function assertRuntimeTarget(page, spec, target) {
  const handles = await runtimeIntentHandles(page, spec);
  try {
    if (
      handles.length !== 1 ||
      !(await handles[0].evaluate((e, old) => e === old && e.isConnected, target))
    )
      fail('BINDING_STALE');
  } finally {
    await dispose(handles);
  }
}

export async function bindingReceipt(page, intent, scope, { deadline, signal } = {}) {
  const receipt = {
    id: uid(),
    at: now(),
    ...scope,
    intent_hash: semanticHash(intent),
    status: 'RESOLVING',
    mode: 'current_semantic_binding',
    regression_ready: false,
  };
  try {
    let found = false;
    do {
      if (signal?.aborted) fail('STOPPED');
      if (Date.now() >= deadline) fail('BINDING_DEADLINE_EXCEEDED');
      const handles = await runtimeIntentHandles(page, intent);
      try {
        found = handles.length === 1 && (await handles[0].isVisible());
        if (found)
          receipt.observation = await handles[0].evaluate((e) => {
            const key = '__ui_agent_runtime_binding_observer';
            if (!window[key]) {
              const state = {
                document_id: crypto.randomUUID(),
                revision: 0,
                next: 0,
                nodes: new WeakMap(),
              };
              state.observer = new MutationObserver(() => state.revision++);
              state.observer.observe(document, {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true,
              });
              window[key] = state;
            }
            const state = window[key];
            if (!state.nodes.has(e)) state.nodes.set(e, ++state.next);
            return {
              document_id: state.document_id,
              revision: state.revision,
              node_id: state.nodes.get(e),
            };
          });
      } finally {
        await dispose(handles);
      }
      if (found) break;
      await new Promise((r) => setTimeout(r, Math.min(40, Math.max(0, deadline - Date.now()))));
    } while (Date.now() < deadline);
    if (!found || Date.now() >= deadline) fail('BINDING_DEADLINE_EXCEEDED');
    receipt.status = 'VERIFIED';
    receipt.page = structuredClone(intent.page);
    receipt.object_identity = intent.scope.identity;
    receipt.observed_at = now();
  } catch (e) {
    receipt.status = 'REJECTED';
    receipt.code = e.code ?? 'BINDING_FAILED';
  }
  return receipt;
}
