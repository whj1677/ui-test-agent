import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const taskRoot = path.dirname(fileURLToPath(import.meta.url));
const pilotRoot = path.dirname(taskRoot);
const repoRoot = path.dirname(pilotRoot);
const [author, claudeExe, round = 'revision-1'] = process.argv.slice(2);
if (!author || !claudeExe) throw new Error('USAGE: node run-author.mjs <author-dir> <claude-exe> <revision-1|correction-1>');
if (!['revision-1', 'correction-1'].includes(round)) throw new Error('ROUND_DENIED');

const privateRoot = path.join(pilotRoot, 'private', 'revision-s02');
await fs.mkdir(privateRoot, { recursive: true });
const journal = path.join(privateRoot, `${round}-session.jsonl`);
try {
  await fs.access(journal);
  throw new Error('ROUND_ALREADY_ATTEMPTED');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (round === 'correction-1') await fs.access(path.join(privateRoot, 'revision-1-result.json'));

const settings = JSON.parse(await fs.readFile(path.join(process.env.USERPROFILE, '.claude', 'settings.json'), 'utf8'));
if (settings.env?.ANTHROPIC_MODEL !== 'deepseek-v4-pro' || settings.env?.ANTHROPIC_BASE_URL !== 'https://api.deepseek.com/anthropic') {
  throw new Error('CONFIG_CHANGED');
}

const official = await fs.readFile(path.join(pilotRoot, '.claude', 'agents', 'playwright-test-generator.md'), 'utf8');
const normalCase = await fs.readFile(path.join(author, 'normal-case.json'), 'utf8');
const candidate = await fs.readFile(path.join(author, 'tests', 'sorting.spec.ts'), 'utf8');
const feedbackFile = round === 'revision-1' ? 'feedback.md' : 'correction-feedback.md';
const feedback = await fs.readFile(path.join(taskRoot, feedbackFile), 'utf8');
const prompt = [
  'Use the official Playwright Test Generator instructions below. Revise exactly ONE existing candidate for the supplied original normal case. Do not invent scenarios or business expectations.',
  'You have only the gated official Playwright tools. No file reading, shell, arbitrary evaluate, other pages, source inspection, oracle, reference tests, fault implementation, healer, or workaround.',
  official,
  'Original normal case (unchanged source of truth):', normalCase,
  'Your own existing candidate:', candidate,
  'Authorized normal-semantic feedback for this round:', feedback,
  'Environment: seedFile MUST be seed.spec.ts; output MUST be tests/sorting.spec.ts. Run generator_setup_page once, observe only the normal page, execute and verify the original steps live, read the generator log, then write the revised test once.',
  'Preserve every original obligation, literal text, exact positions, units, action order, and assertion timing. Final reusable test must navigate using process.env.PILOT_ENTRY_URL || the original normal URL. No branch by entry, case ID, or fault flag. No retries, skip, fixme, expected failure, swallowed exceptions, or auto-adjusted expectations.',
  'Stop after writing one candidate. In the final response report in Chinese what changed and any unsupported item. Do not claim human approval, formal regression, or product autonomy.'
].join('\n\n');

const toolLog = path.join(privateRoot, `${round}-tools.jsonl`);
const mcp = { mcpServers: { 'playwright-test': { command: process.execPath, args: [path.join(pilotRoot, 'mcp-gate.mjs'), author, path.join(pilotRoot, 'node_modules', 'playwright', 'cli.js'), 'http://localhost:4198/probe/s1', toolLog] } } };
const mcpPath = path.join(author, `${round}-mcp.local.json`);
await fs.writeFile(mcpPath, JSON.stringify(mcp, null, 2));

const env = { ...process.env, ...settings.env, CLAUDE_CONFIG_DIR: path.join(author, 'isolated-claude-config'), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };
delete env.CLAUDECODE;
if (!env.ANTHROPIC_API_KEY && env.ANTHROPIC_AUTH_TOKEN) env.ANTHROPIC_API_KEY = env.ANTHROPIC_AUTH_TOKEN;
const args = ['--bare', '--print', '--verbose', '--output-format', 'stream-json', '--no-session-persistence', '--disable-slash-commands', '--no-chrome', '--setting-sources', 'project', '--strict-mcp-config', '--mcp-config', mcpPath, '--tools', '', '--allowedTools', 'mcp__playwright-test__*', '--permission-mode', 'dontAsk', '--model', 'deepseek-v4-pro'];

const started = Date.now();
await fs.writeFile(journal, '');
const output = await fs.open(journal, 'a');
const errors = await fs.open(path.join(privateRoot, `${round}.stderr.log`), 'a');
const child = spawn(claudeExe, args, { cwd: author, env, stdio: ['pipe', output.fd, errors.fd], windowsHide: true });
child.stdin.end(prompt);
await fs.writeFile(path.join(privateRoot, `${round}-launch.json`), JSON.stringify({
  started_at: new Date(started).toISOString(), pid: child.pid, tool: 'Claude Code', tool_version: '2.1.218', provider: 'DeepSeek Anthropic-compatible endpoint', model: 'deepseek-v4-pro', round,
  prompt_sha256: createHash('sha256').update(prompt).digest('hex'), candidate_input_sha256: createHash('sha256').update(candidate).digest('hex'), normal_case_sha256: createHash('sha256').update(normalCase).digest('hex'), deadline: new Date(started + 1200000).toISOString()
}, null, 2));
console.log(JSON.stringify({ pid: child.pid, started_at: new Date(started).toISOString(), round }));

let timedOut = false;
const timer = setTimeout(() => { timedOut = true; child.kill(); }, 1200000);
const code = await new Promise(resolve => { child.once('exit', resolve); child.once('error', () => resolve(-1)); });
clearTimeout(timer);
await output.close(); await errors.close();
const revised = await fs.readFile(path.join(author, 'tests', 'sorting.spec.ts'), 'utf8');
const result = { exit_code: code, timed_out: timedOut, elapsed_ms: Date.now() - started, finished_at: new Date().toISOString(), output_sha256: createHash('sha256').update(revised).digest('hex'), human_approved: false, formal_regression_executed: false };
await fs.writeFile(path.join(privateRoot, `${round}-result.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
process.exitCode = code ?? 1;
