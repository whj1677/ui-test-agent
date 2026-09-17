import { fail, uid } from './common.mjs';

export const DISMISS_LABEL = /^(?:知道了|关闭|取消|close|cancel|got it)$/iu;
export function conditionalDismissSource(step, action) {
  const text = step?.action ?? '';
  return (
    /(?:若|如果|当|if).*?(?:出现|显示|present|appears?|visible)/iu.test(text) &&
    /(?:未|不|否则|else|otherwise|absent)/iu.test(text) &&
    text.includes(action.target?.name) &&
    text.includes(action.value)
  );
}

// Fixed DOM code. method=dialog is a structural restriction, not proof that
// arbitrary page listeners are pure. Existing network/write guards remain required.
export function dismissButtonFacts(element) {
  const dialog = element.closest('dialog'),
    form = element.form;
  const name = (element.getAttribute('aria-label') || element.innerText || '').trim();
  const title =
    dialog &&
    (dialog.getAttribute('aria-label') ||
      (dialog.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim());
  const visible = (e) =>
    !!e &&
    e.isConnected &&
    e.getClientRects().length > 0 &&
    !['hidden', 'collapse'].includes(getComputedStyle(e).visibility);
  const modals = [...document.querySelectorAll('dialog[open],[aria-modal="true"]')].filter(visible);
  const unsafe =
    /支付|付款|提交|删除|授权|同意|许可|隐私|合同|密码|验证码|登录|密钥|银行卡|\b(?:pay|payment|submit|delete|consent|permission|agree|password|token|login|sign in)\b/iu;
  const r = element.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    safe: !!(
      dialog &&
      visible(dialog) &&
      dialog.matches(':modal') &&
      modals.length === 1 &&
      modals[0] === dialog &&
      element.tagName === 'BUTTON' &&
      visible(element) &&
      !element.matches(':disabled') &&
      !element.closest('[inert],[aria-disabled="true"]') &&
      element.contains(hit) &&
      form &&
      dialog.contains(form) &&
      (element.getAttribute('formmethod') || form.getAttribute('method') || '').toLowerCase() ===
        'dialog' &&
      !element.hasAttribute('formaction') &&
      !form.hasAttribute('action') &&
      !element.hasAttribute('formtarget') &&
      !form.hasAttribute('target') &&
      !dialog.querySelector(
        'input,select,textarea,[contenteditable="true"],iframe,[role="checkbox"],[role="switch"]',
      ) &&
      /^(?:知道了|关闭|取消|close|cancel|got it)$/iu.test(name) &&
      !unsafe.test(dialog.innerText || '') &&
      dialog.getAttribute('role') !== 'alertdialog'
    ),
    name,
    title: title || '',
    text: (dialog?.innerText || '').slice(0, 2000),
    method: form?.getAttribute('method') || '',
    type: element.type,
    url: location.href,
  };
}

export async function resolveOptionalDialog(page, action, { timeout = 800, signal } = {}) {
  const deadline = Date.now() + Math.min(timeout, 800);
  let observed = 0;
  do {
    if (signal?.aborted) fail('STOPPED');
    const locator = page.getByRole('dialog', { name: action.target.name, exact: true });
    const dialogs = await locator.elementHandles();
    observed++;
    if (dialogs.length > 1) {
      await Promise.all(dialogs.map((h) => h.dispose()));
      fail('OPTIONAL_DIALOG_NOT_UNIQUE');
    }
    if (dialogs.length === 1) {
      const dialog = dialogs[0];
      const buttons = await locator
        .getByRole('button', { name: action.value, exact: true })
        .elementHandles();
      if (buttons.length !== 1) {
        await Promise.all([dialog, ...buttons].map((h) => h.dispose()));
        fail('OPTIONAL_DISMISS_NOT_UNIQUE');
      }
      const target = buttons[0],
        facts = await target.evaluate(dismissButtonFacts);
      if (!facts.safe || facts.title !== action.target.name || facts.name !== action.value) {
        await Promise.all([dialog, target].map((h) => h.dispose()));
        fail('OPTIONAL_DIALOG_UNSAFE');
      }
      return {
        target,
        dialog,
        facts,
        action,
        observed,
        key: '__ui_optional_' + uid().replaceAll('-', ''),
      };
    }
    if (
      await page
        .locator('dialog[open]:visible,[aria-modal="true"]:visible,[role="alertdialog"]:visible')
        .count()
    )
      fail('OPTIONAL_DIALOG_UNEXPECTED');
    if (Date.now() >= deadline) return { absent: true, observed, at: new Date().toISOString() };
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, Math.min(80, deadline - Date.now()))),
    );
  } while (true);
}

