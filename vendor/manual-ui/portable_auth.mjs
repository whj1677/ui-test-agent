import { spawn as nodeSpawn } from "node:child_process";

export const AUTH_STATUS = Object.freeze({
  CHANNEL_UNAVAILABLE: "AUTH_CHANNEL_UNAVAILABLE",
  REQUIRED: "AUTH_REQUIRED",
  TIMEOUT: "AUTH_TIMEOUT",
  SUCCEEDED: "AUTH_SUCCEEDED",
});

const SAFE_ERROR_CODES = new Set([
  "AUTH_SESSION_CLOSED",
  "AUTH_NOT_SUCCEEDED",
  "AUTH_CREDENTIAL_UNAVAILABLE",
]);
const MAX_CREDENTIAL_BYTES = 16 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 250;
const DEFAULT_VERIFICATION_TIMEOUT_MS = 10_000;

function safeError(code) {
  const error = new Error(SAFE_ERROR_CODES.has(code) ? code : "AUTH_SESSION_CLOSED");
  error.code = error.message;
  return error;
}

function notify(onStatus, status, userAction) {
  onStatus?.({ status, user_action_required_now: userAction });
}

function timeoutMs(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_TIMEOUT_MS;
}

function targetOrigin(baseUrl) {
  try { const url = new URL(baseUrl); return ["http:", "https:"].includes(url.protocol) ? url.origin : undefined; }
  catch { return undefined; }
}

function validAdapter(adapter, mode) {
  if (!adapter || typeof adapter.isAuthenticated !== "function") return false;
  if (mode === "manual_headed" && typeof adapter.isLoginPage !== "function") return false;
  return mode !== "windows_dpapi" || typeof adapter.loginWithCredential === "function";
}

function pageAtOrigin(page, origin) {
  try { return new URL(page.url()).origin === origin; } catch { return false; }
}

async function probePageState(page, adapter, origin, remainingMs, detectLogin) {
  if (remainingMs <= 0) return "unavailable";
  return await new Promise((resolve) => {
    let settled = false;
    let pending = detectLogin ? 2 : 1;
    const finish = (state) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(state);
    };
    const timer = setTimeout(() => finish("unavailable"), remainingMs);
    const inspect = (oracle, state) => {
      Promise.resolve().then(() => typeof oracle === "function" ? oracle(page) : false).then(
        (value) => {
          if (value === true && pageAtOrigin(page, origin)) finish(state);
          else if (--pending === 0) finish("unavailable");
        },
        () => { if (--pending === 0) finish("unavailable"); },
      );
    };
    // A slow positive oracle must not hide a real login form from the second oracle.
    inspect(adapter.isAuthenticated, "authenticated");
    if (detectLogin) inspect(adapter.isLoginPage, "login");
  });
}

async function waitForPageState(page, adapter, origin, waitMs, detectLogin = true) {
  const deadline = Date.now() + waitMs;
  while (Date.now() <= deadline) {
    if (page.isClosed?.() || !pageAtOrigin(page, origin)) return "unavailable";
    const state = await probePageState(page, adapter, origin, deadline - Date.now(), detectLogin);
    if (state !== "unavailable") return state;
    await new Promise((resolve) => setTimeout(resolve, Math.min(DEFAULT_POLL_MS, Math.max(1, deadline - Date.now()))));
  }
  return "unavailable";
}
function safeClose(closable) {
  return Promise.resolve(closable?.close?.()).catch(() => undefined);
}

function normalizeAdapter(result, fallback) {
  if (!result) return fallback;
  return result.loginAdapter || result;
}

function filteredStorageState(state, origin, cookies) {
  return {
    cookies,
    origins: Array.isArray(state?.origins) ? state.origins.filter((entry) => entry?.origin === origin) : [],
  };
}

