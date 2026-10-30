import {diagnostics} from '../diagnostics.mjs';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire, isBuiltin } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from '../../../harness-probe/src/process-control.mjs';
import { prepareWindowRecorder } from '../build/window-recorder.mjs';
import { assembleNativeEvidence, finalizeNativeEvidence } from './evidence-result.mjs';
import {validateScriptPackages,scriptPath} from '../cases/script-package.mjs';
import {formalEntry} from './execution-purpose.mjs';
import { instrumentNativeSource } from './evidence-transform.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const workbench = path.resolve(here, '../..');
const require = createRequire(path.join(workbench, 'package.json'));
const playwrightRoot = path.dirname(require.resolve('playwright/package.json'));
const { babelParse } = require(path.join(playwrightRoot, 'lib/transform/babelBundle.js'));
const playwrightCli = require.resolve('@playwright/test/cli');
const extensions = new Set(['.mjs', '.js', '.ts', '.json']);
const excludedDirectories = new Set(['node_modules', '.git', '.dsh', '.sessions', '.private', 'private', 'runtime', 'runs', 'test-results', 'playwright-report', '.requests', '.responses', 'references']);
const excludedFiles = new Set(['execute.mjs', 'current-task.json']);
const sensitiveFile = /^(?:\.env(?:\..*)?|.*(?:credentials|storage[-_]?state|auth[-_]?state|session[-_]?state|cookies|tokens).*\.json)$/i;
const maxFiles = 1000, maxFileBytes = 2 * 1024 * 1024, maxBundleBytes = 20 * 1024 * 1024;
const digest = value => createHash('sha256').update(value).digest('hex');
const posix = value => value.split(path.sep).join('/');
export const inside = (root, value) => value === root || (!path.relative(root, value).startsWith('..' + path.sep) && path.relative(root, value) !== '..' && !path.isAbsolute(path.relative(root, value)));
const errorText = error => String(error?.message || error);
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function atomicJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2));
  await fs.rename(temporary, file);
}

export async function rejectSymlinkPath(absolute) {
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const info = await fs.lstat(current).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (info?.isSymbolicLink()) throw Error('NATIVE_SOURCE_SYMLINK_NOT_ALLOWED');
  }
}

function dependencies(source, filename) {
  let ast;
  try { ast = babelParse(source, filename, true); }
  catch (error) { throw Error(`NATIVE_SOURCE_SYNTAX_INVALID: ${filename}: ${error.message}`); }
  const found = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) found.push(node.source.value);
    if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && (node.callee?.type === 'Import' || node.callee?.name === 'require'))) {
      const argument = node.source ?? node.arguments?.[0];
      if (argument?.type !== 'StringLiteral') throw Error(`NATIVE_DYNAMIC_DEPENDENCY_NOT_ALLOWED: ${filename}`);
      found.push(argument.value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast.program);
  return found;
}

function assertImportGraph(files,workspace,entry){
  const byPath = new Map(files.map(file => [file.path, file]));
  if (!byPath.has(entry)) throw Error('NATIVE_ENTRY_NOT_IN_SOURCE_BUNDLE');
  const pending = [entry], visited = new Set();
  while (pending.length) {
    const selected = pending.pop();
    if (visited.has(selected)) continue;
    visited.add(selected);
    const file = byPath.get(selected);
    if (path.extname(file.path) === '.json') continue;
    for (const dependency of dependencies(file.content.toString('utf8'), file.path)) {
      if (dependency === '@playwright/test' || isBuiltin(dependency)) continue;
      if (!dependency.startsWith('./') && !dependency.startsWith('../')) throw Error(`NATIVE_EXTERNAL_DEPENDENCY_NOT_ALLOWED: ${dependency}`);
      if (dependency.includes('?') || dependency.includes('#') || dependency.includes('\\')) throw Error('NATIVE_DEPENDENCY_PATH_INVALID');
      const resolved = path.resolve(workspace, path.dirname(file.path), dependency);
      if (!inside(workspace, resolved)) throw Error('NATIVE_DEPENDENCY_OUTSIDE_WORKSPACE');
      const relative = posix(path.relative(workspace, resolved));
      const candidates = [relative, ...(relative.endsWith('.js') ? [relative.slice(0, -3) + '.ts'] : []), ...['.ts', '.js', '.mjs', '.json'].map(ext => relative + ext), ...['index.ts', 'index.js', 'index.mjs'].map(name => relative + '/' + name)];
      const selectedDependency = candidates.find(candidate => byPath.has(candidate));
      if (!selectedDependency) throw Error(`NATIVE_DEPENDENCY_NOT_SNAPSHOTTED: ${dependency}`);
      pending.push(selectedDependency);
    }
  }
  return byPath;
}

