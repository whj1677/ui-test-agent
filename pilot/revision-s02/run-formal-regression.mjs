import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startHeldoutLab } from '../../heldout-lab/serve.mjs';

const taskRoot = path.dirname(fileURLToPath(import.meta.url));
const pilotRoot = path.dirname(taskRoot);
const repoRoot = path.dirname(pilotRoot);
const privateRoot = path.join(pilotRoot, 'private', 'revision-s02', 'formal-regression');
const candidate = path.join(taskRoot, 'tests', 'sorting.spec.ts');
const expectedCandidateSha = '280a787546aabdd87570838932663a5dc254aee5e0c329be3a13294e9a18079a';
const cli = path.join(pilotRoot, 'node_modules', 'playwright', 'cli.js');
const config = path.join(taskRoot, 'playwright.config.ts');
const order = [
  { name: 'normal-1', kind: 'normal', entry: 'http://localhost:4198/probe/s1' },
  { name: 'normal-2', kind: 'normal', entry: 'http://localhost:4198/probe/s1' },
  { name: 'normal-3', kind: 'normal', entry: 'http://localhost:4198/probe/s1' },
  { name: 'fault-1', kind: 'fault', entry: 'http://localhost:4198/probe/s2' },
  { name: 'fault-2', kind: 'fault', entry: 'http://localhost:4198/probe/s2' },
  { name: 'fault-3', kind: 'fault', entry: 'http://localhost:4198/probe/s2' },
];

const shaFile = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');
function collect(value, key, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (!Array.isArray(value) && typeof value[key] === 'string') result.push(value[key]);
  for (const child of Array.isArray(value) ? value : Object.values(value)) collect(child, key, result);
  return result;
}
function stepFacts(json) {
  const steps = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && typeof value.title === 'string' && /^S0[1-4]$/.test(value.title)) {
      steps.push({ title: value.title, error: stripAnsi(value.error?.message || '') });
    }
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child);
  };
  visit(json);
  return steps;
}
async function listFiles(root) {
  const result = [];
  for (const item of await fs.readdir(root, { withFileTypes: true })) {
    const full = path.join(root, item.name);
    if (item.isDirectory()) result.push(...await listFiles(full)); else result.push(full);
  }
  return result;
}
async function run(item) {
  const runRoot = path.join(privateRoot, item.name);
  const outputDir = path.join(runRoot, 'artifacts');
  const report = path.join(runRoot, 'report.json');
  await fs.mkdir(runRoot, { recursive: true });
  const beforeSha = await shaFile(candidate);
  if (beforeSha !== expectedCandidateSha) throw new Error(`CANDIDATE_HASH_MISMATCH_BEFORE_${item.name}`);
  const env = { ...process.env, PILOT_ENTRY_URL: item.entry, PILOT_OUTPUT_DIR: outputDir, PLAYWRIGHT_JSON_OUTPUT_FILE: report };
  const started = Date.now();
  const child = spawn(process.execPath, [cli, 'test', '--config', config], { cwd: pilotRoot, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve) => child.once('exit', resolve));
  const elapsedMs = Date.now() - started;
  await fs.writeFile(path.join(runRoot, 'console.txt'), stdout + stderr);
  const afterSha = await shaFile(candidate);
  const json = JSON.parse(await fs.readFile(report, 'utf8'));
  const steps = stepFacts(json);
  const errors = stripAnsi(collect(json, 'message').join('\n'));
  const normalComplete = item.kind === 'normal' && exitCode === 0 && json.stats?.expected === 1 && json.stats?.unexpected === 0 && ['S01','S02','S03','S04'].every((step) => steps.some((x) => x.title === step && !x.error));
  const faultSignature = item.kind === 'fault' && exitCode === 1 && json.stats?.unexpected === 1
    && steps.some((x) => x.title === 'S03' && x.error)
    && !steps.some((x) => x.title === 'S04')
    && /Expected(?: string)?:\s*"H111"/.test(errors)
    && /Received(?: string)?:\s*"H106"/.test(errors)
    && /sorting\.spec\.ts:101:\d+/.test(errors)
    && !/TimeoutError|strict mode violation|未找到表头列|ERR_CONNECTION|net::/.test(errors);
  const files = await listFiles(runRoot);
  const media = [];
  for (const file of files.filter((x) => /\.(zip|png|webm)$/i.test(x))) media.push({ file: path.relative(runRoot, file).replaceAll('\\','/'), sha256: await shaFile(file), bytes: (await fs.stat(file)).size });
  return {
    name: item.name, kind: item.kind, entry: item.entry, exit_code: exitCode, elapsed_ms: elapsedMs,
    playwright_duration_ms: Math.round(json.stats?.duration || 0), expected: json.stats?.expected, unexpected: json.stats?.unexpected,
    steps: [...new Map(steps.map((x) => [x.title, x])).values()], normal_complete: normalComplete, specified_fault_detected: faultSignature,
    s04_executed: steps.some((x) => x.title === 'S04'), candidate_sha_before: beforeSha, candidate_sha_after: afterSha,
    model_calls: 0, retries: 0, healer: false, media,
  };
}

await fs.mkdir(privateRoot, { recursive: true });
const manifest = path.join(privateRoot, 'summary.json');
try { await fs.access(manifest); throw new Error('FORMAL_REGRESSION_ALREADY_EXECUTED'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const lab = await startHeldoutLab(4198);
const suiteStarted = Date.now();
const results = [];
let stoppedReason = '';
try {
  for (const item of order) {
    const result = await run(item);
    results.push(result);
    console.log(JSON.stringify({ name: result.name, exit_code: result.exit_code, normal_complete: result.normal_complete, specified_fault_detected: result.specified_fault_detected, elapsed_ms: result.elapsed_ms }));
    if ((item.kind === 'normal' && !result.normal_complete) || (item.kind === 'fault' && !result.specified_fault_detected) || result.candidate_sha_after !== expectedCandidateSha) {
      stoppedReason = `UNEXPECTED_RESULT_${item.name}`;
      break;
    }
  }
} finally {
  await lab.close();
}
const summary = {
  schema: 'sorting-formal-regression/v1', fixed_order: order.map((x) => x.name), candidate_sha256: expectedCandidateSha,
  started_at: new Date(suiteStarted).toISOString(), finished_at: new Date().toISOString(), elapsed_ms: Date.now() - suiteStarted,
  model_calls: 0, retries: 0, healer: false, stopped_reason: stoppedReason || null, results,
  counts: { normal_complete: results.filter((x) => x.normal_complete).length, specified_fault_detected: results.filter((x) => x.specified_fault_detected).length, technical_failures: results.filter((x) => x.kind === 'fault' && x.exit_code !== 0 && !x.specified_fault_detected).length },
};
await fs.writeFile(manifest, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.counts));
if (results.length !== 6 || summary.counts.normal_complete !== 3 || summary.counts.specified_fault_detected !== 3 || summary.counts.technical_failures !== 0) process.exitCode = 1;
