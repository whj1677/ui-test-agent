import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { APP_ROOT, readBuildInfo, dataDirectoryId } from '../src/build-info.mjs';
import { backupData } from '../src/data-maintenance.mjs';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { hash, uid } from '../src/common.mjs';

const run = promisify(execFile);
const versions = [
  { ref: '8101158a6b015feaf1c599a0a8c7a7d8681cdf38', version: '0.3.0' },
  { ref: 'd1e6fbb9d252f2d3b2ab5f7daa87f2a66783dfb3', version: '0.4.0-beta.1' },
];

async function inventory(directory, relative = '') {
  const files = {};
  for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = relative ? relative + '/' + entry.name : entry.name;
    assert.equal(entry.isSymbolicLink(), false, 'Test data must not contain links');
    if (entry.isDirectory()) Object.assign(files, await inventory(directory, name));
    else files[name] = hash(await fs.readFile(path.join(directory, name)));
  }
  return files;
}

async function restoreToNewDirectory(backup, destination) {
  const manifest = JSON.parse(await fs.readFile(path.join(backup, 'backup-manifest.json')));
  assert.deepEqual(
    await inventory(path.join(backup, 'data')),
    Object.fromEntries(manifest.files.map((file) => [file.file, file.sha256])),
  );
  await fs.mkdir(destination); // Refuse a pre-existing destination; never merge user tasks.
  await fs.cp(path.join(backup, 'data'), destination, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
}

async function oldRuntime(directory, ref) {
  const root = path.join(directory, 'old-runtime');
  const archive = path.join(directory, 'old-runtime.tar');
  await fs.mkdir(root);
  await run(
    'git',
    [
      'archive',
      '--format=tar',
      '--output',
      archive,
      ref,
      'src',
      'public',
      'vendor',
      'package.json',
      'package-lock.json',
    ],
    { cwd: APP_ROOT, windowsHide: true },
  );
  await run('tar', ['-xf', archive, '-C', root], { windowsHide: true });
  // Historical source is untouched. Shared, pinned local dependencies are explicitly NOT a clean OS.
  await fs.symlink(
    path.join(APP_ROOT, 'node_modules'),
    path.join(root, 'node_modules'),
    'junction',
  );
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json')));
  const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json')));
  for (const dependency of new Set([...Object.keys(metadata.dependencies), 'playwright-core'])) {
    const installed = JSON.parse(
      await fs.readFile(path.join(root, 'node_modules', dependency, 'package.json')),
    );
    assert.equal(installed.version, lock.packages['node_modules/' + dependency].version);
  }
  const load = (file) => import(pathToFileURL(path.join(root, 'src', file)).href);
  const [{ start: oldStart }, { DeepSeek: OldProvider }, { demoCases }, { planHash }] =
    await Promise.all([
      load('server.mjs'),
      load('deepseek.mjs'),
      load('demo.mjs'),
      load('plans.mjs'),
    ]);
  return {
    root,
    oldStart,
    OldProvider,
    demoCases,
    planHash,
    archive_sha256: hash(await fs.readFile(archive)),
  };
}

// These are deliberately injected storage states, not results of actual business/LLM testing.
async function seed(app, old) {
  const { baseline, plans } = old.demoCases();
  const ids = {};
  for (const name of ['failed', 'ready', 'dirty', 'interrupted']) {
    ids[name] = await app.store.create({
      name: 'SYNTHETIC UPGRADE ' + name,
      target: `http://${name}.upgrade.invalid/app`,
      filename: 'synthetic.json',
      baseline,
      sourceBytes: Buffer.from(JSON.stringify(baseline)),
    });
    await app.store.update(ids[name], (state) => {
      state.authorization.nonproduction = true;
      state.authorization.writes = true;
      state.status = 'READY';
      state.cases.forEach((record, index) => {
        record.reviewed = true;
        record.confirmations = structuredClone(baseline.cases[index].steps);
        record.plan = plans[index];
        record.plan_approved = true;
        record.approved_hash = old.planHash(plans[index]);
        record.status = 'READY';
      });
      if (name === 'ready') {
        Object.assign(state.cases[1], {
          reviewed: false,
          confirmations: [],
          plan: null,
          plan_approved: false,
          status: 'NEEDS_REVIEW',
        });
        delete state.cases[1].approved_hash;
      }
      if (name === 'dirty') {
        state.cases[1].status = 'INTERRUPTED';
        state.cases[1].cleanup_required = true;
      }
      if (name === 'interrupted') {
        state.status = 'RUNNING';
        state.cases[1].status = 'RUNNING';
      }
      app.store.event(state, 'SYNTHETIC_UPGRADE_FIXTURE', { source: 'STORAGE_TEST_ONLY' });
    });
  }
  const attempt = uid();
  await app.store.recordExecutionEvent(ids.failed, attempt, {
    type: 'SYNTHETIC_HISTORICAL_EVENT',
    case_id: baseline.cases[0].case_id,
  });
  const receipt = await app.store.fact(ids.failed, {
    id: attempt,
    case_id: baseline.cases[0].case_id,
    status: 'FAIL_ASSERTION',
    business_status: 'ASSERTION_MISMATCH',
    cleanup_status: 'NOT_REQUIRED',
    evidence_status: 'VERIFIED',
    actions: [],
    assertions: [],
    finished_at: new Date().toISOString(),
    note: 'Injected storage fixture; no business actions or model calls were performed.',
  });
  await app.store.update(ids.failed, (state) => {
    state.status = 'COMPLETED';
    state.cases[0].status = 'FAIL_ASSERTION';
    state.cases[0].attempts.push(receipt);
  });
  return { ids, baseline, receipt };
}

const json = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  return response.json();
};