export async function snapshotSources(workspace, snapshot, entry) {
  const files = [];
  let bytes = 0;
  async function visit(directory) {
    for (const item of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (excludedDirectories.has(item.name.toLowerCase()) || excludedFiles.has(item.name.toLowerCase()) || sensitiveFile.test(item.name)) continue;
      const file = path.join(directory, item.name);
      const info = await fs.lstat(file);
      if (info.isSymbolicLink()) throw Error('NATIVE_SOURCE_SYMLINK_NOT_ALLOWED');
      if (info.isDirectory()) { await visit(file); continue; }
      if (!info.isFile() || !extensions.has(path.extname(item.name).toLowerCase())) continue;
      if (info.size > maxFileBytes || ++files.length > maxFiles || (bytes += info.size) > maxBundleBytes) throw Error('NATIVE_SOURCE_BUNDLE_TOO_LARGE');
      const relative = posix(path.relative(workspace, file));
      const content = await fs.readFile(file);
      if (content.length !== info.size) throw Error('NATIVE_SOURCE_CHANGED_DURING_SNAPSHOT');
      files[files.length - 1] = { path: relative, bytes: content.length, sha256: digest(content), content };
    }
  }
  await visit(workspace);
  // A project may retain exploratory scripts using other tools. Only the selected
  // spec's import graph is executable; unrelated saved drafts are evidence, not entrypoints.
  const byPath=assertImportGraph(files,workspace,entry);
  for (const file of files) {
    const target = path.join(snapshot, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, { flag: 'wx' });
  }
  const manifest = files.map(({ content, ...file }) => file);
  return { files: manifest, script_sha256: byPath.get(entry).sha256, bundle_sha256: digest(JSON.stringify(manifest)) };
}

async function verifySnapshot(snapshot, manifest) {
  for (const file of manifest.files) {
    const absolute = path.join(snapshot, file.path);
    const info = await fs.lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink() || digest(await fs.readFile(absolute)) !== file.sha256) throw Error('NATIVE_EXECUTED_SOURCE_CHANGED');
  }
}

async function copyFrozenSource(source, snapshot, entry) {
  const root = path.resolve(source.runDirectory);
  await rejectSymlinkPath(root);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'source-manifest.json'), 'utf8'));
  if (manifest.entry !== entry || source.entry !== entry || manifest.script_sha256 !== source.script_sha256 ||
      manifest.bundle_sha256 !== source.bundle_sha256 || !Array.isArray(manifest.files) || !manifest.files.length ||
      manifest.files.length > maxFiles || digest(JSON.stringify(manifest.files)) !== source.bundle_sha256)
    throw Error('NATIVE_FROZEN_SOURCE_BINDING_MISMATCH');
  let bytes = 0; const seen = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || file.path.includes('\\') || path.posix.normalize(file.path) !== file.path ||
        file.path.startsWith('../') || path.posix.isAbsolute(file.path) || file.path.split('/').some(s => excludedDirectories.has(s.toLowerCase())) ||
        !extensions.has(path.extname(file.path)) || seen.has(file.path) || !Number.isInteger(file.bytes) || file.bytes < 0 ||
        file.bytes > maxFileBytes || (bytes += file.bytes) > maxBundleBytes) throw Error('NATIVE_FROZEN_SOURCE_MANIFEST_INVALID');
    seen.add(file.path);
    const original = path.resolve(root, 'snapshot', file.path);
    if (!inside(path.join(root, 'snapshot'), original)) throw Error('NATIVE_FROZEN_SOURCE_PATH_INVALID');
    await rejectSymlinkPath(original);
    if (!(await fs.stat(original)).isFile()) throw Error('NATIVE_FROZEN_SOURCE_FILE_INVALID');
    const content = await fs.readFile(original);
    if (content.length !== file.bytes || digest(content) !== file.sha256) throw Error('NATIVE_FROZEN_SOURCE_CHANGED');
    const target = path.join(snapshot, file.path); await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, { flag: 'wx' });
  }
  if (manifest.files.find(f => f.path === entry)?.sha256 !== source.script_sha256) throw Error('NATIVE_FROZEN_ENTRY_MISMATCH');
  return { files: manifest.files, script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256 };
}

