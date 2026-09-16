// Optional source handoff binding. Business operations and assertions stay in the adapter.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateCaseHandoff } from './case_handoff.mjs';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, status) => { throw Object.assign(new Error(code), { code, ...(status ? { case_status: status } : { error_scope: 'AUTOMATION' }) }); };
const canonical = value => JSON.stringify(sort(value));
function sort(value) { return Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value; }
function freeze(value) { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; }
async function optionalBytes(file) { try { return await fs.readFile(file); } catch (error) { if (error.code === 'ENOENT') return null; fail('HANDOFF_FILE_UNREADABLE'); } }
const artifactPath = project => path.join(project, 'cases', 'frontend-handoff.json');
const receiptPath = project => path.join(project, 'cases', 'frontend-handoff-binding.json');

function fingerprints(handoff) {
  return Object.fromEntries(handoff.case_bindings.map(binding => {
    const actions = binding.steps.map(step => handoff.actions.find(action => action.id === step.action_id)).filter(Boolean);
    const refs = [...actions.flatMap(action => [...(action.source_refs ?? []), ...(action.controls ?? []).flatMap(control => control.source_refs ?? [])]), ...(handoff.authentication?.source_refs ?? [])];
    const files = handoff.source.files.filter(file => file.disposition === 'dependency' || refs.some(ref => ref.path === file.path));
    return [binding.case_id, hash(canonical({ baseline: handoff.case_import_sha256, revision: handoff.source.revision, authentication: handoff.authentication, binding, actions, files }))];
  }));
}

async function validateBytes(bytes, caseImportBytes) {
  let handoff;
  try { handoff = JSON.parse(bytes); } catch { fail('HANDOFF_JSON_INVALID'); }
  const validation = await validateCaseHandoff(handoff, { caseImportBytes });
  if (!validation.valid || !validation.baseline_verified) fail('HANDOFF_VALIDATION_FAILED');
  return { handoff: freeze(handoff), validation, bytes, file_sha256: hash(bytes), content_sha256: handoff.integrity.content_sha256, case_fingerprints: fingerprints(handoff) };
}

