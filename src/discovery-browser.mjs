import { snapshot } from './browser.mjs';
import { runtimeLocator as handoffLocator } from './row-locator.mjs';
import { fail, hash, redact, relativeURL, uid } from './common.mjs';
import { validateLocator } from './plans.mjs';
import { runAdapter } from './adapter-runtime.mjs';
import {
  dismissButtonFacts,
  conditionalDismissSource,
  resolveOptionalDialog,
  dispatchOptionalDialog,
} from './optional-dialog.mjs';

const DANGEROUS_NAME =
  /(?:保存|提交|删除|移除|确认|确定|启用|停用|启动|停止|登出|注销|退出|下载|导出|发布|执行|重置|重启|批准|拒绝|支付|付款|发送|上传|应用|清空|清除|销毁|终止|撤销|恢复|切换状态|\b(?:save|submit|delete|remove|confirm|apply|enable|disable|activate|deactivate|start|stop|logout|log\s*out|sign\s*out|download|export|publish|execute|run|reset|restart|approve|reject|pay|send|upload|clear|destroy|terminate|revoke|restore|ok)\b)/iu;
const OPEN_NAME =
  /(?:详情|查看|新增|新建|添加|编辑|修改|筛选|过滤|查询|搜索|展开|收起|菜单|更多|返回|关闭|取消|\b(?:detail|details|view|new|add|create|edit|filter|search|expand|collapse|menu|more|back|close|cancel)\b)/iu;
const DANGEROUS_ROUTE =
  /(?:^|[\/_.?=&:#-])(?:save|submit|delete|remove|confirm|enable|disable|activate|deactivate|start|stop|logout|log-out|signout|sign-out|download|export|publish|execute|reset|restart|approve|reject|pay|send|upload|clear|destroy|terminate|revoke|restore)(?:$|[\/_.?=&:#-])|保存|提交|删除|启用|停用|登出|注销|下载|导出/iu;
const DOWNLOAD_PATH =
  /\.(?:csv|xlsx?|docx?|pptx?|pdf|zip|rar|7z|exe|msi|dmg|apk|tar|gz)(?:$|[?#])/iu;
const SENSITIVE_CONTROL =
  /(?:password|passwd|secret|token|credential|api.?key|authorization|cookie|session|one.?time|passcode|credit.?card|\botp\b|cc-|密码|口令|密钥|验证码|银行卡|身份证|手机号|账号|账户|邮箱)/iu;
const SAFE_ERROR =
  /^(?:DISCOVERY_[A-Z_]+|ADAPTER_[A-Z_]+|ROW_[A-Z_]+|OPTIONAL_[A-Z_]+|STOPPED|AUTH_REQUIRED|BROWSER_REQUIRED|OUTSIDE_TARGET_ORIGIN|SENSITIVE_URL|INVALID_ROUTE|INVALID_TARGET_URL|WRITE_NOT_AUTHORIZED|NATIVE_DIALOG_UNSUPPORTED)$/;
const safeError = (error) =>
  SAFE_ERROR.test(error?.code ?? '')
    ? error.code
    : error?.name === 'TimeoutError'
      ? 'DISCOVERY_ACTION_TIMEOUT'
      : 'DISCOVERY_BROWSER_FAILED';
const safeURL = (value) => {
  try {
    const u = new URL(value);
    return redact(
      u.origin +
        u.pathname +
        (u.hash &&
        !u.hash.includes('?') &&
        !/(?:token|password|secret|credential|api.?key)[=:]/i.test(u.hash)
          ? u.hash
          : ''),
    );
  } catch {
    return '';
  }
};

// Operator-reviewed technical contracts are capabilities, never model output.
// Even a valid contract cannot authorize form submission or network writes.
function interactionContracts(input = []) {
  if (!Array.isArray(input) || input.length > 1000) fail('DISCOVERY_INTERACTION_CONTRACT_INVALID');
  return input.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.keys(item).some(
        (k) => !['case_id', 'entry_path', 'locator', 'operation', 'values', 'evidence'].includes(k),
      ) ||
      typeof item.case_id !== 'string' ||
      !item.case_id ||
      !['fill', 'select'].includes(item.operation)
    )
      fail('DISCOVERY_INTERACTION_CONTRACT_INVALID');
    if (
      typeof item.entry_path !== 'string' ||
      !item.entry_path.startsWith('/') ||
      item.entry_path.startsWith('//') ||
      item.entry_path.length > 2048
    )
      fail('DISCOVERY_INTERACTION_CONTRACT_INVALID');
    let entry_path;
    try {
      const entry = new URL(checkedURL(item.entry_path, 'http://discovery-contract.invalid/'));
      entry_path = entry.pathname + entry.search + entry.hash;
    } catch {
      fail('DISCOVERY_INTERACTION_CONTRACT_INVALID');
    }
    try {
      validateLocator(item.locator);
    } catch {
      fail('DISCOVERY_INTERACTION_CONTRACT_INVALID');
    }
    if (
      !Array.isArray(item.values) ||
      !item.values.length ||
      item.values.length > (item.operation === 'fill' ? 3 : 8) ||
      new Set(item.values).size !== item.values.length ||
      item.values.some(
        (v) =>
          typeof v !== 'string' ||
          v.length > 200 ||
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v) ||
          redact(v) !== v,
      )
    )
      fail('DISCOVERY_INTERACTION_CONTRACT_INVALID');
    const evidence = item.evidence;
    if (
      !evidence ||
      typeof evidence !== 'object' ||
      Array.isArray(evidence) ||
      Object.keys(evidence).some((k) => !['kind', 'ref', 'no_business_write'].includes(k)) ||
      evidence.kind !== 'source_review' ||
      typeof evidence.ref !== 'string' ||
      !evidence.ref.trim() ||
      evidence.ref.length > 1000 ||
      evidence.no_business_write !== true
    )
      fail('DISCOVERY_INTERACTION_CONTRACT_INVALID');
    return { ...structuredClone(item), entry_path };
  });
}

