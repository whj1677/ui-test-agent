#!/usr/bin/env node
// Portable project bootstrap and runner.  Its generated support directory is
// deliberately self-contained: no Codex API, browser extension, or skill path
// is consulted after `init` completes.
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import readline from "node:readline";
import crypto from "node:crypto";
import { runGenericCases, reauditRunMedia } from "./generic_playwright_orchestrator.mjs";
import { discoverReadonlyPageMap } from "./readonly_playwright_discovery.mjs";
import { collectLiveSemanticInventory, locatorFromContract } from "./semantic_inventory_binder.mjs";
import { diagnoseRun, prepareRetry, digest, runDirectory } from "./agent_repair_contract.mjs";
import { commandFileLines } from "./session_command_file.mjs";
import { freezeSessionModules } from "./session_module_snapshot.mjs";
import { loadConfirmedExpectations, assertSameRetryExpectations } from "./confirmed_expectations.mjs";
import { generateOfflineReport } from "./offline_html_report.mjs";
import { bindProjectHandoff, loadProjectHandoff, applyHandoffAuthentication, supportForCase, assertSameRetryHandoff, createCaseHandoffRuntime } from './handoff_runtime.mjs';
export { applyHandoffAuthentication };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = "manual-case-ui-automation/portable-v1";
const SUPPORT_FILES = ["offline_html_report.mjs", "portable-ui-workflow.mjs", "portable_xlsx_rows.py", "generic_playwright_orchestrator.mjs", "step_evidence_contract.mjs", "readonly_playwright_discovery.mjs", "semantic_inventory_binder.mjs", "portable_auth.mjs", "agent_repair_contract.mjs", "session_command_file.mjs", "session_module_snapshot.mjs", "confirmed_expectations.mjs", "case_handoff.mjs", "handoff_runtime.mjs"];
const COLUMN_NAMES = {
  case_id: ["case_id", "case id", "caseid", "用例编号", "用例id", "用例编号/id", "测试用例编号"],
  title: ["title", "case title", "用例名称", "用例标题", "测试项"],
  step_number: ["step_number", "step no", "step", "步骤", "步骤号", "步骤编号"],
  action: ["action", "操作", "操作步骤", "步骤操作", "测试步骤"],
  observation: ["observation", "expected", "预期", "预期结果", "观察点", "成功标准"],
  expected: ["expected", "预期", "预期结果", "success criteria", "成功标准"],
  source: ["source", "来源", "需求来源", "requirement", "需求id", "需求编号"],
  preconditions: ["preconditions", "前置条件"],
  test_data: ["test_data", "测试数据"],
  cleanup: ["cleanup", "清理说明", "清理"],
  preparation: ["preparation", "执行准备及待补说明"],
  requires_click: ["requires_click", "需要点击", "点击操作", "click required"],
};

function fail(code, detail = "") { const error = new Error(code); error.code = code; error.detail = detail; throw error; }
function safeText(value) { return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim(); }
function id(value) { return safeText(value); }
function nowId() { return new Date().toISOString().replace(/[:.]/g, "-"); }
function hasArg(args, flag) { return args.includes(flag); }
function arg(args, flag, required = true) { const index = args.indexOf(flag); if (index < 0) { if (required) fail("ARGUMENT_REQUIRED", flag); return null; } const value = args[index + 1]; if (!value || value.startsWith("--")) fail("ARGUMENT_VALUE_REQUIRED", flag); return value; }
function resolveProject(args) { return path.resolve(arg(args, "--project")); }
async function json(file) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { fail("JSON_READ_FAILED", path.basename(file)); } }
async function writeJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
function requiredProjectFiles(project) { return ["project.json", "cases/case-import.json", "cases/column-mapping.json", "adapter/project-adapter.mjs"].map((x) => path.join(project, x)); }
function printableError(error) { const direct = error?.code ?? error?.message ?? ""; const type = /^[A-Za-z]+Error$/.test(error?.name ?? "") ? `_${String(error.name).replace(/Error$/, "").toUpperCase()}` : ""; return { ok: false, code: /^[A-Z][A-Z0-9_:-]+$/.test(direct) ? direct : `PORTABLE_WORKFLOW_ERROR${type}`, detail: safeText(error?.detail).slice(0, 240) }; }