async function copyImportedSource(source,snapshot,entry,caseContent){
  const [pkg]=validateScriptPackages([source.importedPackage],caseContent);
  if(entry!==formalEntry(caseContent.external_id)||pkg.entry!==entry||source.entry!==entry||pkg.script_sha256!==source.script_sha256||pkg.bundle_sha256!==source.bundle_sha256)throw Error('NATIVE_FROZEN_SOURCE_BINDING_MISMATCH');
  const files=pkg.files.map((file,index)=>({...pkg.manifest[index],content:Buffer.from(file.content_base64,'base64')}));
  assertImportGraph(files,snapshot,entry);
  for(const file of files){const target=path.join(snapshot,file.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,file.content,{flag:'wx'});}
  return {files:pkg.manifest,script_sha256:pkg.script_sha256,bundle_sha256:pkg.bundle_sha256};
}

function processEnvironment() {
  const names = ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'PLAYWRIGHT_BROWSERS_PATH'];
  return Object.fromEntries(names.flatMap(name => process.env[name] ? [[name, process.env[name]]] : []));
}

function mediaType(relative) {
  const extension = path.extname(relative).toLowerCase();
  return ({ '.png': ['screenshot', 'image/png'], '.webm': ['video', 'video/webm'], '.zip': ['trace', 'application/zip'], '.json': ['report', 'application/json'], '.log': ['log', 'text/plain'], '.mjs': ['script', 'text/javascript'], '.js': ['script', 'text/javascript'], '.ts': ['script', 'text/plain'] })[extension] || ['evidence', 'application/octet-stream'];
}

export async function collectArtifacts(root) {
  const artifacts = [];
  async function visit(directory) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      if (['.private', 'node_modules'].includes(item.name)) continue;
      const absolute = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw Error('NATIVE_ARTIFACT_SYMLINK_NOT_ALLOWED');
      if (item.isDirectory()) { await visit(absolute); continue; }
      if (!item.isFile() || item.name.endsWith('.tmp')) continue;
      const relative = posix(path.relative(root, absolute)), info = await fs.stat(absolute);
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(absolute)) hash.update(chunk);
      const [kind, mime_type] = mediaType(relative);
      artifacts.push({ id: digest(relative).slice(0, 24), relative_path: relative, bytes: info.size, sha256: hash.digest('hex'), kind: relative.startsWith('snapshot/') ? 'script' : kind, name: item.name, mime_type });
    }
  }
  await visit(root);
  return artifacts.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
}

