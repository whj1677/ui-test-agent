// Standard Playwright-only, read-only discovery for confirmed manual cases.
// It records locator candidates; it never clicks, fills, submits, downloads,
// uploads, saves, deletes, or reads authentication state.
import fs from "node:fs/promises";
import path from "node:path";

const FORBIDDEN_ACTION = /\b(save|delete|remove|upload|download|submit|create|update|edit|import|export|click|fill|type)\b/i;
const SAFE_ROUTE = (route) => {
  if (typeof route !== "string" || !route.startsWith("/") || route.startsWith("//") || route.includes("\\")) throw new Error("DISCOVERY_ROUTE_INVALID");
  const url = new URL(route, "http://local.invalid");
  if (url.origin !== "http://local.invalid" || !url.pathname.startsWith("/")) throw new Error(`DISCOVERY_ROUTE_INVALID:${route}`);
  return `${url.pathname}${url.search}${url.hash}`;
};

function safeId(value) { return String(value ?? "").replace(/[^A-Za-z0-9_.:-]/g, "_"); }
function forbidden(value) { return FORBIDDEN_ACTION.test(String(value ?? "")); }

export function validateDiscoveryCases(cases) {
  if (!Array.isArray(cases) || cases.length === 0) throw new Error("DISCOVERY_CASES_REQUIRED");
  const seen = new Set();
  return cases.map((testCase) => {
    if (!testCase?.case_id || seen.has(testCase.case_id)) throw new Error(`DISCOVERY_CASE_ID_INVALID:${testCase?.case_id ?? "missing"}`);
    seen.add(testCase.case_id);
    const route = SAFE_ROUTE(testCase.route);
    if (forbidden(testCase.action)) throw new Error(`DISCOVERY_WRITE_ACTION_REJECTED:${testCase.case_id}`);
    if (!Array.isArray(testCase.semantic_targets) || testCase.semantic_targets.length === 0) return { ...testCase, route, classification: "BLOCKED_SEMANTIC_TARGET" };
    const semantic_targets = testCase.semantic_targets.map((target, index) => {
      if (!target?.target_id || forbidden(target.action)) throw new Error(`DISCOVERY_TARGET_INVALID:${testCase.case_id}:${index + 1}`);
      const strategies = ["test_id", "role", "label", "text"].filter((key) => target[key] !== undefined && target[key] !== "");
      if (!strategies.length) throw new Error(`DISCOVERY_TARGET_SEMANTICS_MISSING:${testCase.case_id}:${target.target_id}`);
      return {
        target_id: target.target_id,
        ...Object.fromEntries(strategies.map((key) => [key, target[key]])),
        ...(target.role !== undefined && target.name !== undefined ? { name: target.name } : {}),
      };
    });
    if (new Set(semantic_targets.map((target) => target.target_id)).size !== semantic_targets.length) throw new Error(`DISCOVERY_TARGET_ID_DUPLICATE:${testCase.case_id}`);
    return { case_id: testCase.case_id, route, semantic_targets, classification: "DISCOVERY_PENDING" };
  });
}

function locatorFor(page, target, strategy) {
  if (strategy === "test_id") return page.getByTestId(target.test_id);
  if (strategy === "role") return page.getByRole(target.role, target.name === undefined ? {} : { name: target.name, exact: true });
  if (strategy === "label") return page.getByLabel(target.label, { exact: true });
  return page.getByText(target.text, { exact: true });
}

// Rebuild only from the frozen, standard Playwright locator parameters.  The
// caller supplies the page; no browser context or authentication material is
// accepted or persisted here.
export function locatorFromCandidate(page, frozen) {
  const locator = frozen.playwright;
  if (locator.kind === "test_id") return page.getByTestId(locator.test_id);
  if (locator.kind === "role") return page.getByRole(locator.role, locator.options);
  if (locator.kind === "label") return page.getByLabel(locator.label, locator.options);
  if (locator.kind === "text") return page.getByText(locator.text, locator.options);
  throw new Error(`DISCOVERY_FROZEN_LOCATOR_INVALID:${locator.kind}`);
}

function frozenLocator(target, strategy) {
  if (strategy === "test_id") return { kind: "test_id", test_id: target.test_id };
  if (strategy === "role") return { kind: "role", role: target.role, options: target.name === undefined ? {} : { name: target.name, exact: true } };
  if (strategy === "label") return { kind: "label", label: target.label, options: { exact: true } };
  return { kind: "text", text: target.text, options: { exact: true } };
}

async function candidate(page, testCase, target, strategy) {
  const locator = locatorFor(page, target, strategy);
  const count = await locator.count();
  const visible = count === 1 ? await locator.isVisible().catch(() => false) : false;
  const disabled = count === 1 ? await locator.isDisabled().catch(() => null) : null;
  return {
    case_id: testCase.case_id, target_id: target.target_id, route: testCase.route,
    strategy, selector: strategy === "test_id" ? `[data-testid=${JSON.stringify(target.test_id)}]` : strategy,
    name_or_value: strategy === "test_id" ? target.test_id : target[strategy], playwright: frozenLocator(target, strategy),
    scope: "page", count, unique: count === 1, visible, disabled,
    requires_followup_confirmation: count !== 1 || !visible,
    disposition: count === 0 ? "NOT_FOUND" : count === 1 && visible ? "UNIQUE_VISIBLE" : count === 1 ? "UNIQUE_HIDDEN" : "NON_UNIQUE",
  };
}