function validateHeaders(headers) {
  const normalized = headers.map((header) => safeText(header).toLowerCase());
  if (normalized.some((header) => !header)) fail("INPUT_HEADER_MISSING");
  if (new Set(normalized).size !== normalized.length) fail("INPUT_DUPLICATE_HEADER");
}
function parseCsv(source) {
  source = source.replace(/^\uFEFF/, "");
  const rows = []; let row = []; let cell = ""; let quoted = false; let closedQuote = false;
  for (let index = 0; index < source.length; index += 1) {
    const c = source[index];
    if (quoted && c === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
    else if (c === '"') {
      if (quoted) { quoted = false; closedQuote = true; }
      else { if (cell || closedQuote) fail("CSV_QUOTE_INVALID"); quoted = true; }
    }
    else if (!quoted && c === ",") { row.push(cell); cell = ""; closedQuote = false; }
    else if (!quoted && (c === "\n" || c === "\r")) { if (c === "\r" && source[index + 1] === "\n") index += 1; row.push(cell); if (row.some((x) => x !== "")) rows.push(row); row = []; cell = ""; closedQuote = false; }
    else { if (closedQuote) fail("CSV_QUOTE_INVALID"); cell += c; }
  }
  if (quoted) fail("CSV_QUOTE_UNCLOSED");
  row.push(cell); if (row.some((x) => x !== "")) rows.push(row);
  if (rows.length < 2) fail("CSV_ROWS_MISSING");
  const headers = rows[0].map(safeText); validateHeaders(headers);
  if (rows.slice(1).some((values) => values.length !== headers.length)) fail("CSV_COLUMN_COUNT_MISMATCH");
  return { headers, rows: rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]]))), source_format: "csv" };
}
async function readRows(input, args) {
  const extension = path.extname(input).toLowerCase();
  if (extension === ".json") { const parsed = await json(input); const rows = Array.isArray(parsed) ? parsed : parsed.rows; if (!Array.isArray(rows) || !rows.every((x) => x && typeof x === "object" && !Array.isArray(x))) fail("JSON_ROWS_REQUIRED"); return { headers: [...new Set(rows.flatMap((x) => Object.keys(x)))], rows, source_format: "json" }; }
  if (extension === ".csv") return parseCsv(await fs.readFile(input, "utf8"));
  if ([".xlsx", ".xlsm"].includes(extension)) {
    const python = arg(args, "--python", false) ?? process.env.PYTHON;
    if (!python) fail("XLSX_PYTHON_REQUIRED", "Set PYTHON or pass --python; Python must have openpyxl installed.");
    const script = path.join(HERE, "portable_xlsx_rows.py"); const sheet = arg(args, "--sheet", false);
    const result = spawnSync(python, [script, input, ...(sheet ? [sheet] : [])], { encoding: "utf8" });
    if (result.status !== 0) fail("XLSX_IMPORT_FAILED", safeText(result.stderr || result.stdout));
    try { const parsed = JSON.parse(result.stdout); return { ...parsed, source_format: "xlsx" }; } catch { fail("XLSX_OUTPUT_INVALID"); }
  }
  fail("INPUT_FORMAT_UNSUPPORTED", extension || "no extension");
}
function chooseColumn(headers, key) { const normalized = new Map(headers.map((header) => [safeText(header).toLowerCase(), header])); return COLUMN_NAMES[key].map((name) => normalized.get(name)).find(Boolean) ?? null; }
function mapColumns(headers, supplied) {
  const direct = supplied ? supplied.mapping ?? Object.fromEntries(Object.entries(supplied).filter(([key]) => !["parameter_steps","step_metadata"].includes(key))) : null;
  const mapping = direct && Object.keys(direct).length ? direct : Object.fromEntries(Object.keys(COLUMN_NAMES).map(key => [key,chooseColumn(headers,key)]));
  if (!mapping.case_id || !mapping.action) fail("CASE_MAPPING_REQUIRED", "case_id and action columns must be mapped.");
  if (Object.values(mapping).some(column => column && !headers.includes(column))) fail("CASE_MAPPING_COLUMN_UNKNOWN");
  return mapping;
}
function sourceValue(row, column) { return column ? String(row[column] ?? "").replace(/\r\n?/g, "\n").trim() : ""; }
function yes(value) { return /^(true|yes|y|1|是|需要)$/i.test(safeText(value)); }
const CLICK_ISSUE_CODES = new Set(["STEP_CLICK_FLAG_CONFLICT", "STEP_CLICK_MEANING_REQUIRED", "STEP_CLICK_FLAG_INVALID"]);
function clickActionSignal(value) {
  const action = String(value ?? "").normalize("NFKC").replace(/^\s*(?:步骤\s*)?\d+[.、)）:：]\s*/, "");
  const mention = /点击|单击|双击|右击|\b(?:click|double[- ]click|right[- ]click)\b/i;
  const verb = '(?:点击|单击|双击|右击)(?!次数|数量|频率|位置|坐标|事件|后|前)|(?:click|double[- ]click|right[- ]click)\\b';
  const direct = new RegExp(`^(?:(?:请|然后|随后|接着|再|并|用鼠标|使用鼠标)\\s*){0,2}(?:${verb})`, 'i');
  const next = new RegExp(`(?:然后|随后|接着|并且|并|再|\\bthen\\s+)(?:${verb})`, 'i');
  const negative = /^(?:请\s*)?(?:不要|无需|无须|禁止|不得|不必|勿|不)(?:再|进行)?\s*(?:点击|单击|双击|右击)|^(?:do\s+not|don't|no\s+need\s+to|never)\s+(?:click|double[- ]click|right[- ]click)\b/i;
  const observing = /^(?:检查|查看|观察|核对|验证|确认|读取|等待|记录)|^(?:check|inspect|observe|verify|read|wait|record)\b/i;
  let ambiguous = false, prohibited = false;
  for (const clause of action.split(/[，,；;。\n]/).map(x => x.trim()).filter(Boolean)) {
    if (!mention.test(clause)) continue;
    if (negative.test(clause)) { prohibited = true; if (next.test(clause)) ambiguous = true; continue; }
    if (direct.test(clause) || next.test(clause)) return 'EXPLICIT_CLICK_ACTION';
    const observedClick = /(?:点击|单击|双击|右击)(?:后|前|的|结果|次数|数量|事件|位置)|\b(?:after|before)\s+(?:a\s+)?click\b|\bclick\s+(?:result|event|count|position)\b/i.test(clause);
    if (!(observing.test(clause) && observedClick)) ambiguous = true;
  }
  return ambiguous ? 'AMBIGUOUS_CLICK_MENTION' : prohibited ? 'EXPLICIT_NO_CLICK_ACTION' : 'NO_CLICK_ACTION_IDENTIFIED';
}
function sourceClickDeclaration(raw, multipleSteps) {
  if (!raw) return { present:false, origin:'source_action' };
  if (yes(raw)) return { present:!multipleSteps, value:true, origin:'source_column' };
  if (/^(false|no|n|0|否|不需要|无需)$/i.test(raw)) return { present:true, value:false, origin:'source_column' };
  return { present:true, value:null, origin:'source_column' };
}
function applyClickRequirement(item, step, declaration, originalAction = step.action) {
  item.import_issues = item.import_issues.filter(issue => !(CLICK_ISSUE_CODES.has(issue.code) && issue.step_id === step.step_id));
  const originalSignal = clickActionSignal(originalAction), mappedSignal = clickActionSignal(step.action);
  const explicitClick = [originalSignal,mappedSignal].includes('EXPLICIT_CLICK_ACTION');
  const ambiguous = [originalSignal,mappedSignal].includes('AMBIGUOUS_CLICK_MENTION');
  step.requires_click = declaration.present ? declaration.value === true : explicitClick;
  step.click_requirement = { origin:declaration.present ? declaration.origin : explicitClick ? 'explicit_source_action' : 'source_action_scan',
    source_action:originalAction, source_action_signal:originalSignal, action_signal:mappedSignal,
    ...(declaration.present ? {declared_value:declaration.value} : {}),
    source:{sheet:step.source_sheet,row:step.source_row,action_cell:step.source_cells?.action ?? null,click_cell:step.source_cells?.requires_click ?? null} };
  let code;
  if (declaration.present && typeof declaration.value !== 'boolean') code = 'STEP_CLICK_FLAG_INVALID';
  else if ((explicitClick && !step.requires_click) || ([originalSignal,mappedSignal].includes('EXPLICIT_NO_CLICK_ACTION') && step.requires_click)) code = 'STEP_CLICK_FLAG_CONFLICT';
  else if (ambiguous && !declaration.present) code = 'STEP_CLICK_MEANING_REQUIRED';
  if (code) item.import_issues.push({code,step_id:step.step_id,source:step.click_requirement.source,
    reason:code === 'STEP_CLICK_FLAG_CONFLICT' ? '技术点击标记与原操作或显式参数动作冲突；Agent须对照原文修正映射' : '点击技术语义尚未明确；由Agent对照原操作补step_metadata或参数映射，不能修改原业务预期'});
}
function numberedParts(value, startingAt = 1) {
  const lines = value.split("\n"); const parts = []; let unnumberedPrefix = false;
  for (const line of lines) {
    const match = /^\s*(?:步骤\s*)?(\d+)[.、．)）:：]\s*(.*)$/.exec(line);
    if (match) parts.push({ number: Number(match[1]), text: match[2], original: line });
    else if (parts.length) { parts.at(-1).text += `\n${line}`; parts.at(-1).original += `\n${line}`; }
    else if (line.trim()) unnumberedPrefix = true;
  }
  const valid = parts.length > 0 && !unnumberedPrefix && parts.every((p, i) => p.number === startingAt + i && p.text.trim());
  return { parts, valid, hasNumbering: parts.length > 0 };
}
function expectedSection(value) {
  if (!value.startsWith("逐步预期：")) return { steps: value, criteria: {} };
  const fields = {}; let field;
  for (const line of value.split("\n")) {
    const match = /^(逐步预期|观察位置|成功标准|失败标准)：(.*)$/.exec(line);
    if (match) { field = match[1]; fields[field] = match[2]; }
    else if (field) fields[field] += `\n${line}`;
  }
  return { steps: fields["逐步预期"] ?? "", criteria: fields };
}
export function makeCases(rows, mapping, { rowSources = [], pending = false, side = "ui" } = {}) {
  if (!rows.length) return [];
  const byId = new Map();
  rows.forEach((row, index) => {
    const location = rowSources[index] ?? { sheet: null, row: index + 2, cells: {} };
    const caseId = id(sourceValue(row, mapping.case_id)); if (!caseId) fail("CASE_ID_MISSING", `row ${location.row}`);
    const action = sourceValue(row, mapping.action); if (!action) fail("STEP_ACTION_MISSING", `${caseId}: row ${location.row}`);
    const expectedRaw = pending ? "" : sourceValue(row, mapping.expected);
    const expected = expectedSection(expectedRaw); const observation = sourceValue(row, mapping.observation);
    const item = byId.get(caseId) ?? { case_id: caseId, title: sourceValue(row, mapping.title) || caseId, source: sourceValue(row, mapping.source) || null,
      original_rows: [], source_locations: [], steps: [], import_issues: [], parameter_rows: [], source_side: side, business_expectation_missing: pending };
    const explicitSequence = Number(sourceValue(row,mapping.step_number));
    const startingAt = Number.isInteger(explicitSequence) && explicitSequence > 0 ? explicitSequence : item.steps.length + 1;
    const actions = numberedParts(action,startingAt); const expectations = numberedParts(expected.steps,startingAt);
    const canPair = actions.valid && expectations.valid && actions.parts.length === expectations.parts.length;
    const ambiguous = actions.hasNumbering ? !canPair && !pending && !!expectedRaw : expectations.hasNumbering;
    if (ambiguous) item.import_issues.push({ code: "STEP_EXPECTATION_PAIRING_REQUIRED", source: location });
    const actionParts = actions.valid ? actions.parts : [{ number: Number(sourceValue(row, mapping.step_number)) || null, text: action, original: action }];
    if (actions.hasNumbering && !actions.valid) item.import_issues.push({ code: "STEP_NUMBERING_REVIEW_REQUIRED", source: location });
    for (const [partIndex, part] of actionParts.entries()) {
      const paired = canPair ? expectations.parts[partIndex] : !actions.hasNumbering && !expectations.hasNumbering ? {text: expected.steps, original: expected.steps} : null;
      const step = { step_id: `${caseId}:S${item.steps.length + 1}`, original_step_number: part.number, action: part.text,
        observation: expected.criteria["观察位置"] || (canPair ? paired.text : observation) || "待确认观察方式",
        expected: paired?.text || null, original_action: part.original, original_expected: paired?.original ?? null,
        source_row: location.row,
        source_sheet: location.sheet, source_cells: { action: location.cells?.[mapping.action] ?? null, expected: location.cells?.[mapping.expected] ?? null, requires_click: location.cells?.[mapping.requires_click] ?? null } };
      applyClickRequirement(item,step,sourceClickDeclaration(sourceValue(row,mapping.requires_click),actionParts.length > 1));
      item.steps.push(step);
    }
    // A case-wide click flag cannot assign click meaning to each numbered step.
    if (actionParts.length > 1 && yes(sourceValue(row, mapping.requires_click))) item.import_issues.push({code:"STEP_CLICK_MAPPING_REQUIRED",source:location});
    item.original_rows.push(row); item.source_locations.push(location);
    item.business_criteria = expected.criteria;
    for (const field of ["preconditions", "test_data", "cleanup", "preparation"]) {
      const value = sourceValue(row, mapping[field]);
      if (value) { item[field] ??= []; item[field].push({ value, source: location, cell: location.cells?.[mapping[field]] ?? null }); }
    }
    if (!expectedRaw) item.business_expectation_missing = true;
    byId.set(caseId, item);
  });
  return [...byId.values()].map((item) => ({ ...item,
    import_status: item.business_expectation_missing ? "BLOCKED_ORACLE" : item.import_issues.length ? "NEEDS_MAPPING" : side !== "ui" ? "MANUAL_REQUIRED" : "IMPORTED",
    original_case_sha256: digest(JSON.stringify({ rows: item.original_rows, locations: item.source_locations })) }));
}
async function init(args) {
  const project = resolveProject(args); if (await exists(project)) { const entries = await fs.readdir(project); if (entries.length) fail("PROJECT_DIRECTORY_NOT_EMPTY", project); } else await fs.mkdir(project, { recursive: true });
  await fs.mkdir(path.join(project, "support"), { recursive: true }); await fs.mkdir(path.join(project, "adapter"), { recursive: true });
  for (const relative of SUPPORT_FILES) { const source = path.join(HERE, relative); if (!(await exists(source))) fail("SUPPORT_COMPONENT_MISSING", relative); await fs.copyFile(source, path.join(project, "support", relative)); }
  await writeJson(path.join(project, "project.json"), { schema_version: SCHEMA, project_status: "SCRIPT_DRAFT", created_at: new Date().toISOString(), product_environment_access: false, reviewer_status: "PENDING", manual_cases_review: { status: "PENDING", case_import_sha256: null }, notes: "Set non-production authorization and adapter before running." });
  await writeJson(path.join(project, "package.json"), { private: true, type: "module", scripts: { preflight: "node support/portable-ui-workflow.mjs preflight --project .", session: "node support/portable-ui-workflow.mjs session --project .", run: "node support/portable-ui-workflow.mjs run --project .", report: "node support/portable-ui-workflow.mjs report --project ." }, dependencies: { playwright: "1.62.1" }, engines: { node: ">=20" } });
  await fs.writeFile(path.join(project, "requirements-openpyxl.txt"), "openpyxl>=3.1.5,<4\n", "utf8"); await fs.writeFile(path.join(project, ".gitignore"), "node_modules/\nruns/\nsession-discovery/\n.auth/\n.session/\n.repair-reservation.lock\n.preflight-video-probe/\n", "utf8");
  await fs.mkdir(path.join(project, "cases"), { recursive: true });
  await fs.writeFile(path.join(project, "adapter", "project-adapter.mjs"), `// Agent-maintained project contract. Do not put credentials, cookies, tokens, or selectors in manual case input.\nexport const baseUrl = \"https://replace-with-authorized-nonproduction.example\";\nexport const auth = { mode: \"manual_headed\" };\nexport const loginAdapter = {\n  // Return true only for a visible login page; use structure, never input values.\n  isLoginPage: async (page) => false,\n  // Positive authenticated-state oracle only. A URL change alone is insufficient.\n  isAuthenticated: async (page) => false,\n  loginWithCredential: undefined,\n};\nexport const discoveryCases = []; // {case_id, route, semantic_targets:[{target_id, role, name}]}\nexport function classifyCase(testCase) {\n  if (testCase.business_expectation_missing) return { classification: \"BLOCKED_ORACLE\", reason: \"原人工用例缺少业务预期\" };\n  return { classification: \"BLOCKED_LOCATOR\", reason: \"请在项目 adapter 中冻结唯一定位契约后执行\" };\n}\nexport async function executeCase() { throw Object.assign(new Error(\"ADAPTER_EXECUTION_NOT_IMPLEMENTED\"), { case_status: \"EXTERNAL_BLOCKED\" }); }\n`, "utf8");
  console.log(JSON.stringify({ ok: true, command: "init", project, next: "import confirmed manual cases, then adapt and preflight" }));
}
async function importCases(args) {
  const project = resolveProject(args); const input = path.resolve(arg(args, "--input")); const raw = await readRows(input, args);
  const supplied = hasArg(args, "--mapping") ? await json(path.resolve(arg(args, "--mapping"))) : null;
  const sheets = raw.case_sheets ?? [raw]; const mappings = []; const cases = [];
  for (const sheet of sheets) {
    let sheetSupplied = supplied;
    if (sheet.sheet === "待确认用例" && supplied?.mapping) sheetSupplied = {mapping:{...supplied.mapping,expected:null,observation:null}};
    else if (sheet.sheet === "待确认用例" && supplied && Object.hasOwn(supplied,"case_id")) sheetSupplied = {...supplied,expected:null,observation:null};
    const mapping = mapColumns(sheet.headers, sheetSupplied); mappings.push({sheet:sheet.sheet ?? null, header_row:sheet.header_row ?? 1, mapping});
    cases.push(...makeCases(sheet.rows, mapping, {rowSources:sheet.row_sources, pending:sheet.sheet === "待确认用例", side:raw.workbook_side ?? "ui"}));
  }
  if (!cases.length) fail("INPUT_ROWS_MISSING");
  if (new Set(cases.map(x => x.case_id)).size !== cases.length) fail("CASE_ID_DUPLICATE_ACROSS_SHEETS");
  for (const [caseId,metadata] of Object.entries(supplied?.step_metadata ?? {})) {
    const item = cases.find(x=>x.case_id === caseId); if (!item) fail("STEP_METADATA_CASE_UNKNOWN",caseId);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) fail("STEP_METADATA_INVALID",caseId);
    for (const [stepId,detail] of Object.entries(metadata)) {
      const step = item.steps.find(x=>x.step_id === stepId); if (!step) fail("STEP_METADATA_STEP_UNKNOWN",stepId);
      if (!detail || typeof detail.requires_click !== "boolean" || Object.keys(detail).some(key=>!["requires_click","evidence"].includes(key)) || (detail.evidence !== undefined && typeof detail.evidence !== "string")) fail("STEP_METADATA_INVALID",stepId);
      applyClickRequirement(item,step,{present:true,value:detail.requires_click,origin:'step_metadata'},step.click_requirement?.source_action ?? step.action);
      step.technical_metadata = structuredClone(detail);
    }
    item.step_metadata = metadata;
    if (item.steps.every(step=>metadata[step.step_id])) item.import_issues = item.import_issues.filter(issue=>issue.code !== "STEP_CLICK_MAPPING_REQUIRED");
    if (!item.import_issues.length && item.import_status === "NEEDS_MAPPING") item.import_status = "IMPORTED";
  }
  const dataSheet = raw.auxiliary_sheets?.find(x => x.sheet === "测试数据");
  for (const [index,row] of (dataSheet?.rows ?? []).entries()) {
    const caseId = id(row["关联用例编号"]); const item = cases.find(x => x.case_id === caseId);
    if (!item) fail("PARAMETER_CASE_UNKNOWN", caseId);
    item.parameter_rows.push({parameter_row_id: id(row["数据编号"]), original_row: row, source: dataSheet.row_sources[index]});
  }
  if (supplied?.parameter_steps !== undefined) {
    if (!supplied.parameter_steps || typeof supplied.parameter_steps !== "object" || Array.isArray(supplied.parameter_steps)) fail("PARAMETER_MAPPING_INVALID");
    for (const caseId of Object.keys(supplied.parameter_steps)) {
      const item = cases.find(x=>x.case_id === caseId);
      if (!item) fail("PARAMETER_MAPPING_CASE_UNKNOWN",caseId);
      if (!item.parameter_rows.length) fail("PARAMETER_MAPPING_CASE_NOT_PARAMETERIZED",caseId);
    }
  }
  for (const item of cases) {
    if (item.parameter_rows.length) {
      const provided = supplied?.parameter_steps?.[item.case_id];
      const vectorIds = item.parameter_rows.map(x => x.parameter_row_id);
      if (vectorIds.some(x => !x) || new Set(vectorIds).size !== vectorIds.length) fail("PARAMETER_ROW_ID_INVALID", item.case_id);
      item.original_steps = structuredClone(item.steps);
      if (!provided) {
        item.import_issues.push({code:"PARAMETER_STEP_MAPPING_REQUIRED",parameter_row_ids:vectorIds});
        if (!item.business_expectation_missing) item.import_status = "NEEDS_MAPPING";
      } else {
        if (Object.keys(provided).length !== vectorIds.length || Object.keys(provided).some(x => !vectorIds.includes(x))) fail("PARAMETER_MAPPING_VECTOR_MISMATCH", item.case_id);
        // Full explicit vector mappings replace unresolved per-step technical decisions,
        // while each mapped action is still checked against the original click instruction.
        item.import_issues = item.import_issues.filter(issue => !CLICK_ISSUE_CODES.has(issue.code) && issue.code !== 'STEP_CLICK_MAPPING_REQUIRED');
        item.steps = item.parameter_rows.flatMap(vector => {
          const mapped = provided[vector.parameter_row_id];
          if (!Array.isArray(mapped) || mapped.length !== item.original_steps.length) fail("PARAMETER_MAPPING_STEP_MISMATCH", item.case_id);
          return mapped.map((step,index) => {
            const original = item.original_steps[index];
            if (step.source_step_id !== original.step_id || typeof step.action !== "string" || !step.action.trim() || typeof step.expected !== "string" || !step.expected.trim() || typeof step.requires_click !== "boolean") fail("PARAMETER_MAPPING_STEP_INVALID", item.case_id);
            const expanded = {...original, step_id:`${original.step_id}:V${vectorIds.indexOf(vector.parameter_row_id)+1}`, source_step_id:original.step_id,
              action:step.action, expected:step.expected, observation:step.expected, requires_click:step.requires_click,
              vector_ref:vector.parameter_row_id, vector_source:vector.source, vector_input:vector.original_row["输入值"], vector_expected_branch:vector.original_row["预期分支"], mapping_origin:"provided_explicit_mapping"};
            applyClickRequirement(item,expanded,{present:true,value:step.requires_click,origin:'parameter_steps'},original.click_requirement?.source_action ?? original.action);
            return expanded;
          });
        });
        item.parameter_step_mapping = provided;
      }
    }
    item.import_status = item.business_expectation_missing ? 'BLOCKED_ORACLE' : item.import_issues.length ? 'NEEDS_MAPPING' : item.source_side !== 'ui' ? 'MANUAL_REQUIRED' : 'IMPORTED';
    item.original_case_sha256 = digest(JSON.stringify({rows:item.original_rows,locations:item.source_locations,parameter_rows:item.parameter_rows}));
  }
  await writeJson(path.join(project, "cases", "column-mapping.json"), { schema_version: SCHEMA, input: path.basename(input), source_format: raw.source_format,
    source_layout:raw.source_layout ?? raw.source_format, sheet:raw.sheet ?? null, mapping:mappings[0].mapping, sheets:mappings,
    recognized_by: "agent_or_operator_review_required", saved_at: new Date().toISOString() });
  await writeJson(path.join(project, "cases", "case-import.json"), { schema_version: SCHEMA, source_file: path.basename(input), source_file_sha256:digest(await fs.readFile(input)),
    source_layout:raw.source_layout ?? raw.source_format, source_side:raw.workbook_side ?? "ui", imported_at: new Date().toISOString(), case_count: cases.length,
    auxiliary_sheets:raw.auxiliary_sheets ?? [], unselected_sheets:raw.unselected_sheets ?? [], cases });
  console.log(JSON.stringify({ ok: true, command: "import", case_count: cases.length, blocked_oracle: cases.filter(x => x.business_expectation_missing).map(x => x.case_id),
    needs_mapping:cases.filter(x => x.import_status === "NEEDS_MAPPING").map(x => x.case_id), manual_required:cases.filter(x=>x.import_status === "MANUAL_REQUIRED").map(x=>x.case_id), mapping:mappings[0].mapping, sheets:mappings.map(x=>x.sheet) }));
}
async function loadAdapter(project, file = path.join(project, "adapter", "project-adapter.mjs")) { if (!(await exists(file))) fail("ADAPTER_MISSING"); const adapter = await applyHandoffAuthentication(project, await import(`${pathToFileURL(file).href}?v=${Date.now()}`)); if (!adapter.baseUrl || !adapter.auth || (adapter.auth.mode !== "none" && (!adapter.loginAdapter || typeof adapter.loginAdapter.isAuthenticated !== "function" || (adapter.auth.mode !== "windows_dpapi" && typeof adapter.loginAdapter.isLoginPage !== "function")))) fail("ADAPTER_CONTRACT_INVALID"); authorizedTarget(adapter.baseUrl); return adapter; }
async function loadPlaywright() { try { const imported = await import("playwright"); return imported.default ?? imported; } catch { fail("PLAYWRIGHT_IMPORT_FAILED", "Run npm install in the portable project, then npx playwright install chromium."); } }
function authorizedTarget(value) {
  let url; try { url = new URL(value); } catch { fail("TARGET_URL_INVALID"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) fail("TARGET_URL_INVALID");
  return url.href;
}
async function requireExecutionReadiness(project) {
  const config = await json(path.join(project, "project.json"));
  const imported = await fs.readFile(path.join(project, "cases", "case-import.json"));
  const digest = crypto.createHash("sha256").update(imported).digest("hex");
  if (config.manual_cases_review?.status !== "CONFIRMED" || config.manual_cases_review.case_import_sha256 !== digest) fail("CONFIRMED_CASE_BASELINE_REQUIRED");
  if (config.project_status !== "READY_TO_RUN") fail("EXECUTION_READINESS_REQUIRED");
}
async function runtimeProbe(project, injectedBrowser) {
  let browser = injectedBrowser; let context;
  try {
    if (!browser) { const playwright = await loadPlaywright(); browser = await playwright.chromium.launch({ headless: true }); }
    context = await browser.newContext({ recordVideo: { dir: path.join(project, ".preflight-video-probe") } });
    const page = await context.newPage(); await page.goto("data:text/html,<main>portable-preflight</main>");
    const video = await page.video().path(); await context.close(); context = null;
    if ((await fs.stat(video)).size <= 0) fail("PREFLIGHT_VIDEO_EMPTY");
    return { name: "playwright_browser_video", status: "READY", recording_written: true };
  } finally { await context?.close?.().catch(() => {}); if (!injectedBrowser) await browser?.close?.().catch(() => {}); }
}
function caseIdsArgument(args) { const value = arg(args,"--case-ids",false); return value === null ? undefined : value.split(",").map(x=>x.trim()); }
export function validateSelection({retryFrom,caseIds,batchId,batchGroupId}, imported) {
  if (retryFrom && (batchId || batchGroupId)) fail("BATCH_RETRY_OPTIONS_CONFLICT");
  if (caseIds !== undefined && (!Array.isArray(caseIds) || !caseIds.length || caseIds.some(x=>typeof x !== "string" || !x.trim()) || new Set(caseIds).size !== caseIds.length)) fail("CASE_SELECTION_INVALID");
  if (caseIds && imported && caseIds.some(x=>!imported.cases.some(c=>c.case_id === x))) fail("CASE_SELECTION_UNKNOWN");
  if (!retryFrom && (caseIds || batchId || batchGroupId)) {
    if (!batchId || !batchGroupId || !caseIds) fail("BATCH_ID_GROUP_AND_CASE_IDS_REQUIRED");
    for (const value of [batchId,batchGroupId]) if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value)) fail("BATCH_ID_INVALID");
  }
}
export async function prepareInitialBatch({project,importedBytes,baseUrl,caseIds,batchId,batchGroupId}) {
  validateSelection({caseIds,batchId,batchGroupId},JSON.parse(importedBytes));
  if (!batchId) return null;
  const baseline = digest(importedBytes); const target = digest(new URL(baseUrl).href);
  const runs = path.join(project,"runs"); await fs.mkdir(runs,{recursive:true});
  for (const entry of await fs.readdir(runs,{withFileTypes:true})) {
    if (!entry.isDirectory() || !/^run-[A-Za-z0-9._-]+$/.test(entry.name)) continue;
    let prior;
    try { prior = JSON.parse(await fs.readFile(path.join(runs,entry.name,"batch-reservation.json"),"utf8")); }
    catch(error) { if (error.code === "ENOENT") continue; fail("BATCH_RESERVATION_INVALID"); }
    if (prior.batch_group_id !== batchGroupId) continue;
    if (prior.case_import_sha256 !== baseline) fail("BATCH_BASELINE_CHANGED");
    if (prior.target_sha256 !== target) fail("BATCH_TARGET_CHANGED");
    if (prior.batch_id === batchId) fail("BATCH_ID_ALREADY_RESERVED");
    if (!Array.isArray(prior.selected_case_ids)) fail("BATCH_RESERVATION_INVALID");
    if (caseIds.some(x=>prior.selected_case_ids.includes(x))) fail("BATCH_CASE_ALREADY_RESERVED_USE_RETRY");
  }
  return {batch_id:batchId,batch_group_id:batchGroupId,selected_case_ids:caseIds,
    case_import_sha256:baseline,target_sha256:target,selection_kind:"INITIAL_BATCH",technical_retry:false};
}
function executionSummary(executed) {
  const cases = executed.facts.cases ?? [];
  const selection = executed.facts.retry ?? executed.facts.batch;
  const selected = selection ? cases.filter(item => selection.selected_case_ids.includes(item.case_id)) : cases;
  const passed = selected.filter((item) => item.status === "PASS").length;
  return { ok: selected.length > 0 && passed === selected.length, run_id: executed.runId, run_dir: executed.runDir, cases: cases.length, selected_cases: selected.length, passed, incomplete: selected.length - passed, ...(executed.facts.retry ? { parent_run_id: executed.facts.retry.parent_run_id } : {}), ...(executed.facts.batch ? {batch_id:executed.facts.batch.batch_id,batch_group_id:executed.facts.batch.batch_group_id,not_selected:cases.length-selected.length} : {}) };
}
async function preflight(args) {
  const project = resolveProject(args); const missing = (await Promise.all(requiredProjectFiles(project).map(async (x) => !(await exists(x)) ? x : null))).filter(Boolean); const result = { schema_version: SCHEMA, command: "preflight", project, status: "SCRIPT_DRAFT", missing: missing.map((x) => path.relative(project, x)), checks: [] };
  if (!missing.length) { try { await loadAdapter(project); result.checks.push({ name: "adapter_contract", status: "READY" }); } catch (error) { result.checks.push({ name: "adapter_contract", status: "BLOCKED", code: printableError(error).code }); } try { result.checks.push(await runtimeProbe(project)); } catch (error) { result.checks.push({ name: "playwright_browser_video", status: "BLOCKED", code: printableError(error).code }); } }
  // Runtime probes alone never establish environment authorization, test data,
  // cleanup permission, or a correct business adapter.  Keep the project in
  // SCRIPT_DRAFT until the explicit non-production run gate is supplied.
  result.runtime_capability = !result.missing.length && result.checks.every((x) => x.status === "READY") ? "READY" : "BLOCKED";
  result.status = "SCRIPT_DRAFT"; await writeJson(path.join(project, "preflight.json"), result); console.log(JSON.stringify(result));
}
function safeLoginStructure(page) { return page.evaluate(() => ({ url: `${location.origin}${location.pathname}`, title: document.title.slice(0, 160), forms: [...document.forms].map((form, formIndex) => ({ form_index: formIndex, controls: [...form.querySelectorAll("input,button,select,textarea")].map((node, index) => ({ index, tag: node.tagName.toLowerCase(), type: node.getAttribute("type") || null, role: node.getAttribute("role") || null, name: node.getAttribute("name") || null, label: node.labels?.[0]?.textContent?.trim().slice(0, 120) || null, aria_label: node.getAttribute("aria-label") || null, placeholder_present: !!node.getAttribute("placeholder"), value_collected: false })) })) })); }
function locatorForExploration(page, contract) { if (contract?.kind === "test_id") return page.getByTestId(contract.test_id); if (contract?.kind === "role") return page.getByRole(contract.role, contract.options ?? {}); if (contract?.kind === "label") return page.getByLabel(contract.label, contract.options ?? {}); if (contract?.kind === "text") return page.getByText(contract.text, contract.options ?? {}); fail("EXPLORATION_LOCATOR_INVALID"); }
async function session(args) {
  const project = resolveProject(args); if (!hasArg(args, "--nonproduction-authorized")) fail("NONPRODUCTION_AUTHORIZATION_REQUIRED"); const adapterPath = path.resolve(arg(args, "--adapter", false) ?? path.join(project, "adapter", "project-adapter.mjs")); const playwright = await loadPlaywright(); const browser = await playwright.chromium.launch({ headless: false }); const context = await browser.newContext(); const page = await context.newPage(); const target = hasArg(args, "--url") ? arg(args, "--url") : null; let adapter = null; let authenticatedSession = null;
  let requestId;
  const emit = (value) => process.stdout.write(`${JSON.stringify({ ...value, ...(requestId ? { request_id: requestId } : {}) })}\n`);
  let frozenTarget;
  let frozenAuthMode;
  const loadGeneration = async () => {
    const snapshot = await freezeSessionModules(project, adapterPath);
    const runtime = await import(snapshot.runtimeUrl);
    const replacement = await runtime.applyHandoffAuthentication(project, await import(snapshot.adapterUrl));
    if (!replacement.auth || authorizedTarget(replacement.baseUrl) !== frozenTarget) fail("AUTH_TARGET_MISMATCH");
    const mode = replacement.auth.mode || "manual_headed";
    if (frozenAuthMode && mode !== frozenAuthMode) fail("AUTH_MODE_CHANGED");
    if (mode !== "none" && (!replacement.loginAdapter || typeof replacement.loginAdapter.isAuthenticated !== "function")) fail("ADAPTER_CONTRACT_INVALID");
    frozenAuthMode = mode;
    adapter = replacement;
    return { snapshot, runtime };
  };
  const assertFrozenTarget = () => { if (!adapter || authorizedTarget(adapter.baseUrl) !== frozenTarget) fail("AUTH_TARGET_MISMATCH"); };
  const requireAuth = () => { assertFrozenTarget(); if (!authenticatedSession || authenticatedSession.status !== "AUTH_SUCCEEDED") fail("AUTH_REQUIRED"); };
  try { if (await exists(adapterPath)) adapter = await applyHandoffAuthentication(project, await import(`${pathToFileURL(adapterPath).href}?v=${Date.now()}`)); const url = target ?? adapter?.baseUrl; if (!url) fail("SESSION_URL_REQUIRED"); frozenTarget = authorizedTarget(url); if (adapter) assertFrozenTarget(); await page.goto(url, { waitUntil: "domcontentloaded" }); emit({ event: "SESSION_READY", synthetic_driver: hasArg(args, "--synthetic-driver"), recording: false, trace: false, login_structure: await safeLoginStructure(page), instruction: "仅输出结构、不会读取输入值。写入 adapter 后发送 authenticate；浏览器、context 与页面会原样复用。" });
    frozenAuthMode = adapter?.auth?.mode || (adapter ? "manual_headed" : undefined);
    const idleMinutes = Number(arg(args, '--session-idle-minutes', false) ?? 0);
    if (!Number.isFinite(idleMinutes) || idleMinutes < 0 || idleMinutes > 1440) fail('SESSION_IDLE_MINUTES_INVALID');
    const input = hasArg(args, '--commands') ? commandFileLines(project, arg(args, '--commands'), { idleMs: idleMinutes * 60000 }) : readline.createInterface({ input: process.stdin, crlfDelay: Infinity }); for await (const line of input) { let request; requestId = null; try { request = JSON.parse(line); if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("invalid"); requestId = typeof request.request_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(request.request_id) ? request.request_id : null; } catch { emit({ ok: false, code: "JSONL_REQUEST_INVALID" }); continue; }
      if (request.op === "inspect_login") { emit({ ok: true, login_structure: await safeLoginStructure(page) }); continue; }
      if (request.op === "reload_adapter" || request.op === "reload_runtime") { try {
        const loaded = await loadGeneration();
        const login = await adapter.loginAdapter?.isLoginPage?.(page);
        const authenticated = await adapter.loginAdapter?.isAuthenticated?.(page);
        emit({ ok: true, source_generation: loaded.snapshot.generation, browser_reused: true, is_login_page: login === true, authenticated_positive_oracle: authenticated === true });
      } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "authenticate") { try {
        const loaded = await loadGeneration();
        if (new URL(page.url()).origin !== new URL(adapter.baseUrl).origin) fail("AUTH_TARGET_MISMATCH");
        const { createAuthenticatedSession } = await import(pathToFileURL(path.join(path.dirname(loaded.snapshot.runtimePath), 'portable_auth.mjs')).href);
        const events = [];
        // The command session owns the browser and login page, not this helper.
        await authenticatedSession?.close?.();
        authenticatedSession = await createAuthenticatedSession({ playwright, baseUrl: adapter.baseUrl, auth: adapter.auth, loginAdapter: adapter.loginAdapter, browser, loginContext: context, beforeAuthenticate: async () => adapter, onStatus: (event) => { events.push(event.status); emit({ event: "AUTH_STATUS", status: event.status, user_action_required_now: event.status === "AUTH_REQUIRED" || event.status === "AUTH_TIMEOUT" }); }, launchOptions: { headless: false } });
        emit({ ok: authenticatedSession.status === "AUTH_SUCCEEDED", status: authenticatedSession.status, events, browser_reused: true });
      } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "inventory") { try { requireAuth(); emit({ ok: true, inventory: await collectLiveSemanticInventory(page, { scope: safeText(request.scope) || "session" }) }); } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "probe") { try { requireAuth(); const locator = locatorFromContract(page, { locator: request.locator }); const count = await locator.count(); const visible = count === 1 && await locator.isVisible(); const disabled = count === 1 ? await locator.isDisabled().catch(() => null) : null; emit({ ok: true, mode: "READONLY_LOCATOR_PROBE", count, visible, disabled, unique_visible: count === 1 && visible, actionable: count === 1 && visible && disabled === false, locator: request.locator }); } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "navigate") { try { requireAuth(); const next = new URL(safeText(request.route), adapter.baseUrl); if (next.origin !== new URL(adapter.baseUrl).origin || !next.pathname.startsWith("/")) fail("SESSION_ROUTE_REJECTED"); await page.goto(next.toString(), { waitUntil: "domcontentloaded" }); emit({ ok: true, route: `${next.pathname}${next.hash}` }); } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "explore_open") { try { requireAuth(); const approved = (adapter.safeExplorationActions ?? []).find((item) => item?.target_id === request.target_id); if (!approved || approved.action !== "open" || approved.data_mutation !== false) fail("EXPLORATION_ACTION_NOT_AUTHORIZED"); const target = locatorForExploration(page, approved.locator); if (await target.count() !== 1 || !await target.isVisible() || await target.isDisabled().catch(() => false)) fail("EXPLORATION_TARGET_NOT_UNIQUE_VISIBLE"); await target.click(); emit({ ok: true, target_id: approved.target_id, action: "open", inventory: await collectLiveSemanticInventory(page, { scope: safeText(request.scope) || "opened" }) }); } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "discover") { try { requireAuth(); const cases = Array.isArray(adapter.discoveryCases) ? adapter.discoveryCases : []; if (!cases.length) fail("DISCOVERY_CASES_REQUIRED"); const outputDir = path.join(project, "session-discovery", nowId()); const result = await discoverReadonlyPageMap({ context, baseUrl: adapter.baseUrl, cases, outputDir, runId: "session-discovery" }); emit({ ok: true, output_dir: outputDir, receipt: result.receipt }); } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "diagnose") { try { const loaded = await loadGeneration(); emit({ ok: true, diagnosis: await loaded.runtime.diagnoseSessionRun(project, request.run_id) }); } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "execute") { try {
        // Reload the complete dependency generation, so failed syntax cannot
        // silently fall back to a previously loaded business adapter.
        const loaded = await loadGeneration(); assertFrozenTarget();
        if (!authenticatedSession || typeof authenticatedSession.ensureAuthenticated !== 'function') fail('AUTH_REQUIRED');
        const executed = await loaded.runtime.executeAuthenticatedProject({ project, adapter, sessionResult: authenticatedSession, authEvents: [], adapterPath: loaded.snapshot.adapterPath, sourceSnapshot: loaded.snapshot, retryFrom: request.retry_from, caseIds: request.case_ids, batchId:request.batch_id, batchGroupId:request.batch_group_id });
        emit(executionSummary(executed));
      } catch (error) { emit(printableError(error)); } continue; }
      if (request.op === "close") break; emit({ ok: false, code: "SESSION_OPERATION_UNSUPPORTED" });
    }
  } finally { await authenticatedSession?.close?.().catch(() => {}); await context.close().catch(() => {}); await browser.close().catch(() => {}); }
}
export const diagnoseSessionRun = diagnoseRun;
export async function executeAuthenticatedProject({ project, adapter, sessionResult, authEvents, runId = `run-${nowId()}-${crypto.randomBytes(3).toString('hex')}`, adapterPath = path.join(project, 'adapter/project-adapter.mjs'), sourceSnapshot, retryFrom, caseIds, batchId, batchGroupId }) {
  validateSelection({retryFrom,caseIds,batchId,batchGroupId});
  await requireExecutionReadiness(project);
  const importedBytes = await fs.readFile(path.join(project, 'cases', 'case-import.json'));
  const sourceHandoff = await loadProjectHandoff(project, importedBytes);
  const runtimeVerifications = [];
  const makeHandoff = input => createCaseHandoffRuntime({ loaded: sourceHandoff, caseId: input.item.case_id, page: input.page, baseUrl: adapter.baseUrl, onEvent: event => runtimeVerifications.push(event) });
  // Authentication waiting happens before reserving a Case attempt.
  if (typeof sessionResult.ensureAuthenticated === 'function' && await sessionResult.ensureAuthenticated({ loginAdapter: adapter.loginAdapter }) !== true) fail(sessionResult.status === 'AUTH_SUCCEEDED' ? 'AUTH_REVALIDATION_FAILED' : sessionResult.status);
  await runtimeProbe(project, sessionResult.browser);
  const executedAdapterHash = digest(await fs.readFile(adapterPath));
  const expectations = await loadConfirmedExpectations(project, importedBytes); const imported = expectations.imported; const runDir = path.join(project, "runs", runId); const discoveryDir = path.join(runDir, "readonly-discovery");
  let retry = null; let batch = null; let lock;
  try {
    if (retryFrom || batchId) { try { lock = await fs.open(path.join(project, '.repair-reservation.lock'), 'wx'); } catch { fail('REPAIR_RESERVATION_BUSY'); } }
    if (retryFrom) {
      retry = await prepareRetry({ project, parentRunId: retryFrom, importedBytes, baseUrl: adapter.baseUrl, caseIds });
      const parent = await json(path.join(runDirectory(project, retryFrom), 'machine-facts.json'));
      assertSameRetryExpectations(parent.confirmed_expectations, expectations.confirmations, retry.selected_case_ids);
      assertSameRetryHandoff(parent.frontend_handoff, sourceHandoff, retry.selected_case_ids);
    }
    else batch = await prepareInitialBatch({project,importedBytes,baseUrl:adapter.baseUrl,caseIds,batchId,batchGroupId});
    await fs.mkdir(path.join(project, 'runs'), { recursive: true }); await fs.mkdir(runDir, { recursive: false });
    if (retry) await fs.writeFile(path.join(runDir, 'attempt.json'), JSON.stringify(retry, null, 2), { flag: 'wx' });
    if (batch) await fs.writeFile(path.join(runDir,'batch-reservation.json'),JSON.stringify(batch,null,2),{flag:'wx'});
  } finally { if (lock) { await lock.close(); await fs.unlink(path.join(project, '.repair-reservation.lock')); } }
  const selection = retry ?? batch;
  if (sourceSnapshot) {
    const sourceRoot = path.dirname(path.dirname(sourceSnapshot.runtimePath));
    for (const file of sourceSnapshot.manifest) {
      const bytes = await fs.readFile(path.join(sourceRoot, file.path));
      if (digest(bytes) !== file.sha256) fail('SESSION_SNAPSHOT_CHANGED');
      const destination = path.join(runDir, 'source-snapshot', file.path);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, bytes, { flag: 'wx' });
    }
    await writeJson(path.join(runDir, 'source-snapshot', 'manifest.json'), { generation: sourceSnapshot.generation, files: sourceSnapshot.manifest });
  }
  if (sourceHandoff) await fs.writeFile(path.join(runDir, 'frontend-handoff.json'), sourceHandoff.bytes, { flag: 'wx' });
  let authenticationBlocked = false;
  const classifyWithHandoff = (testCase, pageMap) => {
    if (testCase.import_issues?.length || (testCase.source_side && testCase.source_side !== 'ui')) return classifyReadyCase(adapter, testCase, pageMap);
    const support = supportForCase(sourceHandoff, testCase.case_id);
    if (support?.status === 'BLOCKED_SOURCE') return { classification: 'BLOCKED_LOCATOR', reason: '当前用例的源码技术映射尚未闭合', source_support: support };
    const result = classifyReadyCase(adapter, support ? { ...testCase, source_support: support } : testCase, pageMap);
    if (result.classification === 'runnable' && support) {
      if (support.requires_runtime_preconditions && typeof adapter.verifyHandoffPreconditions !== 'function') return { classification: 'BLOCKED_DATA', reason: '该用例需要实际验证数据/目标前置，adapter尚未提供验证', source_support: support };
      if (support.actions.some(action => action.data_effect === 'mutation') && result.cleanup_required !== true) return { classification: 'BLOCKED_DATA', reason: '源码表明会写入，该用例必须绑定实际清理', source_support: support };
    }
    return support ? { ...result, source_support: support } : result;
  };
  const executeWithHandoff = async input => {
    const handoff = makeHandoff(input);
    if (!handoff) return adapter.executeCase(input);
    const runStep = async (stepRef, options = {}) => {
      const step = input.item.steps.find(item => typeof stepRef === 'string' ? item.step_id === stepRef : item.step_number === stepRef);
      if (!step || typeof options.action !== 'function') fail('HANDOFF_STEP_ACTION_REQUIRED');
      let resolved;
      await input.runPreparation(async () => { resolved = await handoff.resolveStep(step.step_id); });
      return input.runStep(stepRef, { ...options, target: resolved.target, action: async () => {
        const result = await options.action();
        await handoff.wait(step.step_id);
        return result;
      } });
    };
    return adapter.executeCase({ ...input, handoff, runStep });
  };
  const cleanupWithHandoff = typeof adapter.cleanupCase === 'function' ? async input => {
    const handoff = makeHandoff(input);
    const result = await adapter.cleanupCase({ ...input, handoff });
    if (handoff && result?.status === 'CLEAN') await handoff.verifyCleanup();
    return result;
  } : undefined;
  const casesForDiscovery = (Array.isArray(adapter.discoveryCases) ? adapter.discoveryCases : []).filter(x => !selection || selection.selected_case_ids.includes(x.case_id));
  const discovery = async () => { if (!casesForDiscovery.length) return { mode: "ADAPTER_NO_READONLY_DISCOVERY", routes: [] }; const context = await sessionResult.createUnrecordedContext(); try { const result = await discoverReadonlyPageMap({ context, baseUrl: adapter.baseUrl, cases: casesForDiscovery, outputDir: discoveryDir, runId }); return { mode: "READONLY_DISCOVERY", receipt: result.receipt, pages: result.pageMap }; } finally { await context.close(); } };
  const facts = await runGenericCases({ browser: sessionResult.browser, createCaseContext: sessionResult.createCaseContext, baseUrl: adapter.baseUrl, runId, runDir, cases: imported.cases, discover: discovery, classify: (testCase, pageMap) => selection && !selection.selected_case_ids.includes(testCase.case_id) ? { classification: 'NOT_EXECUTED', reason: retry ? '本次局部修复不重跑该Case；结果保留在父运行。' : '该 Case 不在本批选择范围，本批未执行。', selection_status:'NOT_SELECTED' } : testCase.business_expectation_missing ? { classification: "BLOCKED_ORACLE", reason: "原人工用例缺少业务预期" } : classifyWithHandoff(testCase, pageMap), execute: executeWithHandoff, cleanupCase: cleanupWithHandoff, beforeCase: async (item) => {
    if (typeof sessionResult.ensureAuthenticated === 'function') {
      if (authenticationBlocked || await sessionResult.ensureAuthenticated({ loginAdapter: adapter.loginAdapter }) !== true) {
        authenticationBlocked = true;
        throw Object.assign(new Error("AUTH_REVALIDATION_FAILED"), { case_status: "EXTERNAL_BLOCKED" });
      }
    } else {
      const context = await sessionResult.createUnrecordedContext();
      try { const page = await context.newPage(); await page.goto(adapter.baseUrl, { waitUntil: "domcontentloaded" }); if (adapter.auth.mode !== "none" && await adapter.loginAdapter.isAuthenticated(page) !== true) { const error = new Error("AUTH_REVALIDATION_FAILED"); error.case_status = "EXTERNAL_BLOCKED"; throw error; } } finally { await context.close(); }
    }
    const support = supportForCase(sourceHandoff, item.case_id);
    if (support?.requires_runtime_preconditions) {
      const context = await sessionResult.createUnrecordedContext();
      try {
        const page = await context.newPage(); await page.goto(adapter.baseUrl, { waitUntil: 'domcontentloaded' });
        const handoff = makeHandoff({ item, page });
        if (await adapter.verifyHandoffPreconditions({ page, item, baseUrl: adapter.baseUrl, handoff }) !== true) throw Object.assign(new Error('HANDOFF_RUNTIME_PRECONDITION_FAILED'), { case_status: 'BLOCKED_DATA' });
        runtimeVerifications.push({ case_id: item.case_id, step_id: null, phase: 'PRECONDITIONS_VERIFIED', at: new Date().toISOString() });
      } finally { await context.close(); }
    }
  }, productEnvironmentAccess: adapter.synthetic_driver !== true });
  if (process.env.MANUAL_UI_CLAUDE_RUN_ID) facts.model_run_id = process.env.MANUAL_UI_CLAUDE_RUN_ID;
  facts.case_import_sha256 = digest(importedBytes); facts.target_sha256 = digest(new URL(adapter.baseUrl).href); facts.adapter_sha256 = executedAdapterHash; if (retry) facts.retry = retry; if (batch) facts.batch = batch;
  if (expectations.sha256) {
    facts.confirmed_expectations = expectations.confirmations;
    facts.confirmed_expectations_sha256 = expectations.sha256;
    await writeJson(path.join(runDir, 'confirmed-expectations.json'), { case_import_sha256: digest(importedBytes), confirmations: expectations.confirmations });
  }
  if (sourceHandoff) facts.frontend_handoff = {
    artifact_id: sourceHandoff.handoff.artifact_id, content_sha256: sourceHandoff.content_sha256,
    file_sha256: sourceHandoff.file_sha256, case_fingerprints: sourceHandoff.case_fingerprints,
    source_revision: sourceHandoff.handoff.source.revision, deployment_revision_status: sourceHandoff.binding.deployment_revision_status,
    case_statuses: sourceHandoff.validation.case_statuses, runtime_verifications: runtimeVerifications,
    artifact_path: 'frontend-handoff.json', source_verified_this_run: false,
  };
  if (sourceSnapshot) facts.source_snapshot = { generation: sourceSnapshot.generation, manifest_path: 'source-snapshot/manifest.json' };
  facts.reviewer_status = "PENDING"; facts.media_semantic_review_status = "PENDING"; facts.execution_driver = adapter.synthetic_driver === true ? "SYNTHETIC_AUTH_FIXTURE" : "STANDARD_PLAYWRIGHT"; facts.authentication = { status: sessionResult.status, events: authEvents }; await writeJson(path.join(runDir, "machine-facts.json"), facts); await writeReport(runDir); return { runId, runDir, facts };
}
export function classifyReadyCase(adapter, testCase, pageMap) {
  if (testCase.import_issues?.length) return {classification:"MANUAL_REQUIRED",reason:"原步骤、逐步预期或点击标记尚未明确配对；保留原文，需复核导入映射",import_issues:testCase.import_issues};
  if (testCase.source_side && testCase.source_side !== "ui") return {classification:"MANUAL_REQUIRED",reason:"API 用例已保留；当前运行器只执行 Web UI 用例"};
  const result = adapter.classifyCase?.(testCase, pageMap) ?? { classification: "BLOCKED_LOCATOR", reason: "项目适配未分类" };
  if (result.classification === "runnable" && (result.test_data_ready !== true || result.cleanup_ready !== true || typeof result.cleanup_required !== "boolean" || (result.cleanup_required && typeof adapter.cleanupCase !== "function"))) return { classification: "BLOCKED_DATA", reason: "该 Case 的测试数据或清理可行性尚未确认；无需数据或清理也须明确确认不适用" };
  return result;
}
async function run(args) {
  const selectionOptions = {retryFrom:arg(args,"--retry-from",false),caseIds:caseIdsArgument(args),batchId:arg(args,"--batch-id",false),batchGroupId:arg(args,"--batch-group-id",false)};
  validateSelection(selectionOptions);
  const project = resolveProject(args); const authorization = hasArg(args, "--nonproduction-authorized"); if (!authorization) fail("NONPRODUCTION_AUTHORIZATION_REQUIRED"); await requireExecutionReadiness(project); const adapter = await loadAdapter(project); const imported = await json(path.join(project, "cases", "case-import.json")); validateSelection(selectionOptions,imported); const playwright = await loadPlaywright(); let createAuthenticatedSession; try { ({ createAuthenticatedSession } = await import("./portable_auth.mjs")); } catch { fail("PORTABLE_AUTH_NOT_AVAILABLE"); }
  const runId = `run-${nowId()}`; const runDir = path.join(project, "runs", runId); const authEvents = []; const sessionResult = await createAuthenticatedSession({ playwright, baseUrl: adapter.baseUrl, auth: adapter.auth, loginAdapter: adapter.loginAdapter, onStatus: (event) => authEvents.push({ status: event?.status, user_action_required_now: event?.status === "AUTH_REQUIRED" || event?.status === "AUTH_TIMEOUT" }), launchOptions: { headless: adapter.auth.mode !== "manual_headed" && !!adapter.auth.mode } });
  if (sessionResult.status !== "AUTH_SUCCEEDED") { const facts = { schema_version: SCHEMA, run_id: runId, execution_status: "NOT_EXECUTED", ...(process.env.MANUAL_UI_CLAUDE_RUN_ID ? { model_run_id: process.env.MANUAL_UI_CLAUDE_RUN_ID } : {}), authentication: { status: sessionResult.status, events: authEvents }, case_import_sha256: digest(await fs.readFile(path.join(project, "cases", "case-import.json"))), product_environment_access: false, reviewer_status: "PENDING", media_semantic_review_status: "PENDING", ...(selectionOptions.batchId ? {batch:{batch_id:selectionOptions.batchId,batch_group_id:selectionOptions.batchGroupId,selected_case_ids:selectionOptions.caseIds,selection_kind:"INITIAL_BATCH",technical_retry:false,execution_reserved:false}} : {}), cases: imported.cases.map((x) => ({ case_id: x.case_id, status: selectionOptions.caseIds && !selectionOptions.caseIds.includes(x.case_id) ? "NOT_EXECUTED" : "NOT_EXECUTED_AUTH" })) }; await writeJson(path.join(runDir, "machine-facts.json"), facts); await writeReport(runDir); await sessionResult.close?.(); console.log(JSON.stringify({ ok: false, code: sessionResult.status, run_dir: runDir })); process.exitCode = 1; return; }
  try { const executed = await executeAuthenticatedProject({ project, adapter, sessionResult, authEvents, runId, ...selectionOptions }); const summary = executionSummary(executed); console.log(JSON.stringify(summary)); if (!summary.ok) process.exitCode = 1; }
  finally { await sessionResult.close?.(); }
}
async function writeReport(runDir, projectDir = path.resolve(runDir, "..", "..")) {
  return generateOfflineReport({ runDir, projectDir });
}
async function report(args) {
  const project = resolveProject(args);
  const runDir = path.resolve(arg(args, "--run", false) ?? path.join(project, "runs", (await fs.readdir(path.join(project, "runs"))).sort().at(-1) ?? ""));
  const result = await writeReport(runDir, project);
  console.log(JSON.stringify({ ok: result.validation.status === "COMPLETE", report: result.output, legacy_report: result.legacyOutput, report_validation: result.validation.status, issues: result.validation.issues.length, reviewer_status: result.validation.reviewer_status }));
  if (result.validation.status !== "COMPLETE") process.exitCode = 1;
}
async function reauditMedia(args) {
  const project = resolveProject(args); const runDir = runDirectory(project,arg(args,"--run"));
  const outputDir = path.resolve(arg(args,"--output")); const caseIds = caseIdsArgument(args);
  const playwright = await loadPlaywright(); const browser = await playwright.chromium.launch({headless:true});
  try {
    const receipt = await reauditRunMedia({browser,runDir,outputDir,caseIds});
    const ok = receipt.cases.length > 0 && receipt.cases.every(x=>x.media_status === "VERIFIED");
    console.log(JSON.stringify({ok,command:"reaudit-media",...receipt}));
    if (!ok) process.exitCode = 1;
  } finally { await browser.close(); }
}
async function diagnose(args) { console.log(JSON.stringify({ ok: true, diagnosis: await diagnoseRun(resolveProject(args), arg(args, '--run-id')) })); }
async function bindHandoff(args) {
  console.log(JSON.stringify(await bindProjectHandoff({ project: resolveProject(args), handoffPath: path.resolve(arg(args, '--handoff')), deployedRevision: arg(args, '--deployed-revision', false) ?? undefined })));
}
async function main() { const [command, ...args] = process.argv.slice(2); if (!command || hasArg(args, "--help")) { console.log("Commands: init, import, bind-handoff, preflight, session, run, diagnose, report, reaudit-media"); return; } if (!new Set(["init", "import", "bind-handoff", "preflight", "session", "run", "diagnose", "report", "reaudit-media"]).has(command)) fail("COMMAND_UNSUPPORTED"); await ({ init, import: importCases, "bind-handoff": bindHandoff, preflight, session, run, diagnose, report, "reaudit-media":reauditMedia }[command])(args); }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { if (process.env.PORTABLE_UI_TEST_DIAGNOSTIC === "1") process.stderr.write(`${error?.stack ?? error?.name ?? "portable workflow error"}\n`); console.log(JSON.stringify(printableError(error))); process.exitCode = 1; });
