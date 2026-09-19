import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DeepSeek } from '../src/deepseek.mjs';
import { CredentialStore } from '../src/credential-store.mjs';
import { start } from '../src/server.mjs';
import { importCases } from '../src/importer.mjs';
import { suggestObligations } from '../src/plans.mjs';
import { publicError } from '../src/common.mjs';
import { startSyntheticLoginFixture } from './synthetic-login.mjs';
import { startVerifiedContrastFixture } from './contrast-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonFile = async (name) => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
export function callBudget({ maxCalls = 300, maxMinutes = 45, clock = Date.now } = {}) {
  if (
    !Number.isInteger(maxCalls) ||
    maxCalls < 1 ||
    maxCalls > 900 ||
    !Number.isFinite(maxMinutes) ||
    maxMinutes <= 0 ||
    maxMinutes > 90
  )
    throw Error('INVALID_ROUND_BUDGET');
  const started = clock();
  let calls = 0;
  return {
    snapshot: () => ({
      calls,
      max_calls: maxCalls,
      started_at: new Date(started).toISOString(),
      elapsed_ms: clock() - started,
      max_ms: maxMinutes * 60000,
    }),
    take() {
      if (calls >= maxCalls || clock() - started >= maxMinutes * 60000)
        throw Object.assign(new Error('ROUND_BUDGET_EXHAUSTED'), {
          code: 'ROUND_BUDGET_EXHAUSTED',
        });
      calls++;
    },
    expired: () => clock() - started >= maxMinutes * 60000,
  };
}