for (const version of versions)
  test(`real ${version.version} ${version.ref.slice(0, 7)} backup, upgrade and rollback`, async (t) => {
    const directory = await fs.mkdtemp(path.join(APP_ROOT, 'validation', 'upgrade-'));
    const beforeData = path.join(directory, 'before-data');
    const newData = path.join(directory, 'new-data');
    const rollbackData = path.join(directory, 'rollback-data');
    const beforeBackup = path.join(directory, 'before-backup');
    const afterBackup = path.join(directory, 'after-backup');
    const record = {
      ref: version.ref,
      previous_version: version.version,
      checks: [],
      scope: 'Synthetic local upgrade; not clean Windows, real LLM or business acceptance',
    };
    const live = new Set();
    t.after(async () => {
      await Promise.all([...live].map((app) => app.close()));
      await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(record, null, 2));
      console.log(
        JSON.stringify({
          directory,
          ref: record.ref,
          checks: record.checks,
          current_build: record.current_build,
          preserved_source_files: Object.keys(record.original_inventory ?? {}).length,
        }),
      );
    });
    const stop = async (app) => {
      await app.close();
      live.delete(app);
    };
    const old = await oldRuntime(directory, version.ref);
    record.archive_sha256 = old.archive_sha256;
    const previous = await old.oldStart({
      port: 0,
      dataDir: beforeData,
      headless: true,
      provider: new old.OldProvider({ key: '' }),
    });
    live.add(previous);
    assert.equal((await json(previous.url + '/api/config')).version, version.version);
    const { ids, baseline, receipt } = await seed(previous, old);
    const beforeStates = Object.fromEntries(
      await Promise.all(
        Object.entries(ids).map(async ([name, id]) => [name, await previous.store.read(id)]),
      ),
    );
    const beforeFact = await previous.store.facts(ids.failed, receipt);

    await t.test(
      'live source cannot be backed up; stopped backup matches every original byte',
      async () => {
        await assert.rejects(backupData(beforeData, beforeBackup), {
          code: 'BACKUP_REQUIRES_STOP',
        });
        await assert.rejects(fs.access(beforeBackup), { code: 'ENOENT' });
        await stop(previous);
        record.original_inventory = await inventory(beforeData);
        await backupData(beforeData, beforeBackup);
        await restoreToNewDirectory(beforeBackup, newData);
        assert.deepEqual(await inventory(newData), record.original_inventory);
        await assert.rejects(restoreToNewDirectory(beforeBackup, newData), { code: 'EEXIST' });
        assert.deepEqual(await inventory(newData), record.original_inventory);
        record.checks.push('stopped backup and no-merge copy');
      },
    );

    const current = await start({
      port: 0,
      dataDir: newData,
      headless: true,
      provider: new DeepSeek({ key: '' }),
    });
    live.add(current);
    await t.test(
      'new runtime preserves original cases, confirmations, approval hashes and sealed history',
      async () => {
        const config = await json(current.url + '/api/config');
        assert.equal(config.build_id, (await readBuildInfo()).build_id);
        assert.equal(config.instance.data_directory_id, dataDirectoryId(newData));
        assert.equal(config.configured, false);
        record.current_build = config.build_id;
        for (const name of ['failed', 'ready', 'dirty'])
          assert.deepEqual(await current.store.read(ids[name]), beforeStates[name]);
        assert.deepEqual(await current.store.baseline(ids.ready), baseline);
        assert.deepEqual(await current.store.facts(ids.failed, receipt), beforeFact);
        const view = await json(current.url + '/api/tasks/' + ids.failed);
        assert.ok(JSON.stringify(view).includes('FAIL_ASSERTION'));
        const facts = await json(current.url + '/api/tasks/' + ids.failed + '/facts');
        assert.deepEqual(facts, [beforeFact]);
        record.checks.push('legacy state, approvals and sealed history preserved');
      },
    );

    await t.test(
      'interrupted mutation stays pending, cannot be replayed and adds only recovery state',
      async () => {
        const interrupted = await current.store.read(ids.interrupted);
        assert.equal(interrupted.status, 'INTERRUPTED');
        assert.equal(interrupted.cases[1].status, 'INTERRUPTED');
        assert.equal(interrupted.cases[1].cleanup_required, true);
        assert.deepEqual(interrupted.cases[1].attempts, []);
        assert.deepEqual(interrupted.events.slice(0, -1), beforeStates.interrupted.events);
        assert.equal(interrupted.events.at(-1).type, 'INTERRUPTED');
        assert.equal(current.controller.active, null);
        assert.equal(current.browser.authenticated, false);
        const after = await inventory(newData);
        for (const [file, digest] of Object.entries(record.original_inventory)) {
          if (file !== `tasks/${ids.interrupted}/state.json`)
            assert.equal(after[file], digest, file);
        }
        record.checks.push('interruption recovered once without replay or history changes');
      },
    );

    await t.test(
      'upgrade does not restore authentication or bypass same-site cleanup holds',
      async () => {
        const requested = await fetch(current.url + '/api/tasks/' + ids.ready + '/job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': current.csrf },
          body: JSON.stringify({ kind: 'run', case_ids: [baseline.cases[0].case_id] }),
        });
        assert.equal(requested.status, 409);
        assert.match(JSON.stringify(await requested.json()), /AUTH_REQUIRED/);
        for (const name of ['dirty', 'interrupted']) {
          const blocked = await current.store.create({
            name: 'new isolated same-site task',
            target: beforeStates[name].target,
            baseline,
          });
          await assert.rejects(
            current.controller.launch(blocked, 'run', [baseline.cases[0].case_id]),
            { code: 'SITE_CLEANUP_REQUIRED' },
          );
          assert.equal(current.controller.active, null);
          record.new_only_task = blocked;
        }
        assert.equal(
          (await current.store.cleanupBlockers('http://unrelated.upgrade.invalid/')).length,
          0,
        );
        record.checks.push('authentication required and persistent same-site hold enforced');
      },
    );

    await t.test(
      'new-version output is archived separately and never merged into old source',
      async () => {
        await stop(current);
        await backupData(newData, afterBackup);
        assert.deepEqual(await inventory(beforeData), record.original_inventory);
        const saved = await inventory(path.join(afterBackup, 'data'));
        assert.ok(saved[`tasks/${record.new_only_task}/state.json`]);
        await restoreToNewDirectory(beforeBackup, rollbackData);
        assert.deepEqual(await inventory(rollbackData), record.original_inventory);
        record.checks.push('new output archived separately; rollback uses pre-upgrade data');
      },
    );

    await t.test(
      'actual old runtime reopens its pre-upgrade backup, not the newer data structure',
      async () => {
        const rollback = await old.oldStart({
          port: 0,
          dataDir: rollbackData,
          headless: true,
          provider: new old.OldProvider({ key: '' }),
        });
        live.add(rollback);
        assert.equal((await json(rollback.url + '/api/config')).version, version.version);
        assert.equal((await json(rollback.url + '/api/config')).configured, false);
        const tasks = await json(rollback.url + '/api/tasks');
        assert.equal(tasks.length, Object.keys(ids).length);
        assert.equal(
          tasks.some((task) => task.id === record.new_only_task),
          false,
        );
        for (const name of ['failed', 'ready', 'dirty'])
          assert.deepEqual(await rollback.store.read(ids[name]), beforeStates[name]);
        assert.deepEqual(await rollback.store.facts(ids.failed, receipt), beforeFact);
        await stop(rollback);
        assert.deepEqual(await inventory(beforeData), record.original_inventory);
        assert.deepEqual(
          await inventory(path.join(beforeBackup, 'data')),
          record.original_inventory,
        );
        assert.deepEqual(await inventory(path.join(afterBackup, 'data')), await inventory(newData));
        record.checks.push('old runtime restored without rewriting original or upgraded records');
      },
    );
  });