export async function bindProjectHandoff({ project, handoffPath, deployedRevision }) {
  const bytes = await fs.readFile(handoffPath);
  const imported = await fs.readFile(path.join(project, 'cases', 'case-import.json'));
  const loaded = await validateBytes(bytes, imported);
  if (deployedRevision !== undefined && (typeof deployedRevision !== 'string' || !deployedRevision.trim() || deployedRevision !== loaded.handoff.source.revision)) fail('HANDOFF_DEPLOYED_REVISION_MISMATCH');
  const file = artifactPath(project); const previous = await optionalBytes(file);
  const binding = { schema_version: 'manual-ui-handoff-binding/v1', artifact_id: loaded.handoff.artifact_id, file_sha256: loaded.file_sha256, content_sha256: loaded.content_sha256, case_import_sha256: hash(imported), source_revision: loaded.handoff.source.revision, deployed_revision: deployedRevision ?? null, deployment_revision_status: deployedRevision ? 'DECLARED_MATCH' : 'UNVERIFIED', case_statuses: loaded.validation.case_statuses };
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (previous && hash(previous) !== loaded.file_sha256) {
    const backup = path.join(project, 'cases', 'handoff-history', hash(previous));
    await fs.mkdir(backup, { recursive: true });
    await fs.writeFile(path.join(backup, 'frontend-handoff.json'), previous, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const oldReceipt = await optionalBytes(receiptPath(project));
    if (oldReceipt) await fs.writeFile(path.join(backup, 'binding.json'), oldReceipt, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  }
  // A torn pair is rejected by loadProjectHandoff; it cannot silently run mismatched metadata.
  await fs.writeFile(file, bytes);
  await fs.writeFile(receiptPath(project), JSON.stringify(binding, null, 2) + '\n');
  return { ok: true, status: loaded.validation.status === 'SOURCE_READY' ? 'BOUND_SOURCE_READY' : 'BOUND_PARTIAL', ...binding };
}

export async function loadProjectHandoff(project, caseImportBytes) {
  const bytes = await optionalBytes(artifactPath(project));
  if (!bytes) { if (await optionalBytes(receiptPath(project))) fail('HANDOFF_ARTIFACT_REQUIRED'); return null; }
  const loaded = await validateBytes(bytes, caseImportBytes ?? await fs.readFile(path.join(project, 'cases', 'case-import.json')));
  const bindingBytes = await optionalBytes(receiptPath(project));
  if (!bindingBytes) fail('HANDOFF_BINDING_RECEIPT_REQUIRED');
  let binding; try { binding = JSON.parse(bindingBytes); } catch { fail('HANDOFF_BINDING_RECEIPT_INVALID'); }
  if (binding.file_sha256 !== loaded.file_sha256 || binding.case_import_sha256 !== loaded.handoff.case_import_sha256 || binding.content_sha256 !== loaded.content_sha256) fail('HANDOFF_BINDING_CHANGED');
  if (binding.deployed_revision && binding.deployed_revision !== loaded.handoff.source.revision) fail('HANDOFF_DEPLOYED_REVISION_MISMATCH');
  return { ...loaded, binding };
}

export function handoffLocator(page, contract) {
  switch (contract?.kind) {
    case 'role': return page.getByRole(contract.role, { name: contract.name, exact: true });
    case 'testid': return page.getByTestId(contract.value);
    case 'label': return page.getByLabel(contract.value, { exact: true });
    case 'placeholder': return page.getByPlaceholder(contract.value, { exact: true });
    case 'text': return page.getByText(contract.value, { exact: true });
    case 'css': return page.locator(contract.value);
    default: fail('HANDOFF_LOCATOR_INVALID');
  }
}

export function createHandoffLoginAdapter(handoff) {
  const auth = handoff.authentication;
  if (auth?.mode !== 'manual_headed' || auth.knowledge_status === 'unresolved' || !auth.authenticated_locator || !auth.login_locator) fail('HANDOFF_AUTH_SUPPORT_UNRESOLVED');
  const visible = async (page, contract) => { try { const target = handoffLocator(page, contract); return await target.count() === 1 && await target.isVisible(); } catch { return false; } };
  return { isAuthenticated: page => visible(page, auth.authenticated_locator), isLoginPage: page => visible(page, auth.login_locator) };
}

export async function applyHandoffAuthentication(project, adapter) {
  const loaded = await loadProjectHandoff(project);
  if (!loaded) return adapter;
  const mode = adapter.auth?.mode || 'manual_headed';
  const declaredMode = loaded.handoff.authentication?.mode;
  if ((mode === 'none') !== (declaredMode === 'none')) fail('HANDOFF_AUTH_MODE_MISMATCH');
  if (mode !== 'none' && !adapter.loginAdapter) return { ...adapter, loginAdapter: createHandoffLoginAdapter(loaded.handoff) };
  return adapter;
}

export function supportForCase(loaded, caseId) {
  if (!loaded) return null;
  const binding = loaded.handoff.case_bindings.find(item => item.case_id === caseId);
  const status = loaded.validation.case_statuses.find(item => item.case_id === caseId);
  if (!binding || !status) fail('HANDOFF_CASE_MAPPING_MISSING');
  const actions = binding.steps.map(step => loaded.handoff.actions.find(action => action.id === step.action_id)).filter(Boolean);
  return { ...structuredClone(status), binding: structuredClone(binding), actions: structuredClone(actions), content_sha256: loaded.content_sha256, requires_runtime_preconditions: status.status === 'RUNTIME_CONFIRMATION_REQUIRED' || actions.some(action => action.data_effect === 'mutation') };
}

export function assertSameRetryHandoff(previous, loaded, caseIds) {
  for (const id of caseIds) if ((previous?.case_fingerprints?.[id] ?? null) !== (loaded?.case_fingerprints?.[id] ?? null)) fail('REPAIR_HANDOFF_BASELINE_CHANGED');
}

export function createCaseHandoffRuntime({ loaded, caseId, page, baseUrl, onEvent = () => {} }) {
  if (!loaded) return null;
  const support = supportForCase(loaded, caseId);
  const event = (phase, stepId, controlId) => onEvent({ case_id: caseId, step_id: stepId, ...(controlId ? { control_id: controlId } : {}), phase, at: new Date().toISOString() });
  const origin = new URL(baseUrl).origin;
  const sameOrigin = () => { try { if (new URL(page.url()).origin !== origin) fail('HANDOFF_RUNTIME_ORIGIN_MISMATCH'); } catch (error) { if (error.code) throw error; fail('HANDOFF_RUNTIME_ORIGIN_MISMATCH'); } };
  const actionFor = stepId => {
    const binding = support.binding.steps.find(step => step.step_id === stepId);
    const action = loaded.handoff.actions.find(item => item.id === binding?.action_id);
    if (binding?.status !== 'mapped' || !action || action.knowledge_status === 'unresolved') fail('HANDOFF_STEP_UNRESOLVED', 'BLOCKED_LOCATOR');
    return action;
  };
  const uniqueVisible = async target => {
    try { await target.waitFor({ state: 'visible', timeout: 10000 }); } catch { fail('HANDOFF_TARGET_NOT_VISIBLE'); }
    if (await target.count() !== 1 || !await target.isVisible()) fail('HANDOFF_TARGET_NOT_UNIQUE_VISIBLE');
    sameOrigin();
  };
  const waitOne = async contract => {
    sameOrigin();
    const target = handoffLocator(page, contract.locator); const deadline = Date.now() + contract.timeout_ms;
    try {
      if (contract.state === 'visible' || contract.state === 'hidden') {
        if (await target.count() > 1) fail('HANDOFF_WAIT_NOT_UNIQUE');
        await target.waitFor({ state: contract.state, timeout: contract.timeout_ms });
        const count = await target.count();
        if (count > 1 || (contract.state === 'visible' && count !== 1)) fail('HANDOFF_WAIT_NOT_UNIQUE');
        sameOrigin(); return;
      }
      while (Date.now() <= deadline) {
        const count = await target.count();
        if (count > 1) fail('HANDOFF_WAIT_NOT_UNIQUE');
        if (count === 1 && await target.isVisible()) {
          if (contract.state === 'enabled' && await target.isEnabled()) { sameOrigin(); return; }
          if (contract.state === 'text' && (await target.textContent() ?? '').trim() === contract.text) { sameOrigin(); return; }
        }
        // Poll a concrete DOM predicate within the declared bound; not a business delay.
        await new Promise(resolve => setTimeout(resolve, Math.min(50, Math.max(1, deadline - Date.now()))));
      }
    } catch (error) { if (error.code?.startsWith('HANDOFF_')) throw error; }
    fail('HANDOFF_COMPLETION_WAIT_FAILED');
  };
  const wait = async stepId => {
    const action = actionFor(stepId);
    for (const condition of action.waits) await waitOne(condition);
    const observation = handoffLocator(page, action.observation.locator);
    await uniqueVisible(observation);
    event('COMPLETION_OBSERVED', stepId);
  };
  return Object.freeze({
    case_id: caseId,
    support: freeze(support),
    async resolveStep(stepId) {
      sameOrigin(); const action = actionFor(stepId); const target = handoffLocator(page, action.locator);
      await uniqueVisible(target); event('TARGET_VERIFIED', stepId);
      return { action: structuredClone(action), target, observation: handoffLocator(page, action.observation.locator), wait: () => wait(stepId) };
    },
    async resolveControl(stepId, controlId) {
      sameOrigin();
      const control = (actionFor(stepId).controls ?? []).find(item => item.id === controlId);
      if (!control) fail('HANDOFF_CONTROL_UNRESOLVED', 'BLOCKED_LOCATOR');
      const target = handoffLocator(page, control.locator);
      await uniqueVisible(target); event('CONTROL_VERIFIED', stepId, controlId);
      return target;
    },
    wait,
    async verifyCleanup() {
      for (const action of support.actions.filter(item => item.data_effect === 'mutation')) {
        for (const condition of action.cleanup.post_cleanup_waits) await waitOne(condition);
      }
      event('CLEANUP_OBSERVED', null);
    },
  });
}