export async function recheckOptionalDialog(page, binding) {
  const { action, target, dialog, facts } = binding;
  const locator = page.getByRole('dialog', { name: action.target.name, exact: true });
  if (
    (await locator.count()) !== 1 ||
    !(await locator.evaluate((e, old) => e === old, dialog)) ||
    (await locator.getByRole('button', { name: action.value, exact: true }).count()) !== 1 ||
    !(await locator
      .getByRole('button', { name: action.value, exact: true })
      .evaluate((e, old) => e === old, target)) ||
    JSON.stringify(await target.evaluate(dismissButtonFacts)) !== JSON.stringify(facts)
  )
    fail('OPTIONAL_DIALOG_CHANGED');
}

export async function dispatchOptionalDialog(page, binding, timeout = 5000) {
  const deadline = Date.now() + timeout;
  const remaining = (cap) => {
    const left = deadline - Date.now();
    if (left <= 0) fail('OPTIONAL_DIALOG_TIMEOUT');
    return Math.min(left, cap);
  };
  await recheckOptionalDialog(page, binding);
  const { target, dialog, key, facts } = binding;
  await page.evaluate(
    ({ target, dialog, key, facts }) => {
      const state = {
        blocked: false,
        changed: false,
        clicked: false,
        form: target.form,
        handlers: [],
      };
      const observer = new MutationObserver(() => {
        state.changed = true;
      });
      observer.observe(dialog, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'submit']) {
        const handler = (event) => {
          const good =
            !state.blocked &&
            !state.changed &&
            target.isConnected &&
            dialog.isConnected &&
            target.closest('dialog') === dialog &&
            target.form === state.form &&
            location.href === facts.url &&
            dialog.matches(':modal') &&
            !observer.takeRecords().length &&
            (type === 'submit'
              ? state.clicked && event.target === state.form && event.submitter === target
              : !state.clicked && target.contains(event.target));
          if (!good) {
            state.blocked = true;
            event.preventDefault();
            event.stopImmediatePropagation();
          } else if (type === 'click') state.clicked = true;
        };
        window.addEventListener(type, handler, true);
        state.handlers.push([type, handler]);
      }
      state.observer = observer;
      window[key] = state;
    },
    { target, dialog, key, facts },
  );
  try {
    await target.click({ timeout: remaining(5000) });
    if (await page.evaluate((key) => window[key]?.blocked !== false, key))
      fail('OPTIONAL_DIALOG_CHANGED');
    if (page.url() !== facts.url) fail('OPTIONAL_DIALOG_CHANGED');
    await dialog.waitForElementState('hidden', { timeout: remaining(2000) });
    if (await page.getByRole('dialog', { name: binding.action.target.name, exact: true }).count())
      fail('OPTIONAL_DIALOG_STILL_VISIBLE');
  } finally {
    await page
      .evaluate((key) => {
        const s = window[key];
        s?.observer.disconnect();
        for (const [type, handler] of s?.handlers || [])
          window.removeEventListener(type, handler, true);
        delete window[key];
      }, key)
      .catch(() => {});
  }
}

export const CONDITIONAL_PROMPT = `For an original explicit "if this notice appears dismiss it, otherwise continue" step, use {action_id,op:"dismiss_optional",target:{kind:"role",role:"dialog",name:"EXACT original notice title",exact:true},value:"EXACT original dismiss button name"}. One bounded optional native-dialog close, not general branching; no repair_anchor/state, no cleanup, read_only plans only. Allowed labels: 知道了/关闭/取消/close/cancel/got it. Original text defines condition title and label even when the optional dialog was absent in observations; do NOT invent a DOM id or require it to appear first. If present runtime requires one matching native modal with a local method=dialog close form and no unsafe inputs/content; otherwise technical block. If absent records SKIPPED_NOT_PRESENT, not a click. Background table visible does NOT prove unobstructed operation. check:"unobstructed",expected:true checks the specific target's current visible viewport center and four inset corners by hit-testing plus modal/inert restrictions. Not whole-page, full-pixel, future or continuous proof. Explicit no-obstruction obligations require unobstructed on the EXACT observed target of the next original interaction (e.g. specified row detail button), never an unrelated menu/table or hidden/count alone. Keep table visible separately when viewing the table is another obligation. Both branches retain all original postconditions. Later actions still check actionability; no automatic replay or arbitrary popup dismissal.`;