function contractPageMatches(contract, url) {
  try {
    const current = new URL(url);
    return current.pathname + current.search + current.hash === contract.entry_path;
  } catch {
    return false;
  }
}

function caseInputText(c) {
  const values = [];
  const visit = (x) => {
    if (typeof x === 'string' || typeof x === 'number') values.push(String(x));
    else if (x && typeof x === 'object') for (const value of Object.values(x)) visit(value);
  };
  visit(c?.data);
  visit(c?.test_data);
  for (const step of c?.steps ?? []) visit(step.action);
  return values;
}

function checkedURL(value, base) {
  const resolved = relativeURL(value, base),
    url = new URL(resolved);
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname + url.search + url.hash);
  } catch {
    fail('INVALID_ROUTE');
  }
  if (DANGEROUS_ROUTE.test(decoded) || DOWNLOAD_PATH.test(decoded))
    fail('DISCOVERY_DANGEROUS_ROUTE');
  return resolved;
}

// This script is fixed application code. No model text is ever evaluated.
function installRuntime(key) {
  if (window[key]) return;
  const state = { document_id: crypto.randomUUID(), revision: 0, permit: null, blocked: null };
  state.observer = new MutationObserver(() => state.revision++);
  state.observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  state.flush = () => {
    if (state.observer.takeRecords().length) state.revision++;
    return state.revision;
  };
  state.receivesEvents = (element) => {
    // Hit-test the visible intersection. Offscreen controls remain discoverable;
    // Playwright scrolls them before dispatch. Modal background is never eligible.
    const modals = Array.from(document.querySelectorAll('[aria-modal="true"],dialog[open]')).filter(
      (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden',
    );
    if (modals.length && !modals.some((e) => e.contains(element))) return false;
    const r = element.getBoundingClientRect(),
      left = Math.max(0, r.left),
      right = Math.min(innerWidth, r.right),
      top = Math.max(0, r.top),
      bottom = Math.min(innerHeight, r.bottom);
    if (right <= left || bottom <= top) return true;
    const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    return !!hit && element.contains(hit);
  };
  state.metadata = (element) => ({
    connected: element.isConnected,
    tag: element.tagName,
    role: element.getAttribute('role'),
    type: element.type ?? '',
    declaredType: element.getAttribute('type'),
    form: !!element.form,
    disabled:
      !!element.disabled ||
      element.matches(':disabled') ||
      element.getAttribute('aria-disabled') === 'true',
    href: element.getAttribute('href'),
    download: element.hasAttribute('download'),
    target: element.getAttribute('target'),
    expanded: element.hasAttribute('aria-expanded'),
    popup: element.hasAttribute('aria-haspopup'),
    checked: element.hasAttribute('aria-checked'),
    pressed: element.hasAttribute('aria-pressed'),
    editable: element.isContentEditable,
    navigation_owner_name:
      element.tagName === 'SPAN'
        ? (element.closest('[role="menuitem"],[role="treeitem"],li')?.innerText ?? '')
            .trim()
            .slice(0, 400)
        : '',
    navigation_leaf:
      element.tagName === 'SPAN' &&
      !element.children.length &&
      !!element.closest('nav,aside,[role="menu"]') &&
      !element.closest(
        'form,button,a,input,[role="button"],[role="checkbox"],[role="switch"],[aria-checked],[aria-pressed],[aria-disabled="true"]',
      ),
    name: (element.getAttribute('aria-label') || element.innerText || element.textContent || '')
      .trim()
      .slice(0, 200),
    input_name: element.getAttribute('name') ?? '',
    id: element.id ?? '',
    autocomplete: element.getAttribute('autocomplete') ?? '',
    readonly: !!element.readOnly,
    label: element.labels?.[0]?.innerText?.trim().slice(0, 200) ?? '',
    ...(['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
      ? { value: element.type === 'password' ? '' : element.value }
      : {}),
    ...(element.tagName === 'SELECT'
      ? {
          multiple: element.multiple,
          options: Array.from(element.options).map((o) => ({
            value: o.value,
            label: o.label,
            disabled: o.disabled || o.parentElement?.disabled === true,
            hidden: o.hidden,
          })),
        }
      : {}),
    visible: !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden',
    receives_events: state.receivesEvents(element),
  });
  window[key] = state;
  for (const type of [
    'pointerdown',
    'mousedown',
    'mouseup',
    'click',
    'auxclick',
    'dblclick',
    'submit',
  ]) {
    document.addEventListener(
      type,
      (event) => {
        if (type === 'submit' && state.dialogSubmit) {
          const p = state.dialogSubmit;
          state.dialogSubmit = null;
          if (
            p.element.isConnected &&
            event.submitter === p.element &&
            event.target === p.element.form &&
            p.url === location.href &&
            p.metadata === JSON.stringify(state.metadata(p.element)) &&
            (p.element.getAttribute('formmethod') || p.element.form?.getAttribute('method')) ===
              'dialog'
          )
            return;
        }
        const permit = state.permit;
        const allowed =
          type !== 'submit' &&
          permit &&
          permit.element.isConnected &&
          permit.element.contains(event.target) &&
          permit.url === location.href &&
          permit.metadata === JSON.stringify(state.metadata(permit.element));
        if (!allowed) {
          event.preventDefault();
          event.stopImmediatePropagation();
          state.blocked = 'DISCOVERY_DISPATCH_BLOCKED';
          return;
        }
        if (type === 'click') {
          if (permit.optionalDismiss) state.dialogSubmit = permit;
          state.permit = null;
        }
      },
      true,
    );
  }
}

async function metadata(handle, key) {
  return handle.evaluate((element, key) => window[key]?.metadata(element), key);
}

function candidateKind(meta, name, base, optionalDismiss = false) {
  if (
    !meta.connected ||
    !meta.visible ||
    !meta.receives_events ||
    meta.disabled ||
    meta.download ||
    meta.editable ||
    meta.checked ||
    meta.pressed ||
    DANGEROUS_NAME.test(name + ' ' + meta.name + ' ' + meta.navigation_owner_name)
  )
    return null;
  if (
    ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL'].includes(meta.tag) ||
    [
      'checkbox',
      'radio',
      'switch',
      'slider',
      'spinbutton',
      'textbox',
      'menuitemcheckbox',
      'menuitemradio',
    ].includes(meta.role)
  )
    return null;
  if (
    meta.tag === 'BUTTON' &&
    ((meta.type !== 'button' && meta.form) || meta.declaredType === 'submit')
  )
    return optionalDismiss ? 'dismiss' : null;
  if (meta.tag === 'BUTTON' && meta.type === 'reset') return null;
  if (meta.href !== null) {
    if (meta.target && meta.target !== '_self') return null;
    try {
      checkedURL(meta.href, base);
    } catch {
      return null;
    }
    return 'link';
  }
  if (['menuitem', 'treeitem', 'tab'].includes(meta.role)) return meta.role;
  if (meta.navigation_leaf) return 'menuitem';
  if (meta.tag === 'SUMMARY' || meta.expanded || meta.popup) return 'expand';
  if ((meta.tag === 'BUTTON' || meta.role === 'button') && OPEN_NAME.test(name + ' ' + meta.name))
    return 'open';
  return null;
}

function interactionKind(meta, name, contract) {
  if (
    !meta.connected ||
    !meta.visible ||
    !meta.receives_events ||
    meta.disabled ||
    meta.readonly ||
    meta.editable
  )
    return null;
  const descriptor = [
    name,
    meta.name,
    meta.label,
    meta.input_name,
    meta.id,
    meta.autocomplete,
  ].join(' ');
  if (SENSITIVE_CONTROL.test(descriptor) || DANGEROUS_NAME.test(descriptor)) return null;
  if (
    contract.operation === 'fill' &&
    (meta.tag === 'TEXTAREA' ||
      (meta.tag === 'INPUT' &&
        ['text', 'search', 'number', 'date', 'time', 'datetime-local'].includes(meta.type)))
  )
    return 'input';
  if (contract.operation === 'select' && meta.tag === 'SELECT' && !meta.multiple)
    return 'selection';
  return null;
}

/** Read-only exploration on a separate context of the already authenticated browser. */
export class DiscoveryBrowser {
  constructor(
    session,
    task,
    { signal, onEvent = () => {}, maxSteps = 24, timeoutMs = 120000 } = {},
  ) {
    if (
      !Number.isInteger(maxSteps) ||
      maxSteps < 1 ||
      maxSteps > 100 ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 1800000
    )
      fail('DISCOVERY_INVALID_BUDGET');
    this.session = session;
    this.task = task;
    this.signal = signal;
    this.onEvent = onEvent;
    this.maxSteps = maxSteps;
    this.timeoutMs = timeoutMs;
    this.interactions = interactionContracts(task.discovery_interactions);
    this.caseId = null;
    this.caseInputs = [];
    this.context = null;
    this.page = null;
    this.step = 0;
    this.current = null;
    this.candidates = new Map();
    this.visits = new Map();
    this.runtimeKey = '__discovery_' + uid().replaceAll('-', '');
    this.guard = { allowWrites: false, dirty: false, blocked: null };
    this.blockedRequest = null;
    this.initialNetworkIssues = [];
    this.stopped = null;
    this.busy = false;
    this.stopPromise = new Promise((_, reject) => {
      this.rejectStop = reject;
    });
    this.stopPromise.catch(() => {});
    this.onAbort = () => this._stop('STOPPED');
  }

  _stop(code) {
    if (this.stopped) return;
    this.stopped = code;
    this.rejectStop(Object.assign(new Error(code), { code }));
    this.contextClosePromise = this.context?.close().catch(() => {});
  }
  _check({ page = true } = {}) {
    if (this.signal?.aborted) this._stop('STOPPED');
    if (this.stopped) fail(this.stopped);
    if (this.guard.blocked) fail(this.guard.blocked);
    if (page && (!this.page || this.page.isClosed())) fail('DISCOVERY_BROWSER_REQUIRED');
  }
  async _emit(type, detail = {}) {
    this._check({ page: false });
    try {
      await Promise.race([
        Promise.resolve().then(() =>
          this.onEvent({
            type,
            at: new Date().toISOString(),
            step: this.step,
            url: safeURL(this.page?.url() ?? this.task.target),
            ...detail,
          }),
        ),
        this.stopPromise,
      ]);
    } catch (error) {
      if (this.stopped) fail(this.stopped);
      fail('DISCOVERY_EVIDENCE_FAILED');
    }
  }
  async _run(operation) {
    if (this.busy) fail('DISCOVERY_BUSY');
    this.busy = true;
    try {
      this._check({ page: false });
      return await Promise.race([operation(), this.stopPromise]);
    } catch (error) {
      const code = this.stopped ?? this.guard.blocked ?? safeError(error);
      // Failure evidence has a bounded wait and never forwards browser error text.
      let timer;
      try {
        await Promise.race([
          Promise.resolve().then(() =>
            this.onEvent({
              type: 'DISCOVERY_FAILED',
              at: new Date().toISOString(),
              step: this.step,
              url: safeURL(this.page?.url() ?? this.task.target),
              code,
              blocked: this.blockedRequest,
            }),
          ),
          new Promise((resolve) => {
            timer = setTimeout(resolve, 250);
          }),
        ]);
      } catch {
      } finally {
        clearTimeout(timer);
      }
      throw Object.assign(new Error(code), {
        code,
        ...(this.blockedRequest ? { blocked: this.blockedRequest } : {}),
      });
    } finally {
      this.busy = false;
    }
  }
  _block(code, request) {
    if (!this.guard.blocked) {
      this.guard.blocked = code;
      if (request) {
        let pathname = '';
        try {
          pathname = new URL(request.url()).pathname;
        } catch {}
        this.blockedRequest = { method: request.method(), path: redact(pathname) };
      }
    }
  }
  async _release() {
    await Promise.allSettled(
      [...new Set([...this.candidates.values()].map((candidate) => candidate.handle))].map(
        (handle) => handle.dispose(),
      ),
    );
    this.candidates.clear();
    this.current = null;
  }
  async _state() {
    this._check();
    return this.page.evaluate((key) => {
      const s = window[key];
      return s
        ? {
            document_id: s.document_id,
            revision: s.flush(),
            url: location.href,
            blocked: s.blocked,
          }
        : null;
    }, this.runtimeKey);
  }

  async open() {
    return this._run(async () => {
      if (this.context) fail('DISCOVERY_ALREADY_OPEN');
      if (
        !this.session.active(this.task.id) ||
        !this.session.authenticated ||
        !this.session.loginPage ||
        this.session.loginPage.isClosed()
      )
        fail('AUTH_REQUIRED');
      const entry = checkedURL(this.session.loginPage.url(), this.task.target);
      this.signal?.addEventListener('abort', this.onAbort, { once: true });
      this.timer = setTimeout(() => this._stop('DISCOVERY_TIMEOUT'), this.timeoutMs);
      this.timer.unref?.();
      await this._emit('DISCOVERY_OPENING', { url: safeURL(entry) });
      // Retain BrowserSession's original network guard, then add stricter discovery routing.
      this.context = await this.session.context(this.task, { guard: this.guard });
      if (this.stopped) {
        await this.context.close().catch(() => {});
        this._check({ page: false });
      }
      await this.context.addInitScript(installRuntime, this.runtimeKey);
      await this.context.route('**/*', async (route) => {
        const request = route.request();
        let url;
        try {
          url = new URL(request.url());
        } catch {
          return route.abort();
        }
        let code = this.stopped ?? this.guard.blocked;
        const sameOrigin = url.origin === new URL(this.task.target).origin;
        if (!code && !sameOrigin && request.isNavigationRequest()) code = 'OUTSIDE_TARGET_ORIGIN';
        if (!code && !sameOrigin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()))
          code = 'WRITE_NOT_AUTHORIZED';
        if (!code && request.isNavigationRequest() && this.page) {
          try {
            if (request.frame().page() !== this.page) code = 'DISCOVERY_POPUP_BLOCKED';
          } catch {
            code = 'DISCOVERY_POPUP_BLOCKED';
          }
        }
        if (!code && request.isNavigationRequest())
          try {
            checkedURL(url.href, this.task.target);
          } catch (error) {
            code = safeError(error);
          }
        if (!code && sameOrigin && ['GET', 'HEAD'].includes(request.method())) {
          let routeText;
          try {
            routeText = decodeURIComponent(url.pathname + url.search);
          } catch {
            routeText = url.pathname;
          }
          if (DANGEROUS_ROUTE.test(routeText) || DOWNLOAD_PATH.test(routeText))
            code = 'DISCOVERY_DANGEROUS_ROUTE';
        }
        if (!code && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
          const allowed =
            request.method() === 'POST' &&
            (this.task.authorization?.readOnlyEndpoints ?? []).some(
              (endpoint) => endpoint.method === 'POST' && endpoint.path === url.pathname,
            );
          if (!allowed) code = 'WRITE_NOT_AUTHORIZED';
        }
        if (code) {
          // Abort unknown initial background POSTs, but retain independent menu
          // evidence. This NEVER grants an endpoint read-only authority.
          if (
            code === 'WRITE_NOT_AUTHORIZED' &&
            !this.guard.blocked &&
            !this.stopped &&
            this.step === 0 &&
            sameOrigin &&
            request.method() === 'POST' &&
            !request.isNavigationRequest()
          ) {
            const issue = {
              code,
              method: 'POST',
              path: redact(url.pathname),
              source_url: safeURL(this.page?.url() ?? entry),
            };
            if (
              !this.initialNetworkIssues.some(
                (v) => v.path === issue.path && v.source_url === issue.source_url,
              )
            ) {
              this.initialNetworkIssues.push(issue);
              await this._emit('DISCOVERY_REQUEST_BLOCKED', issue);
            }
            await route.abort().catch(() => {});
            return;
          }
          this._block(code, request);
          await route.abort().catch(() => {});
          return;
        }
        await route.fallback();
      });
      this.context.on('page', (page) => {
        if (this.page && page !== this.page) {
          this._block('DISCOVERY_POPUP_BLOCKED');
          page.close().catch(() => {});
        }
      });
      this.page = await this.context.newPage();
      // Playwright request routes see only the first HTTP redirect request.
      // Inspect native document response headers BEFORE Chromium follows each
      // Location. Do not proxy/fulfill documents: that changes address-space
      // classification and breaks legitimate same-network CDN resources.
      this.redirectGuard = await this.context.newCDPSession(this.page);
      this.redirectGuard.on('Fetch.requestPaused', async (event) => {
        try {
          this._check();
          const location = event.responseHeaders?.find(
            (h) => h.name.toLowerCase() === 'location',
          )?.value;
          if ([301, 302, 303, 307, 308].includes(event.responseStatusCode) && location) {
            if (event.request.method !== 'GET') fail('DISCOVERY_REDIRECT_METHOD_UNSUPPORTED');
            const target = checkedURL(new URL(location, event.request.url).href, this.task.target);
            this._reserve('redirect:' + target);
            await this._emit('DISCOVERY_REDIRECT_ALLOWED', { destination: safeURL(target) });
          }
          this._check();
          await this.redirectGuard.send('Fetch.continueResponse', { requestId: event.requestId });
        } catch (error) {
          this._block(safeError(error), {
            url: () => event.request.url,
            method: () => event.request.method,
          });
          await this.redirectGuard
            .send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Aborted' })
            .catch(() => {});
        }
      });
      await this.redirectGuard.send('Fetch.enable', {
        patterns: [{ urlPattern: '*', resourceType: 'Document', requestStage: 'Response' }],
      });
      this.page.setDefaultTimeout(Math.min(this.timeoutMs, 8000));
      this.pendingNetwork = new Set();
      this.networkChangedAt = Date.now();
      this.page.on('request', (request) => {
        this.pendingNetwork.add(request);
        this.networkChangedAt = Date.now();
      });
      const requestFinished = (request) => {
        this.pendingNetwork.delete(request);
        this.networkChangedAt = Date.now();
      };
      this.page.on('requestfinished', requestFinished);
      this.page.on('requestfailed', requestFinished);
      this.page.on('dialog', (dialog) => {
        this._block('NATIVE_DIALOG_UNSUPPORTED');
        dialog.dismiss().catch(() => {});
      });
      this.page.on('download', (download) => {
        this._block('DISCOVERY_DOWNLOAD_BLOCKED');
        download.cancel().catch(() => {});
      });
      await this.page.goto(entry, {
        waitUntil: 'domcontentloaded',
        timeout: Math.min(this.timeoutMs, 20000),
      });
      this._check();
      await this.page.bringToFront();
      await this._emit('DISCOVERY_OPENED');
      return this._observe();
    });
  }

  async observe() {
    return this._run(() => this._observe());
  }
  async _dismissAction(handle, meta) {
    if (meta.tag !== 'BUTTON' || !meta.form) return null;
    const facts = await handle.evaluate(dismissButtonFacts);
    if (!facts.safe) return null;
    const action = {
      op: 'dismiss_optional',
      target: { kind: 'role', role: 'dialog', name: facts.title, exact: true },
      value: facts.name,
    };
    if (!this.caseDefinition?.steps?.some((s) => conditionalDismissSource(s, action))) return null;
    return action;
  }
  async _inputCandidates(handle, meta, control) {
    const candidates = [];
    for (const contract of this.interactions.filter(
      (c) => c.case_id === this.caseId && contractPageMatches(c, this.page.url()),
    )) {
      const kind = interactionKind(meta, control.name, contract);
      if (!kind) continue;
      const locator = handoffLocator(this.page, contract.locator);
      if (
        (await locator.count()) !== 1 ||
        !(await locator.evaluate((element, expected) => element === expected, handle))
      )
        continue;
      for (const value of contract.values) {
        if (value === meta.value) continue;
        // An explicitly reviewed empty value clears local form state. It does not
        // need an empty substring fabricated from the source case text.
        if (
          contract.operation === 'fill' &&
          value !== '' &&
          !this.caseInputs.some((text) => text === value || text.includes(value))
        )
          continue;
        const option =
          contract.operation === 'select'
            ? (meta.options ?? []).filter((o) => !o.disabled && !o.hidden && o.value === value)
            : null;
        if (option && option.length !== 1) continue;
        const candidate = {
          candidate_id: uid(),
          kind,
          name: redact(control.name).slice(0, 200),
          locator: structuredClone(contract.locator),
          operation: contract.operation,
          value,
          entry_path: contract.entry_path,
          ...(option ? { option_label: redact(option[0].label) } : {}),
          evidence: structuredClone(contract.evidence),
        };
        this.candidates.set(candidate.candidate_id, { ...candidate, handle, meta, contract });
        candidates.push(candidate);
      }
    }
    return candidates;
  }
  async _observe() {
    this._check();
    await this._release();
    // Await pending SPA list requests before freezing the candidate observation.
    // A site with continuous traffic remains bounded and proceeds to revision checks.
    const settleDeadline = Date.now() + 3000;
    // load-state networkidle can already be satisfied immediately after a hash
    // click, before its fetch starts. Require a fresh quiet observation window.
    this.networkChangedAt = Date.now();
    while (
      Date.now() < settleDeadline &&
      (this.pendingNetwork.size || Date.now() - this.networkChangedAt < 450)
    ) {
      this._check();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await this._state();
      if (!before) fail('DISCOVERY_RUNTIME_REQUIRED');
      if (before.blocked) fail(before.blocked);
      checkedURL(before.url, this.task.target);
      const observed = await snapshot(this.page, {
        marker: this.session.marker,
        adapterSource: this.session.adapterSource,
        signal: this.signal,
      });
      if (observed.login_page) fail('AUTH_REQUIRED');
      observed.url = safeURL(this.page.url());
      observed.network_issues = this.initialNetworkIssues.filter(
        (v) => v.source_url === observed.url,
      );
      const candidates = [];
      for (const control of observed.controls) {
        this._check();
        let handle;
        try {
          const locator = handoffLocator(this.page, control.locator);
          if ((await locator.count()) !== 1) continue;
          handle = await locator.elementHandle();
          if (!handle) continue;
          const meta = await metadata(handle, this.runtimeKey),
            dismissAction = await this._dismissAction(handle, meta),
            kind = candidateKind(meta, control.name, this.page.url(), !!dismissAction);
          if (!kind) {
            const inputs = await this._inputCandidates(handle, meta, control);
            if (inputs.length) {
              candidates.push(...inputs);
              handle = null;
            }
            continue;
          }
          const candidate = {
            candidate_id: uid(),
            kind,
            ...(kind === 'dismiss' ? { dismissAction } : {}),
            name: redact(control.name).slice(0, 200),
            locator: structuredClone(control.locator),
            ...(control.row_context ? { row_context: control.row_context } : {}),
            ...(meta.href !== null
              ? { href: safeURL(checkedURL(meta.href, this.page.url())) }
              : {}),
          };
          this.candidates.set(candidate.candidate_id, { ...candidate, handle, meta });
          candidates.push(candidate);
          handle = null;
        } catch {
        } finally {
          await handle?.dispose();
        }
      }
      const after = await this._state();
      if (
        before.document_id !== after?.document_id ||
        before.revision !== after.revision ||
        before.url !== after.url
      ) {
        await this._release();
        continue;
      }
      const page_id = uid();
      this.current = {
        ...after,
        page_id,
        state_fingerprint: hash({
          url: after.url,
          text: observed.text,
          controls: observed.controls,
        }),
      };
      const result = { snapshot: observed, candidates, page_id };
      await this._emit('DISCOVERY_OBSERVED', { page_id, candidate_count: candidates.length });
      return result;
    }
    fail('DISCOVERY_SNAPSHOT_UNSTABLE');
  }

  async _unchanged(candidate) {
    const state = await this._state();
    if (
      !this.current ||
      !state ||
      state.document_id !== this.current.document_id ||
      state.url !== this.current.url
    )
      fail('DISCOVERY_STALE_PAGE');
    if (state.blocked) fail(state.blocked);
    const locator = handoffLocator(this.page, candidate.locator);
    if (
      (await locator.count()) !== 1 ||
      !(await locator.evaluate((element, expected) => element === expected, candidate.handle))
    )
      fail('DISCOVERY_STALE_PAGE');
    const meta = await metadata(candidate.handle, this.runtimeKey);
    const dismissAction = await this._dismissAction(candidate.handle, meta);
    const kind = candidate.contract
      ? interactionKind(meta, candidate.name, candidate.contract)
      : candidateKind(meta, candidate.name, state.url, !!dismissAction);
    if (
      JSON.stringify(meta) !== JSON.stringify(candidate.meta) ||
      !kind ||
      (candidate.kind === 'dismiss' &&
        JSON.stringify(dismissAction) !== JSON.stringify(candidate.dismissAction)) ||
      (candidate.contract &&
        (candidate.contract.case_id !== this.caseId ||
          !contractPageMatches(candidate.contract, state.url)))
    )
      fail('DISCOVERY_STALE_PAGE');
  }
  _reserve(key) {
    this._check();
    if (this.step >= this.maxSteps) fail('DISCOVERY_STEP_LIMIT');
    const seen = this.visits.get(key) ?? 0;
    if (seen >= 2) fail('DISCOVERY_LOOP_LIMIT');
    this.visits.set(key, seen + 1);
    this.step++;
  }

  beginCase(c) {
    this._check();
    this.visits.clear();
    this.caseId = typeof c === 'string' ? c : (c?.case_id ?? null);
    this.caseInputs = typeof c === 'object' ? caseInputText(c) : [];
    this.caseDefinition = typeof c === 'object' ? structuredClone(c) : null;
  }

  async act(action) {
    return this._run(async () => {
      this._check();
      if (
        !action ||
        Object.keys(action).some((key) => key !== 'candidate_id') ||
        typeof action.candidate_id !== 'string'
      )
        fail('DISCOVERY_CANDIDATE_FORBIDDEN');
      const candidate = this.candidates.get(action.candidate_id);
      if (!candidate) fail('DISCOVERY_CANDIDATE_FORBIDDEN');
      await this._unchanged(candidate);
      this._reserve(
        hash({
          url: this.current.url,
          state: this.current.state_fingerprint,
          kind: candidate.kind,
          name: candidate.name,
          locator: candidate.locator,
          metadata: candidate.meta,
          operation: candidate.operation ?? 'click',
          value: candidate.value ?? null,
        }),
      );
      const detail = {
        candidate_id: candidate.candidate_id,
        page_id: this.current.page_id,
        kind: candidate.kind,
        name: candidate.name,
        ...(candidate.operation
          ? {
              operation: candidate.operation,
              value: candidate.value,
              entry_path: candidate.entry_path,
              evidence: candidate.evidence,
            }
          : {}),
      };
      await this._emit('DISCOVERY_ACTION_BEFORE', detail);
      // An evidence callback may take time or change the page. Recheck before dispatch.
      this._check();
      await this._unchanged(candidate);
      const armed = await candidate.handle.evaluate(
        (element, { key, expected, meta, optionalDismiss }) => {
          const state = window[key];
          if (
            !state ||
            state.document_id !== expected.document_id ||
            location.href !== expected.url ||
            !element.isConnected ||
            JSON.stringify(state.metadata(element)) !== JSON.stringify(meta)
          )
            return false;
          state.permit = {
            element,
            url: location.href,
            metadata: JSON.stringify(meta),
            optionalDismiss,
          };
          return true;
        },
        {
          key: this.runtimeKey,
          expected: this.current,
          meta: candidate.meta,
          optionalDismiss: candidate.kind === 'dismiss',
        },
      );
      if (!armed) fail('DISCOVERY_STALE_PAGE');
      try {
        const options = { timeout: Math.min(this.timeoutMs, 8000) };
        if (candidate.kind === 'dismiss') {
          const binding = await resolveOptionalDialog(this.page, candidate.dismissAction, {
            timeout: 0,
            signal: this.signal,
          });
          try {
            if (
              binding.absent ||
              !(await binding.target.evaluate((e, old) => e === old, candidate.handle))
            )
              fail('DISCOVERY_STALE_PAGE');
            await dispatchOptionalDialog(this.page, binding, options.timeout);
          } finally {
            await binding.target?.dispose();
            await binding.dialog?.dispose();
          }
        } else if (candidate.operation === 'fill')
          await candidate.handle.fill(candidate.value, options);
        else if (candidate.operation === 'select')
          await candidate.handle.selectOption({ value: candidate.value }, options);
        else await candidate.handle.click(options);
      } finally {
        await this.page
          .evaluate((key) => {
            if (window[key]) {
              window[key].permit = null;
              window[key].dialogSubmit = null;
            }
          }, this.runtimeKey)
          .catch(() => {});
      }
      this._check();
      const state = await this._state();
      if (state?.blocked) fail(state.blocked);
      checkedURL(this.page.url(), this.task.target);
      await this._emit('DISCOVERY_ACTION_AFTER', detail);
      return this._observe();
    });
  }

  async navigate(route) {
    return this._run(async () => {
      this._check();
      const target = checkedURL(route, this.task.target);
      this._reserve('route:' + target);
      const detail = { name: 'source_entry_route', destination: safeURL(target) };
      await this._emit('DISCOVERY_NAVIGATE_BEFORE', detail);
      this._check();
      await this._release();
      await this.page.goto(target, {
        waitUntil: 'domcontentloaded',
        timeout: Math.min(this.timeoutMs, 20000),
      });
      this._check();
      await this._emit('DISCOVERY_NAVIGATE_AFTER', detail);
      return this._observe();
    });
  }

  async probe(locator) {
    return this._run(async () => {
      this._check();
      validateLocator(locator);
      const target = handoffLocator(this.page, locator),
        count = await target.count();
      return { locator, count, visible: count === 1 && (await target.isVisible()) };
    });
  }

  async repairAdapter(source) {
    return this._run(async () => {
      this._check();
      await runAdapter([], { source, regression: true, signal: this.signal });
      const before = await snapshot(this.page, {
        marker: this.session.marker,
        adapterSource: this.session.adapterSource,
        signal: this.signal,
      });
      const after = await snapshot(this.page, {
        marker: this.session.marker,
        adapterSource: source,
        signal: this.signal,
      });
      if (before.login_page || after.login_page) fail('AUTH_REQUIRED');
      if (
        after.url !== before.url ||
        after.adapter_gaps.length >= before.adapter_gaps.length ||
        after.controls.length <= before.controls.length ||
        before.controls.some(
          (c) =>
            !after.controls.some(
              (next) => JSON.stringify(next.locator) === JSON.stringify(c.locator),
            ),
        )
      )
        fail('ADAPTER_REPAIR_NO_PROGRESS');
      this._check();
      this.session.adapterSource = source;
      return {
        previous_hash: before.adapter_hash,
        hash: after.adapter_hash,
        recovered_controls: after.controls.length - before.controls.length,
      };
    });
  }

  async close() {
    clearTimeout(this.timer);
    this.signal?.removeEventListener('abort', this.onAbort);
    if (!this.stopped) this._stop('DISCOVERY_CLOSED');
    await this._release();
    if (this.contextClosePromise) await this.contextClosePromise;
    else await this.context?.close().catch(() => {});
    this.context = null;
    this.page = null;
  }
}