async function takeSameOriginSnapshot(loginContext, page, origin) {
  if (!pageAtOrigin(page, origin)) throw safeError("AUTH_NOT_SUCCEEDED");
  const [allCookies, stored] = await Promise.all([
    // Query every path: cookies(origin) only returns cookies applicable to '/'.
    loginContext.cookies(),
    loginContext.storageState({ indexedDB: true }),
  ]);
  const target = new URL(origin);
  const cookies = allCookies.filter((cookie) => {
    if (cookie.url) { try { return new URL(cookie.url).origin === origin; } catch { return false; } }
    const domain = String(cookie.domain ?? "").toLowerCase();
    const hostname = target.hostname.toLowerCase();
    return (!cookie.secure || target.protocol === "https:") &&
      (domain === hostname || (domain.startsWith(".") && (hostname === domain.slice(1) || hostname.endsWith(domain))));
  });
  let sessionStorage = [];
  try {
    if (new URL(page.url()).origin === origin) {
      sessionStorage = await page.evaluate(() => Object.entries(sessionStorage));
    }
  } catch { /* A storage read failure must not broaden to another origin. */ }
  if (!pageAtOrigin(page, origin)) throw safeError("AUTH_NOT_SUCCEEDED");
  return { storageState: filteredStorageState(stored, origin, cookies), sessionStorage };
}

function sessionStorageInitScript(origin, entries) {
  return ({ expectedOrigin, values }) => {
    if (window.location.origin !== expectedOrigin) return;
    for (const [key, value] of values) window.sessionStorage.setItem(key, value);
  };
}

const POWERSHELL_DPAPI_READER = [
  "$ErrorActionPreference = 'Stop'",
  "$path = $env:PORTABLE_AUTH_CREDENTIAL_PATH",
  "$isDriveAbsolute = $path.Length -ge 3 -and $path[1] -eq ':' -and ($path[2] -eq [char]92 -or $path[2] -eq '/')",
  "$isUncAbsolute = $path.Length -ge 3 -and $path[0] -eq [char]92 -and $path[1] -eq [char]92 -and $path[2] -ne [char]92",
  "$isAbsolutePath = $isDriveAbsolute -or $isUncAbsolute",
  "if ([string]::IsNullOrWhiteSpace($path) -or -not $isAbsolutePath -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { exit 17 }",
  "$credential = Import-Clixml -LiteralPath $path",
  "if ($credential -isnot [pscredential]) { exit 18 }",
  "$username = $credential.UserName",
  "$password = $credential.GetNetworkCredential().Password",
  "if ([string]::IsNullOrEmpty($username) -or [string]::IsNullOrEmpty($password)) { exit 19 }",
  "$encoding = [Text.Encoding]::UTF8",
  "[Console]::Out.Write(([Convert]::ToBase64String($encoding.GetBytes($username))) + ':' + ([Convert]::ToBase64String($encoding.GetBytes($password))))",
].join("; ");

/**
 * Resolve a Windows DPAPI-protected PSCredential without exposing either field
 * through command arguments or logs. `spawnImpl` is a test seam only.
 */
export async function readWindowsDpapiCredential({ credentialRef, timeoutMs: readTimeoutMs = 10_000, spawnImpl = nodeSpawn, platform = process.platform } = {}) {
  if (platform !== "win32" || typeof credentialRef !== "string" || credentialRef.length === 0) throw safeError("AUTH_CREDENTIAL_UNAVAILABLE");
  return await new Promise((resolve, reject) => {
    let settled = false; let size = 0; let stdout = "";
    let timer;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      stdout = "";
      if (error) reject(safeError("AUTH_CREDENTIAL_UNAVAILABLE"));
      else resolve(value);
    };
    let child;
    try {
      child = spawnImpl("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", POWERSHELL_DPAPI_READER], {
        windowsHide: true,
        env: { ...process.env, PORTABLE_AUTH_CREDENTIAL_PATH: credentialRef },
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch { finish(undefined, true); return; }
    timer = setTimeout(() => { child.kill?.(); finish(undefined, true); }, timeoutMs(readTimeoutMs));
    child.once?.("error", () => finish(undefined, true));
    child.stdout?.on?.("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_CREDENTIAL_BYTES) { child.kill?.(); finish(undefined, true); return; }
      stdout += chunk.toString("utf8");
    });
    child.once?.("close", (code) => {
      if (code !== 0 || !stdout) { finish(undefined, true); return; }
      const pieces = stdout.split(":");
      if (pieces.length !== 2) { finish(undefined, true); return; }
      try {
        const username = Buffer.from(pieces[0], "base64").toString("utf8");
        const password = Buffer.from(pieces[1], "base64").toString("utf8");
        if (!username || !password || Buffer.byteLength(username) + Buffer.byteLength(password) > MAX_CREDENTIAL_BYTES) throw new Error("invalid");
        finish({ username, password });
      } catch { finish(undefined, true); }
    });
  });
}

