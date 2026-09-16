// Read-only semantic inventory and fail-closed intent binder.
// Inputs are live DOM observations; case intents never contain selectors.
function roleFor(item) {
  if (item.role) return item.role;
  if (item.tag === "a") return "link";
  if (item.tag === "button") return "button";
  if (item.tag === "select") return "combobox";
  if (item.tag === "input" && /^(checkbox|radio)$/.test(item.inputType)) return item.inputType;
  if (item.tag === "input" && /^(button|submit|reset)$/.test(item.inputType)) return "button";
  if (["input", "textarea"].includes(item.tag) && !item.inputType?.match(/checkbox|radio|button|submit/)) return "textbox";
  return null;
}
function proposal(item) {
  if (item.frameScopeMissing) return null;
  const scope = item.framePath?.length ? { framePath: item.framePath } : item.frameTitle ? { frameTitle: item.frameTitle } : {};
  if (item.testId) return { kind: "test_id", ...scope, testId: item.testId };
  if (item.role && item.accessibleName) return { kind: "role", ...scope, role: item.role, name: item.accessibleName, exact: true };
  if (item.label) return { kind: "label", ...scope, label: item.label, exact: true };
  if (item.placeholder) return { kind: "placeholder", ...scope, placeholder: item.placeholder, exact: true };
  return null;
}
export function normalizeLiveInventory(observations) {
  if (!Array.isArray(observations)) throw new Error("LIVE_INVENTORY_REQUIRED");
  const raw = observations.map((item, index) => {
    const normalized = { ...item, domIndex: item.domIndex ?? index, role: roleFor(item) };
    return { ...normalized, locator: proposal(normalized) };
  });
  const totals = new Map();
  for (const item of raw) { const key = JSON.stringify({ scope: item.scope, frameTitle: item.frameTitle ?? null, locator: item.locator }); totals.set(key, (totals.get(key) ?? 0) + 1); }
  return raw.map((item) => {
    const count = totals.get(JSON.stringify({ scope: item.scope, frameTitle: item.frameTitle ?? null, locator: item.locator }));
    const blocked = !item.locator || count !== 1 || !item.visible;
    return { ...item, matchCount: count, status: blocked ? "BLOCKED_LOCATOR" : "CANDIDATE", reason: count === 0 ? "NOT_FOUND" : count > 1 ? "NON_UNIQUE" : !item.visible ? "HIDDEN" : "UNIQUE_VISIBLE" };
  });
}
export async function collectLiveSemanticInventory(page, { scope }) {
  if (!page || !scope) throw new Error("LIVE_PAGE_AND_SCOPE_REQUIRED");
  const inspect = async (frame, framePath) => frame.evaluate(() => Array.from(document.querySelectorAll("a,button,input,textarea,select,option,img,h1,h2,h3,h4,h5,h6,[role],[data-testid]")).map((node, domIndex) => {
    const tag = node.tagName.toLowerCase(); const inputType = node.getAttribute("type") ?? "";
    const label = node.labels?.[0]?.textContent?.trim() ?? "";
    const referencedName = (node.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim() ?? "").join(" ").trim();
    const accessibleName = referencedName || node.getAttribute("aria-label")?.trim() || label || node.getAttribute("alt") || node.textContent?.trim() || node.getAttribute("title") || "";
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const disabled = node.matches(":disabled") || node.getAttribute("aria-disabled") === "true";
    const role = node.getAttribute("role")?.split(/\s+/)[0] || (/^h[1-6]$/.test(tag) ? "heading" : tag === "img" ? "img" : tag === "option" ? "option" : tag === "input" && inputType === "search" ? "searchbox" : tag === "input" && inputType === "number" ? "spinbutton" : tag === "input" && inputType === "range" ? "slider" : null);
    return { domIndex, tag, role, inputType, accessibleName, label, placeholder: node.getAttribute("placeholder") ?? "", testId: node.getAttribute("data-testid") ?? "", visible: !(node.hidden || style.display === "none" || ["hidden", "collapse"].includes(style.visibility)) && rect.width > 0 && rect.height > 0, disabled, editable: (tag === "input" || tag === "textarea") && !disabled && !node.readOnly };
  })).then((items) => items.map((item) => ({ ...item, scope, framePath: framePath ?? [], frameScopeMissing: framePath === null, source: { kind: "live_dom", frame_path: framePath, domIndex: item.domIndex } })));
  const paths = new Map([[page.mainFrame(), []]]);
  const observations = [];
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame()) {
      const parent = frame.parentFrame(); const parentPath = paths.get(parent);
      const element = await frame.frameElement(); let selector = null;
      try {
        const tag = await element.evaluate((node) => node.tagName.toLowerCase());
        for (const attr of ["data-testid", "id", "name", "title"]) {
          const value = await element.getAttribute(attr);
          if (!value) continue;
          const candidate = `${tag}[${attr}=${cssString(value)}]`;
          if (await parent.locator(candidate).count() === 1) { selector = candidate; break; }
        }
        if (!selector && await parent.locator(tag).count() === 1) selector = tag;
      } finally { await element.dispose(); }
      paths.set(frame, parentPath && selector ? [...parentPath, selector] : null);
    }
    observations.push(...await inspect(frame, paths.get(frame)));
  }
  const inventory = normalizeLiveInventory(observations);
  // Verify the proposed standard locator against Playwright itself. DOM
  // approximations are discovery hints, never proof of uniqueness or visibility.
  for (const item of inventory) {
    if (!item.locator) { item.status = "BLOCKED_LOCATOR"; item.reason = item.frameScopeMissing ? "FRAME_SCOPE_UNRESOLVED" : "SEMANTICS_UNRESOLVED"; continue; }
    const locator = locatorFromContract(page, item);
    const count = await locator.count().catch(() => 0); item.matchCount = count;
    item.visible = count === 1 && await locator.isVisible().catch(() => false);
    if (count === 1) item.disabled = await locator.isDisabled().catch(() => item.disabled);
    item.status = count === 1 && item.visible ? "CANDIDATE" : "BLOCKED_LOCATOR";
    item.reason = count > 1 ? "NON_UNIQUE" : count === 0 ? "NOT_FOUND" : !item.visible ? "HIDDEN" : "UNIQUE_VISIBLE";
  }
  return inventory;
}
export function bindIntent(inventory, intent) {
  if (intent?.locator) throw new Error("INTENT_MUST_NOT_CONTAIN_LOCATOR");
  let matches = inventory.filter((item) => item.scope === intent.scope);
  let reason;
  if (intent.businessText) { matches = matches.filter((item) => item.role === intent.role && item.accessibleName === intent.businessText); reason = "EXACT_BUSINESS_TEXT"; }
  else if (intent.actionType === "editable_textbox") { matches = matches.filter((item) => item.role === "textbox" && item.editable && item.visible); reason = "UNIQUE_VISIBLE_EDITABLE_TEXTBOX"; }
  else throw new Error("INTENT_BINDING_RULE_REQUIRED");
  const usable = matches.filter((item) => item.status === "CANDIDATE");
  if (usable.length !== 1) return { intent, status: "BLOCKED_LOCATOR", reason: usable.length ? "AMBIGUOUS" : "NOT_FOUND_OR_UNUSABLE" };
  const item = usable[0];
  return { intent, status: "RUNNABLE", locator: item.locator, source: { scope: item.scope, domIndex: item.domIndex, frameTitle: item.frameTitle ?? null }, selectionReason: reason, observed: { matchCount: item.matchCount, visible: item.visible, disabled: !!item.disabled } };
}
export function locatorFromContract(page, contract) {
  const x = contract.locator;
  if (!x || ![undefined, true, false].includes(x.exact)) throw new Error("LOCATOR_CONTRACT_INVALID");
  let root = page;
  if (x.framePath) { if (!Array.isArray(x.framePath) || x.framePath.some((selector) => typeof selector !== "string" || !selector)) throw new Error("LOCATOR_FRAME_CONTRACT_INVALID"); for (const selector of x.framePath) root = root.frameLocator(selector); }
  else if (x.frameTitle) root = root.frameLocator(`iframe[title=${cssString(x.frameTitle)}]`);
  if (x.kind === "test_id") return root.getByTestId(x.testId);
  if (x.kind === "role") return root.getByRole(x.role, { name: x.name, exact: x.exact });
  if (x.kind === "label") return root.getByLabel(x.label, { exact: x.exact });
  if (x.kind === "placeholder") return root.getByPlaceholder(x.placeholder, { exact: x.exact });
  throw new Error("LOCATOR_CONTRACT_INVALID");
}

function cssString(value) { return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ").replace(/\r/g, "\\d ")}"`; }
