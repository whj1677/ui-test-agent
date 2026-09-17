import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { fail, hash, nonempty } from './common.mjs';
import { importedCaseEntry } from './case-entry-url.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function importCases(filename, bytes, sheet) {
  const ext = path.extname(filename).toLowerCase();
  if (!['.json', '.csv', '.xlsx', '.xlsm'].includes(ext)) fail('UNSUPPORTED_CASE_FILE');
  if (bytes.length > 12 * 1024 * 1024) fail('UPLOAD_TOO_LARGE');
  if (ext === '.json') {
    let parsed;
    try {
      parsed = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
    } catch {
      fail('INVALID_JSON');
    }
    if (Array.isArray(parsed.cases)) {
      validateBaseline(parsed);
      return parsed;
    }
  }
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-import-'));
  const input = path.join(tmp, 'input' + ext);
  await fs.writeFile(input, bytes);
  const args = [
    path.join(ROOT, 'vendor/manual-ui/portable-ui-workflow.mjs'),
    'import',
    '--project',
    path.join(tmp, 'project'),
    '--input',
    input,
    '--python',
    process.env.PYTHON || 'python',
  ];
  if (sheet) args.push('--sheet', sheet);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (b) => {
      if (output.length < 50000) output += b;
    });
    child.stderr.resume();
    const timer = setTimeout(() => {
      child.kill();
      reject(Object.assign(new Error('IMPORT_TIMEOUT'), { code: 'IMPORT_TIMEOUT' }));
    }, 30000);
    child.on('error', () => {
      clearTimeout(timer);
      reject(
        Object.assign(new Error('IMPORT_RUNTIME_MISSING'), { code: 'IMPORT_RUNTIME_MISSING' }),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        let e;
        try {
          e = JSON.parse(output.trim().split('\n').at(-1));
        } catch {}
        reject(
          Object.assign(new Error(e?.code || 'IMPORT_FAILED'), {
            code: e?.code || 'IMPORT_FAILED',
          }),
        );
      }
    });
  });
  const parsed = JSON.parse(
    await fs.readFile(path.join(tmp, 'project/cases/case-import.json'), 'utf8'),
  );
  validateBaseline(parsed);
  return parsed;
}
export function validateBaseline(b) {
  if (!Array.isArray(b.cases) || !b.cases.length || b.cases.length > 500)
    fail('CASE_COUNT_INVALID');
  const ids = new Set();
  for (const c of b.cases) {
    const entry = importedCaseEntry(c);
    if (entry !== undefined) c.page_entry_url = entry;
    if (!nonempty(c.case_id) || ids.has(c.case_id) || !Array.isArray(c.steps) || !c.steps.length)
      fail('CASE_SCHEMA_INVALID');
    ids.add(c.case_id);
    const steps = new Set();
    for (const s of c.steps) {
      if (!nonempty(s.step_id) || steps.has(s.step_id) || !nonempty(s.action))
        fail('STEP_SCHEMA_INVALID');
      steps.add(s.step_id);
    }
  }
}
export function mechanicalIssues(c) {
  const issues = [];
  if (c.source_side && c.source_side !== 'ui')
    issues.push({ code: 'API_CASE', message: '该用例属于接口测试，本Agent只执行Web UI。' });
  for (const s of c.steps) {
    if (!nonempty(s.expected))
      issues.push({
        code: 'EXPECTED_MISSING',
        step_id: s.step_id,
        message: '缺少可判断的预期结果。',
      });
    const text = (c.title ?? '') + ' ' + s.action;
    const precision = /超过\s*(\d+)\s*位小数/.exec(text),
      decimals = [...s.action.matchAll(/\b\d+\.(\d+)\b/g)];
    if (precision && decimals.length && decimals.every((m) => m[1].length <= Number(precision[1])))
      issues.push({
        code: 'DECIMAL_CONTRADICTION',
        step_id: s.step_id,
        message: `描述要求超过${precision[1]}位小数，提供的数字均未超过，请核对。`,
      });
    if (/按需求确认|待确认|待明确/.test(s.expected ?? ''))
      issues.push({
        code: 'EXPECTED_AMBIGUOUS',
        step_id: s.step_id,
        message: '预期包含待确认业务规则。',
      });
  }
  for (const issue of c.import_issues ?? [])
    if (!String(issue.code).includes('CLICK'))
      issues.push({ code: issue.code, message: '原始步骤映射待复核，不能自动改写。' });
  return issues;
}
