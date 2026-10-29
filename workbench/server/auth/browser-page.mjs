import { targetRequestAllowed } from '../project-target-access.mjs';

// Monitoring an attached browser must never create, navigate or close tabs.
// This only notices visible logout; active access checks still guard execution.
export async function inspectAuthenticatedPages(context, environment) {
  for (const page of context.pages()) {
    if (page.isClosed() || !/^https?:/.test(page.url())) continue;
    try {
      const current = new URL(page.url()), login = new URL(environment.login_url), entry = new URL(environment.entry_url);
      if (current.origin !== environment.origin) continue;
      if (/(?:^|[\/#_-])(?:login|signin|sign-in|sso|oauth|authorize)(?:[\/#?_-]|$)/i.test(`${current.pathname}${current.hash}`) ||
          login.pathname !== entry.pathname && current.pathname === login.pathname) return 'LOGIN_REQUIRED';
      const loginForm = await page.evaluate(() => [...document.querySelectorAll('form')].some(form =>
        form.getClientRects().length && getComputedStyle(form).visibility !== 'hidden' &&
        form.querySelector('input[type="password"]') && /登录|登入|sign\s*in|log\s*in/i.test(form.innerText)));
      if (loginForm) return 'LOGIN_REQUIRED';
    } catch { /* A page may be navigating or closing during this passive sample. */ }
  }
  return null;
}

// A page-access check follows the user's explicit login confirmation. It does
// not claim to identify the account or verify a server-side role.
export async function probeAuthenticatedPage(context, environment) {
  const page = await context.newPage();
  try {
    const response = await page.goto(environment.entry_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (response?.status() === 401) return 'LOGIN_REQUIRED';
    if (response?.status() === 403) return 'PERMISSION_DENIED';
    if (response && !response.ok()) return 'PAGE_CHECK_UNAVAILABLE';
    await page.waitForFunction(() => Boolean(document.body?.innerText.trim()), null, { timeout: 5000 });
    // Give client-side authentication redirects a chance to finish.
    await page.waitForTimeout(1000);
    const current = new URL(page.url()), entry = new URL(environment.entry_url), login = new URL(environment.login_url);
    const route = `${current.pathname}${current.hash}`;
    if (current.origin !== environment.origin || !targetRequestAllowed({ ...environment, path_prefix: environment.path_prefix || '/' }, current.href)) return 'LOGIN_REQUIRED';
    if (/(?:^|[\/#_-])(?:login|signin|sign-in|sso|oauth|authorize)(?:[\/#?_-]|$)/i.test(route) ||
        login.pathname !== entry.pathname && current.pathname === login.pathname) return 'LOGIN_REQUIRED';
    const loginForm = await page.evaluate(() => {
      const visible = element => Boolean(element.getClientRects().length) && getComputedStyle(element).visibility !== 'hidden';
      if ([...document.querySelectorAll('input[type="password"]')].some(visible)) return true;
      return [...document.querySelectorAll('form')].some(form => visible(form) &&
        Boolean(form.querySelector('input')) && /登录|登入|sign\s*in|log\s*in/i.test(form.innerText));
    });
    return loginForm ? 'LOGIN_REQUIRED' : null;
  } catch {
    return 'PAGE_CHECK_UNAVAILABLE';
  } finally {
    await page.close().catch(() => {});
  }
}