/** Owns one isolated execution. This is an execution boundary, not a hostile-code sandbox. */
export async function executeNativeScript({ workspace, runDirectory, entry, purpose = 'case', caseId, baseUrl, storageState, browserExecutable, signal, timeoutMs = 180_000, onProgress, identity, frozenCaseContent, frozenSource }, { execute = runOwnedProcess, renderReplay, prepareRecorder = prepareWindowRecorder, finalizeEvidence = finalizeNativeEvidence } = {}) {
  const started_at = new Date().toISOString();
  const result = { entry, purpose, status: 'ERROR', error: null, started_at, finished_at: null, script_sha256: null, bundle_sha256: null, artifacts: [], tests: [], report: null };
  let root, privateDirectory, snapshot, manifest, created = false, dependencyLink, evidenceIdentity, observations = [];
  try {
    const imported=Boolean(frozenSource?.importedPackage);
    if ((!workspace && !frozenSource?.runDirectory&&!imported) || !runDirectory || !entry || !caseId || !/^[\w.-]{1,160}$/.test(caseId)) throw Error('NATIVE_EXECUTION_INPUT_INVALID');
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 1_800_000) throw Error('NATIVE_TIMEOUT_INVALID');
    root = path.resolve(runDirectory);await rejectSymlinkPath(root);
    if(imported){
      if(workspace||frozenSource.runDirectory||purpose!=='case')throw Error('NATIVE_EXECUTION_INPUT_INVALID');
      entry=scriptPath(entry);
      if(!/\.(?:mjs|js|ts)$/i.test(entry))throw Error('NATIVE_ENTRY_OUTSIDE_WORKSPACE');
    }else{
      workspace = path.resolve(frozenSource ? path.join(frozenSource.runDirectory, 'snapshot') : workspace);
      if (inside(workspace, root) || inside(root, workspace)) throw Error('NATIVE_RUN_DIRECTORY_MUST_BE_SEPARATE');
      await rejectSymlinkPath(workspace);workspace = await fs.realpath(workspace);
      const entryAbsolute = path.resolve(workspace, entry);
      if (!inside(workspace, entryAbsolute) || entryAbsolute === workspace || !/\.(?:mjs|js|ts)$/i.test(entry)) throw Error('NATIVE_ENTRY_OUTSIDE_WORKSPACE');
      entry = posix(path.relative(workspace, entryAbsolute));
    }
    result.entry = entry;
    await fs.mkdir(path.dirname(root), { recursive: true });
    await fs.mkdir(root); created = true;
    privateDirectory = path.join(root, '.private'); snapshot = path.join(root, 'snapshot');
    await fs.mkdir(privateDirectory, { mode: 0o700 }); await fs.mkdir(snapshot);
    manifest = imported ? await copyImportedSource(frozenSource,snapshot,entry,frozenCaseContent) : frozenSource ? await copyFrozenSource(frozenSource, snapshot, entry) : await snapshotSources(workspace, snapshot, entry);
    Object.assign(result, { script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256 });
    if (identity && frozenCaseContent && purpose === 'case') {
      for (const name of ['run_id','project_id','source_task_id','executed_case_id','executed_case_version','executed_content_sha256','executed_external_id'])
        if (identity[name] == null) throw Error('NATIVE_EVIDENCE_IDENTITY_INCOMPLETE');
      evidenceIdentity = { ...identity, candidate_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256, candidate_bundle_sha256: manifest.bundle_sha256 };
      Object.assign(result, { candidate_sha256: manifest.script_sha256, frozen_case_content: structuredClone(frozenCaseContent), evidence_status: 'INCOMPLETE' });
    }
    await atomicJson(path.join(root, 'source-manifest.json'), { ...manifest, entry, purpose, case_id: caseId, created_at: started_at, playwright_version: require('@playwright/test/package.json').version });
    if (evidenceIdentity) {
      // Diagnose frozen bytes before opening a browser. Never rewrite the source
      // or turn an unexecuted, unbound draft into a successful case.
      let mapping;
      try {
        mapping = entry.endsWith('.mjs') ? instrumentNativeSource(await fs.readFile(path.join(snapshot, entry), 'utf8'), entry,
          { entry: true, steps: frozenCaseContent.steps || [] }).mapping : { status: 'UNAVAILABLE', reason: 'NATIVE_EVIDENCE_REQUIRES_ESM_MJS' };
      } catch { mapping = { status: 'UNAVAILABLE', reason: 'NATIVE_EVIDENCE_SOURCE_NOT_PARSEABLE' }; }
      result.evidence_preflight = { ...mapping, business_execution_started: false };
      await atomicJson(path.join(root, 'evidence-preflight.json'), result.evidence_preflight);
      if (mapping.status !== 'BOUND') {
        result.evidence_mapping = mapping;
        result.evidence_errors = ['NATIVE_EVIDENCE_CONTRACT_UNBOUND'];
        throw Error('NATIVE_EVIDENCE_CONTRACT_UNBOUND');
      }
    }
    if (signal?.aborted) { result.status = 'CANCELLED'; result.error = 'NATIVE_CANCELLED_BEFORE_START'; return result; }
    let stateFile;
    if (storageState) {
      const state = typeof storageState === 'string' ? JSON.parse(await fs.readFile(storageState, 'utf8')) : structuredClone(storageState);
      if (!state || !Array.isArray(state.cookies) || !Array.isArray(state.origins)) throw Error('NATIVE_STORAGE_STATE_INVALID');
      stateFile = path.join(privateDirectory, 'storage-state.json');
      await fs.writeFile(stateFile, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    }
    dependencyLink = path.join(snapshot, 'node_modules');
    await fs.symlink(path.join(workbench, 'node_modules'), dependencyLink, process.platform === 'win32' ? 'junction' : 'dir');
    const reportPath = path.join(root, 'execution-report.json');
    const config = {
      testDir: snapshot, testMatch: null, grep: null, workers: 1, retries: 0, fullyParallel: false, forbidOnly: true,
      timeout: Math.min(timeoutMs, 120_000), globalTimeout: timeoutMs, expect: { timeout: 10_000 },
      outputDir: path.join(root, 'artifacts'), preserveOutput: 'always',
      reporter: [[path.join(here, 'reporter.mjs'), { outputFile: reportPath, caseId }]],
      use: { browserName: 'chromium', headless: false, video: 'on', trace: 'on', screenshot: 'on', baseURL: baseUrl || undefined, storageState: stateFile, launchOptions: browserExecutable ? { executablePath: browserExecutable } : {} },
    };
    const childEnv = { ...processEnvironment(), NO_COLOR: '1' };
    if (evidenceIdentity) {
      config.use.viewport = null;
      const evidenceConfigPath = path.join(privateDirectory, 'evidence-config.json');
      const recorderPrepared = await prepareRecorder().catch(() => null);
      await fs.writeFile(evidenceConfigPath, JSON.stringify({ runDirectory: root, snapshot, entry, files: manifest.files,
        identity: evidenceIdentity, caseContent: frozenCaseContent, timeoutMs, recorderPrepared }), { mode: 0o600 });
      childEnv.NATIVE_EVIDENCE_CONFIG = evidenceConfigPath;
      config['@playwright/test'] = { babelPlugins: [[path.join(here, 'evidence-plugin.cjs'), { run_id: identity.run_id }]] };
    }
    const configPath = path.join(privateDirectory, 'playwright.config.mjs');
    await fs.writeFile(configPath, `const config=${JSON.stringify(config)};\nconfig.testMatch=new RegExp(${JSON.stringify('(?:^|[/\\\\])' + escapeRe(entry).replaceAll('/', '[/\\\\]') + '$')});\nconfig.grep=new RegExp(${JSON.stringify(escapeRe(caseId))});\nexport default config;\n`);
    onProgress?.({ type: 'execution_started', case_id: caseId, script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256 });
    void diagnostics.record('browser','execution.started',{case_id:caseId,run_id:identity?.run_id,browser_executable:browserExecutable});
    if (result.evidence_preflight) result.evidence_preflight.business_execution_started = true;
    const child = await execute(process.execPath, [playwrightCli, 'test', '--config', configPath], {
      cwd: snapshot, env: childEnv, signal, timeoutMs,
      onStdoutLine: line => { if (line.startsWith('NATIVE_EXECUTION_EVENT ')) { try { onProgress?.(JSON.parse(line.slice(23))); } catch {} } },
      maxCaptureBytes: 1024 * 1024,
    });
    void diagnostics.record('browser','process.finished',{case_id:caseId,run_id:identity?.run_id,exit_code:child.exitCode,termination:child.termination,error:child.error,stderr:child.stderr},child.exitCode===0?'info':'error');
    await fs.writeFile(path.join(root, 'stdout.log'), child.stdout || '');
    await fs.writeFile(path.join(root, 'stderr.log'), child.stderr || '');
    result.report = await fs.readFile(reportPath, 'utf8').then(JSON.parse).catch(() => null);
    result.tests = result.report?.tests || [];
    if (child.pid && child.exitObserved === false && child.closeObserved === false) result.stop_unconfirmed = true;
    if (signal?.aborted || child.termination === 'cancelled') { result.status = 'CANCELLED'; result.error = 'NATIVE_EXECUTION_CANCELLED'; }
    else if (child.termination === 'timeout' || result.report?.status === 'timedout') { result.status = 'TIMED_OUT'; result.error = 'NATIVE_EXECUTION_TIMED_OUT'; }
    else if (child.error || child.termination || child.observerError || !result.report?.finished_at || child.outputComplete === false) { result.status = 'ERROR'; result.error = child.error || child.observerError?.code || child.termination || 'NATIVE_EXECUTION_REPORT_INCOMPLETE'; }
    else if (!result.tests.length) { result.status = 'ERROR'; result.error = 'NATIVE_CASE_NOT_EXECUTED'; }
    else if (result.tests.some(test => !test.title.includes(caseId) || test.status === 'skipped')) { result.status = 'FAILED'; result.error = 'NATIVE_CASE_SKIPPED_OR_MISMATCHED'; }
    else if (child.exitCode === 0 && result.report.status === 'passed' && result.tests.every(test => test.status === 'passed' && test.expected_status === 'passed')) result.status = 'PASSED';
    else { result.status = 'FAILED'; result.error = result.tests.flatMap(test => test.errors || []).join('\n').slice(0, 12000) || result.report.errors?.join('\n') || 'NATIVE_TEST_FAILED'; }
    await verifySnapshot(snapshot, manifest);
    if (evidenceIdentity && !result.stop_unconfirmed) {
      try { observations = await assembleNativeEvidence({ root, result, identity: evidenceIdentity, caseContent: frozenCaseContent, browserExecutable, ...(renderReplay ? { renderReplay } : {}) }); }
      catch (error) { result.evidence_status = 'INCOMPLETE'; result.evidence_errors = ['NATIVE_EVIDENCE_ASSEMBLY_FAILED: ' + errorText(error)]; }
    }
  } catch (error) { result.status = signal?.aborted ? 'CANCELLED' : 'ERROR'; result.error = errorText(error); }
  finally {
    if (dependencyLink) await fs.unlink(dependencyLink).catch(() => {});
    if (privateDirectory) await fs.rm(privateDirectory, { recursive: true, force: true }).catch(error => { result.status = 'ERROR'; result.error = `NATIVE_PRIVATE_INPUT_CLEANUP_FAILED: ${error.code}`; });
    result.finished_at = new Date().toISOString();
    if (created) {
      await atomicJson(path.join(root, 'execution-result.json'), { ...result, artifacts: undefined }).catch(() => {});
      try {
        result.artifacts = await collectArtifacts(root);
        if (evidenceIdentity) {
          try { finalizeEvidence(result, evidenceIdentity, observations); }
          catch { result.evidence_status = 'INCOMPLETE'; (result.evidence_errors ||= []).push('NATIVE_EVIDENCE_FINALIZATION_FAILED'); }
          await atomicJson(path.join(root, 'execution-result.json'), { ...result, artifacts: undefined });
          result.artifacts = await collectArtifacts(root);
        }
      }
      catch (error) {
        result.status = 'ERROR'; result.error = errorText(error);
        await atomicJson(path.join(root, 'execution-result.json'), { ...result, artifacts: undefined }).catch(() => {});
      }
    }
    onProgress?.({ type: 'execution_finished', status: result.status, error: result.error, case_id: caseId });
    void diagnostics.record('browser','execution.finished',{case_id:caseId,status:result.status,error:result.error},result.status==='PASSED'?'info':'warn');
  }
  return result;
}
