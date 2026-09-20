import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startEngineeringFixture } from './engineering-fixture/serve.mjs';

const taskRoot = path.dirname(fileURLToPath(import.meta.url));
const pilotRoot = path.dirname(taskRoot);
const privateRoot = path.join(pilotRoot, 'private', 'revision-s02', 'engineering');
await fs.mkdir(privateRoot, { recursive: true });
const cli = path.join(pilotRoot, 'node_modules', 'playwright', 'cli.js');
const config = path.join(taskRoot, 'playwright.config.ts');

async function run(name, entry) {
  const report = path.join(privateRoot, `${name}.json`);
  const output = path.join(privateRoot, name);
  const env = { ...process.env, PILOT_ENTRY_URL: entry, PILOT_OUTPUT_DIR: output, PLAYWRIGHT_JSON_OUTPUT_FILE: report };
  const started = Date.now();
  const child = spawn(process.execPath, [cli, 'test', '--config', config], { cwd: pilotRoot, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  const json = JSON.parse(await fs.readFile(report, 'utf8'));
  return { name, code, elapsed_ms: Date.now() - started, report, output, stdout, stderr, json };
}

function allSteps(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (typeof value.title === 'string' && /^S0[1-4]$/.test(value.title)) result.push({ title: value.title, error: value.error?.message || '' });
  for (const child of Array.isArray(value) ? value : Object.values(value)) allSteps(child, result);
  return result;
}

function summarize(normal, extra) {
  const extraText = JSON.stringify(extra.json).replace(/\\u001b\[[0-9;]*m/g, '');
  const steps = allSteps(extra.json);
  return {
    normal: { exit_code: normal.code, elapsed_ms: normal.elapsed_ms, expected: 'pass' },
    extra_row: { exit_code: extra.code, elapsed_ms: extra.elapsed_ms, expected: 'fail in S02' },
    extra_row_has_expected_count_3_actual_4: /Expected:\s*3[\s\S]*Received:\s*4/.test(extraText),
    s02_error_present: steps.some((step) => step.title === 'S02' && step.error),
    s03_started: steps.some((step) => step.title === 'S03'),
    model_calls: 0,
    retries: 0,
  };
}

async function finish(normal, extra) {
  const summary = summarize(normal, extra);
  await fs.writeFile(path.join(privateRoot, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (normal.code !== 0 || extra.code === 0 || !summary.extra_row_has_expected_count_3_actual_4 || !summary.s02_error_present || summary.s03_started) process.exitCode = 1;
}

if (process.argv.includes('--verify-existing')) {
  const load = async (name) => {
    const json = JSON.parse(await fs.readFile(path.join(privateRoot, `${name}.json`), 'utf8'));
    return { code: json.stats?.unexpected ? 1 : 0, elapsed_ms: Math.round(json.stats?.duration || 0), json };
  };
  await finish(await load('normal'), await load('extra-row'));
} else {
  const fixture = await startEngineeringFixture(0);
  try {
    await finish(await run('normal', `${fixture.baseUrl}/normal`), await run('extra-row', `${fixture.baseUrl}/extra`));
  } finally {
    await fixture.close();
  }
}