async function writeJson(file, value) { await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }

export async function discoverReadonlyPageMap({ context, baseUrl, cases, outputDir, runId = "readonly-discovery" }) {
  if (!context || !baseUrl || !outputDir) throw new Error("DISCOVERY_ARGUMENTS_REQUIRED");
  const frozenCases = validateDiscoveryCases(cases);
  const origin = new URL(baseUrl).origin;
  await fs.mkdir(path.dirname(outputDir), { recursive: true });
  await fs.mkdir(outputDir, { recursive: false });
  let page;
  const installRouteGuard = async (page, authorizedNavigation) => page.route("**/*", async (route) => {
    const request = route.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      const requested = new URL(request.url()); requested.hash = "";
      if (requested.href !== authorizedNavigation || request.method() !== "GET") return route.abort("blockedbyclient");
      // Playwright routes do not fire again for an HTTP redirect chain.
      // Inspect the first response without following it before fulfilling the
      // authorized document, so a redirect cannot visit an unlisted route.
      try {
        const response = await route.fetch({ maxRedirects: 0, timeout: 5000 });
        if (response.status() >= 300 && response.status() < 400) return route.abort("blockedbyclient");
        return route.fulfill({ response });
      } catch { return route.abort("failed").catch(() => {}); }
    }
    return route.continue();
  });
  const pageMap = []; const locatorCandidates = []; const caseReceipts = [];
  try {
    for (const testCase of frozenCases) {
      if (testCase.classification === "BLOCKED_SEMANTIC_TARGET") {
        caseReceipts.push({ case_id: testCase.case_id, classification: testCase.classification, reason: "已确认人工用例未提供可发现的语义目标" });
        continue;
      }
      try {
      page = await context.newPage();
      const targetUrl = new URL(testCase.route, origin); const networkUrl = new URL(targetUrl); networkUrl.hash = "";
      await installRouteGuard(page, networkUrl.href);
      await page.goto(targetUrl.toString(), { waitUntil: "domcontentloaded", timeout: 15000 });
      const root = page.locator("main,[role=main],body").first();
      const rootVisible = await root.isVisible().catch(() => false);
      const observed = [];
      for (const target of testCase.semantic_targets) {
        const strategies = ["test_id", "role", "label", "text"].filter((key) => target[key] !== undefined);
        for (const strategy of strategies) observed.push(await candidate(page, testCase, target, strategy));
      }
      locatorCandidates.push(...observed);
      const unresolvedTargets = testCase.semantic_targets.filter((target) => !observed.some((item) => item.target_id === target.target_id && !item.requires_followup_confirmation));
      pageMap.push({ route: testCase.route, document_ready_state: await page.evaluate(() => document.readyState), root_visible: rootVisible, candidate_count: observed.length, unique_visible_candidate_count: observed.filter((item) => item.disposition === "UNIQUE_VISIBLE").length });
      caseReceipts.push({ case_id: testCase.case_id, classification: unresolvedTargets.length ? "BLOCKED_LOCATOR" : "DISCOVERY_COMPLETE", route: testCase.route, target_ids: testCase.semantic_targets.map((target) => target.target_id), unresolved_candidate_count: observed.filter((item) => item.requires_followup_confirmation).length, unresolved_target_count: unresolvedTargets.length });
      } catch {
        caseReceipts.push({ case_id: testCase.case_id, classification: "BLOCKED_LOCATOR", route: testCase.route, reason: "只读页面访问或定位发现失败；未扩大授权路由，其他 Case 继续处理", error_code: "DISCOVERY_CASE_FAILED" });
      } finally { await page?.close().catch(() => {}); page = null; }
    }
  } finally { await page?.close().catch(() => {}); }
  const receipt = { schema_version: "manual-case-ui-automation/readonly-discovery-v1", run_id: safeId(runId), execution_mode: "READONLY_DISCOVERY", context_supplied_by_caller: true, product_test_executed: false, authentication_state_collected: false, forbidden_actions: ["click", "fill", "submit", "save", "delete", "upload", "download"], case_count: frozenCases.length, case_receipts: caseReceipts };
  await writeJson(path.join(outputDir, "page-map.json"), { schema_version: receipt.schema_version, run_id: receipt.run_id, pages: pageMap });
  await writeJson(path.join(outputDir, "locator-candidates.json"), { schema_version: receipt.schema_version, run_id: receipt.run_id, candidates: locatorCandidates });
  await writeJson(path.join(outputDir, "discovery-receipt.json"), receipt);
  return { pageMap, locatorCandidates, receipt };
}