/**
 * Create an in-memory authenticated Playwright session.
 * `beforeAuthenticate` may return a loginAdapter or `{ loginAdapter }`; it is
 * called in the same unrecorded login page before any authentication oracle.
 */
export async function createAuthenticatedSession({
  playwright, baseUrl, auth = {}, loginAdapter, onStatus, launchOptions = {}, browser: injectedBrowser,
  loginContext: injectedLoginContext, beforeAuthenticate,
} = {}) {
  const mode = auth.mode || "manual_headed";
  const origin = targetOrigin(baseUrl);
  let browser = injectedBrowser;
  let loginContext = injectedLoginContext;
  let loginPage;
  let ownsBrowser = false; let ownsLoginContext = false; let closed = false; let snapshot;
  let currentStatus = AUTH_STATUS.CHANNEL_UNAVAILABLE;
  // Serialize authentication operations. No refresh may race a snapshot validation.
  let authOperation = Promise.resolve();
  const serial = (action) => {
    const next = authOperation.then(action, action);
    authOperation = next.catch(() => undefined);
    return next;
  };
  const setFailure = (status = AUTH_STATUS.CHANNEL_UNAVAILABLE) => {
    snapshot = undefined;
    currentStatus = status;
    return status;
  };
  const close = async () => {
    if (closed) return;
    closed = true;
    snapshot = undefined;
    // Preserve the last authentication outcome for CLI/reporting after disposal.
    if (ownsLoginContext) await safeClose(loginContext);
    if (ownsBrowser) await safeClose(browser);
  };
  // User interaction, SPA readiness and navigation have independent budgets.
  // A short login wait must not make a normal navigation impossible.
  const verificationTimeout = () => Number.isFinite(auth.verificationTimeoutMs) && auth.verificationTimeoutMs > 0
    ? Math.floor(auth.verificationTimeoutMs) : DEFAULT_VERIFICATION_TIMEOUT_MS;
  const navigationTimeout = () => Number.isFinite(auth.navigationTimeoutMs) && auth.navigationTimeoutMs > 0
    ? Math.floor(auth.navigationTimeoutMs) : 30_000;
  const createContext = async (options = {}, unrecorded = false) => {
    if (closed || !snapshot || currentStatus !== AUTH_STATUS.SUCCEEDED) throw safeError(closed ? "AUTH_SESSION_CLOSED" : "AUTH_NOT_SUCCEEDED");
    const { storageState: ignoredStorageState, recordVideo: ignoredVideo, ...safeOptions } = options;
    const recordVideo = unrecorded ? undefined : options.recordVideo;
    const context = await browser.newContext({ ...safeOptions, ...(recordVideo ? { recordVideo } : {}), storageState: snapshot.storageState });
    if (snapshot.sessionStorage.length) await context.addInitScript(sessionStorageInitScript(origin, snapshot.sessionStorage), { expectedOrigin: origin, values: snapshot.sessionStorage });
    return context;
  };
  const refresh = async ({ loginAdapter: nextAdapter, timeoutMs: requestedTimeout } = {}, navigate = true) => {
    setFailure();
    if (closed || !browser || !loginContext || !origin) return currentStatus;
    if (nextAdapter) loginAdapter = nextAdapter;
    if (mode !== "none" && !validAdapter(loginAdapter, mode)) return currentStatus;
    if (mode === "windows_dpapi" && auth.allowSavedCredential !== true) return currentStatus;
    try {
      if (!loginPage || loginPage.isClosed?.()) loginPage = loginContext.pages?.().find((page) => !page.isClosed?.()) || await loginContext.newPage();
      if (navigate) await loginPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeout() });
      if (!pageAtOrigin(loginPage, origin)) return currentStatus;
      if (mode !== "none") {
        const state = await waitForPageState(loginPage, loginAdapter, origin, verificationTimeout());
        if (state !== "authenticated") {
          // An unknown page or an incomplete SPA is not evidence of a login screen.
          if (state !== "login" && mode !== "windows_dpapi") return currentStatus;
          if (mode === "windows_dpapi") {
            if (auth.allowSavedCredential !== true) return currentStatus;
            let credential;
            try {
              credential = await readWindowsDpapiCredential({ credentialRef: auth.credentialRef, timeoutMs: requestedTimeout ?? auth.timeoutMs });
              await loginAdapter.loginWithCredential(loginPage, credential);
            } finally { credential = undefined; }
          } else {
            notify(onStatus, AUTH_STATUS.REQUIRED, "是：当前登录已失效或尚未登录，请在原可见浏览器中完成登录；认证阶段不会录制媒体。");
          }
          if (await waitForPageState(loginPage, loginAdapter, origin, timeoutMs(requestedTimeout ?? auth.timeoutMs), false) !== "authenticated") {
            notify(onStatus, AUTH_STATUS.TIMEOUT, "是：未收到正向认证确认，未创建业务取证 context；原登录窗口保持打开。");
            return setFailure(AUTH_STATUS.TIMEOUT);
          }
        }
      }
      snapshot = await takeSameOriginSnapshot(loginContext, loginPage, origin);
      if (closed) return setFailure();
      currentStatus = AUTH_STATUS.SUCCEEDED;
      notify(onStatus, AUTH_STATUS.SUCCEEDED, mode === "none"
        ? "否：目标声明无需认证；后续 context 仅使用当前进程内存状态。"
        : "否：已收到正向认证确认；原登录窗口与同源内存状态将复用于后续用例。");
      return currentStatus;
    } catch { return setFailure(); }
  };
  const ensure = async ({ loginAdapter: nextAdapter, timeoutMs: requestedTimeout } = {}) => {
    if (nextAdapter) loginAdapter = nextAdapter;
    if (closed || !browser || !loginContext || !origin) { setFailure(); return false; }
    if (mode === "none") return snapshot && currentStatus === AUTH_STATUS.SUCCEEDED ? true : await refresh({ timeoutMs: requestedTimeout }) === AUTH_STATUS.SUCCEEDED;
    if (!validAdapter(loginAdapter, mode)) { setFailure(); return false; }
    let probe;
    let verified = false;
    try {
      if (snapshot && currentStatus === AUTH_STATUS.SUCCEEDED) {
        probe = await createContext({}, true);
        const page = await probe.newPage();
        await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeout() });
        verified = await waitForPageState(page, loginAdapter, origin, verificationTimeout()) === "authenticated";
        if (verified) {
          // Capture any target-origin token rotation in the validated probe, in memory only.
          snapshot = await takeSameOriginSnapshot(probe, page, origin);
        }
      }
    } catch { verified = false; }
    finally { await safeClose(probe); }
    if (verified && !closed) return true;
    // Never let a caller create a recorded context from a known invalid snapshot.
    setFailure();
    return await refresh({ timeoutMs: requestedTimeout }) === AUTH_STATUS.SUCCEEDED;
  };
  const session = {
    get status() { return currentStatus; },
    get browser() { return browser; },
    refreshAuthentication: (options = {}) => serial(() => refresh(options)),
    ensureAuthenticated: (options = {}) => serial(() => ensure(options)),
    createCaseContext: (options = {}) => createContext(options, false),
    createUnrecordedContext: (options = {}) => createContext(options, true),
    close,
  };
  if (!origin || !["manual_headed", "windows_dpapi", "none"].includes(mode)) return session;
  try {
    if (!browser && loginContext?.browser) browser = loginContext.browser();
    if (!browser) {
      if (!playwright?.chromium?.launch) return session;
      browser = await playwright.chromium.launch(mode === "manual_headed" ? { ...launchOptions, headless: false } : launchOptions);
      ownsBrowser = true;
    }
    if (!loginContext) {
      loginContext = await browser.newContext({});
      ownsLoginContext = true;
    }
    loginPage = loginContext.pages?.()[0] || await loginContext.newPage();
    if (loginPage.url?.() === "about:blank") await loginPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeout() });
    const explored = beforeAuthenticate ? await beforeAuthenticate({ browser, loginContext, page: loginPage, baseUrl }) : undefined;
    loginAdapter = normalizeAdapter(explored, loginAdapter);
    await refresh({}, false);
  } catch { setFailure(); }
  return session;
}