export async function runLab({
  realModel = false,
  suite = 'smoke',
  maxCalls = 300,
  maxMinutes = 45,
  modelProvider,
} = {}) {
  if (!['smoke', 'all'].includes(suite)) throw Error('INVALID_SUITE');
  const budget = callBudget({ maxCalls, maxMinutes });
  const manifest = await jsonFile('expanded-lab/manifest.json');
  for (const item of manifest.files) {
    if (
      !/^(?:manual-lab|expanded-lab)\/[A-Za-z0-9./_-]+$/.test(item.path) ||
      item.path.includes('..')
    )
      throw Error('INVALID_MANIFEST');
    const bytes = await fs.readFile(path.join(root, item.path));
    if (createHash('sha256').update(bytes).digest('hex') !== item.sha256)
      throw Error('FREEZE_MISMATCH');
  }
  const valid = (await jsonFile('manual-lab/cases/01-valid.json')).cases;
  const groups =
    suite === 'smoke'
      ? [{ name: 'smoke', kind: 'test', cases: valid.slice(0, 3) }]
      : [
          {
            name: 'readonly',
            kind: 'test',
            cases: [
              ...valid.slice(0, 12),
              ...(await jsonFile('manual-lab/cases/03-known-defects.json')).cases,
            ],
          },
          {
            name: 'review',
            kind: 'review',
            cases: (await jsonFile('manual-lab/cases/02-needs-review.json')).cases,
          },
          {
            name: 'contrast',
            kind: 'test',
            cases: (await jsonFile('expanded-lab/cases.json')).cases,
          },
          { name: 'writes-prepare-only', kind: 'prepare', cases: valid.slice(12) },
        ];
  if (!realModel)
    return {
      state: 'PREFLIGHT_ONLY',
      cases: groups.reduce((n, g) => n + g.cases.length, 0),
      frozen_files: manifest.files.length,
      model_calls: 0,
    };
  // In-process injection is for engineering tests only; CLI has no provider/URL override.
  const provider = modelProvider ?? new DeepSeek();
  if (provider.baseURL !== 'https://api.deepseek.com') throw Error('OFFICIAL_PROVIDER_REQUIRED');
  let app, lab, contrast, stopTimer;
  try {
    if (!provider.configured()) {
      const vault = new CredentialStore(
        process.env.UI_AGENT_CREDENTIAL_DIR || path.join(root, 'data/v02'),
      );
      const restored = await vault.load();
      if (restored) provider.configure(restored);
    }
    if (!provider.configured())
      throw Object.assign(new Error('LOCAL_SAVED_KEY_REQUIRED'), {
        code: 'LOCAL_SAVED_KEY_REQUIRED',
      });
    const originalJson = provider.json.bind(provider);
    let persistBudget = async () => {};
    provider.json = async (...args) => {
      budget.take();
      await persistBudget();
      return originalJson(...args);
    };
    const outputRoot = path.join(root, 'validation/autonomous');
    await fs.mkdir(outputRoot, { recursive: true });
    const directory = await fs.mkdtemp(path.join(outputRoot, 'round-'));
    const ledger = {
      suite,
      model_mode: modelProvider ? 'ENGINEERING_INJECTED' : 'OFFICIAL_DEEPSEEK_API',
      budget: budget.snapshot(),
      tasks: [],
      acceptance: 'NOT_ESTABLISHED',
    };
    const save = async () => {
      ledger.budget = budget.snapshot();
      await fs.writeFile(path.join(directory, 'round.json'), JSON.stringify(ledger, null, 2));
    };
    persistBudget = save;
    await save();
    app = await start({
      port: 0,
      dataDir: path.join(directory, 'product-data'),
      headless: true,
      provider,
    });
    // The frozen original preconditions explicitly name 4196. Do not silently
    // change that environment while claiming the original cases were exercised.
    lab = await startSyntheticLoginFixture({ port: 4196, reuseVerified: true });
    ledger.fixture = {
      url: lab.url,
      reused_verified_static_server: lab.reused,
      browser_data: 'fresh_isolated',
    };
    if (suite === 'all') {
      contrast = await startVerifiedContrastFixture();
      ledger.contrast_fixture = {
        url: contrast.url,
        reused_verified_static_server: contrast.reused,
      };
    }
    stopTimer = setInterval(() => {
      if (budget.expired() && app.controller.active) app.controller.active.abort.abort();
    }, 250);
    stopTimer.unref();
    try {
      for (const group of groups) {
        if (budget.expired() || budget.snapshot().calls >= maxCalls) break;
        const target = (group.name === 'contrast' ? contrast.url : lab.url) + '/';
        const bytes = Buffer.from(
          JSON.stringify({
            schema_version: 'case-import/v1',
            case_count: group.cases.length,
            cases: group.cases,
          }),
        );
        const baseline = await importCases('synthetic.json', bytes);
        const id = await app.store.create({
          name: `Autonomous ${group.name}`,
          target,
          baseline,
          filename: 'synthetic.json',
          sourceBytes: bytes,
        });
        await app.controller.configure(id, {
          nonproduction: true,
          writes: group.kind === 'prepare',
          readOnlyEndpoints: [],
        });
        if (group.kind !== 'review')
          for (const c of group.cases)
            await app.controller.confirmCase(id, c.case_id, {
              steps: suggestObligations(c.steps),
              note: '冻结合成用例，不提供定位或计划。',
            });
        const task = await app.store.read(id);
        if (group.kind !== 'review') {
          await app.browser.open(task);
          if (group.name === 'contrast') {
            await contrast.verify();
            // This byte-verified synthetic fixture explicitly has no login.
            await app.browser.loginPage
              .getByRole('heading', { name: '运营总览', exact: true })
              .waitFor();
            await app.controller.authenticate(id, {
              kind: 'role',
              role: 'heading',
              name: '运营总览',
              exact: true,
            });
          } else {
            const marker = await lab.enter(app.browser, task);
            await app.controller.authenticate(id, marker);
          }
        }
        ledger.tasks.push({
          id,
          group: group.name,
          case_ids: group.cases.map((c) => c.case_id),
          phase: group.kind,
          started_at: new Date().toISOString(),
        });
        await save();
        await app.controller.launch(
          id,
          group.kind,
          group.cases.map((c) => c.case_id),
        );
        await app.controller.active.finished;
        const state = await app.store.read(id);
        Object.assign(ledger.tasks.at(-1), {
          finished_at: new Date().toISOString(),
          results: state.cases.map((c) => ({
            case_id: c.case_id,
            status: c.status,
            reason: c.mapping_reason,
            attempts: c.attempts.length,
          })),
        });
        await save();
        console.log(
          JSON.stringify({
            group: group.name,
            calls: budget.snapshot().calls,
            results: ledger.tasks.at(-1).results,
          }),
        );
      }
    } finally {
      await save();
    }
    return { state: 'EXECUTION_RECORDED_NOT_ACCEPTANCE', directory, ...ledger };
  } finally {
    clearInterval(stopTimer);
    if (app) await app.close();
    else await provider.close();
    await lab?.close();
    await contrast?.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((a) => a !== '--real-model' && !/^--(?:suite|calls|minutes)=/.test(a)))
      throw Error('INVALID_ARGUMENT');
    const option = (key, fallback) =>
      args.find((a) => a.startsWith('--' + key + '='))?.split('=')[1] ?? fallback;
    console.log(
      JSON.stringify(
        await runLab({
          realModel: args.includes('--real-model'),
          suite: option('suite', 'smoke'),
          maxCalls: Number(option('calls', 300)),
          maxMinutes: Number(option('minutes', 45)),
        }),
      ),
    );
  } catch (e) {
    console.error(publicError(e));
    process.exitCode = 1;
  }
}
