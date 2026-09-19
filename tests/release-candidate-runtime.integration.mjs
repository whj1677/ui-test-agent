import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ROOT, readBuildInfo } from '../src/build-info.mjs';
import { hash } from '../src/common.mjs';

// Uses only a fresh unpacked validation candidate. Dependencies may resolve from
// the checkout ancestor: this is not a clean installation or a model test.
test('unpacked candidate serves its own bytes and closes isolated empty instances', async (t) => {
  assert.ok(process.argv[2], 'Unpacked validation candidate directory required');
  const root = await fs.realpath(path.resolve(process.argv[2]));
  const validation = await fs.realpath(path.join(APP_ROOT, 'validation'));
  const relative = path.relative(validation, root);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  const output = await fs.mkdtemp(path.join(validation, 'candidate-runtime-'));
  const records = [];
  let modelCalls = 0;
  const blockedProvider = {
    configured: () => false,
    json: async () => {
      modelCalls++;
      throw Error('NO_MODEL_NETWORK_ALLOWED');
    },
  };
  const moduleAt = (name) => import(pathToFileURL(path.join(root, 'src', name)).href);
  const { verifyCandidate } = await moduleAt('distribution.mjs');
  const { readBuildInfo: packageBuild, dataDirectoryId } = await moduleAt('build-info.mjs');
  const { start } = await moduleAt('server.mjs');
  const build = await packageBuild();
  const manifestBytes = await fs.readFile(path.join(root, 'release-manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  t.after(async () => {
    await fs.writeFile(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          scope:
            'Unpacked local HTTP identity/configuration/closure only; no target browser or real model; shared host dependencies, not clean Windows',
          candidate: root,
          build_id: build.build_id,
          manifest_sha256: hash(manifestBytes),
          records,
          model_calls: modelCalls,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        artifact: output,
        build_id: build.build_id,
        checked_modes: records.length,
        model_calls: modelCalls,
      }),
    );
  });
  assert.equal(build.build_id, (await readBuildInfo(APP_ROOT)).build_id);
  await verifyCandidate(root, manifest, build);
  const delivered = [];
  async function inventory(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = prefix + entry.name;
      assert.equal(entry.isSymbolicLink(), false, 'Unexpected package link: ' + file);
      if (entry.isDirectory()) await inventory(path.join(directory, entry.name), file + '/');
      else {
        assert.ok(entry.isFile(), file);
        delivered.push(file);
      }
    }
  }
  await inventory(root);
  assert.deepEqual(
    delivered.sort(),
    [...manifest.files.map((e) => e.file), 'release-manifest.json'].sort(),
  );
  for (const required of ['ui-patterns.mjs', 'ui-experience.mjs', 'ui-experience-evidence.mjs'])
    assert.ok(manifest.files.some((e) => e.file === 'src/' + required));
  for (const file of delivered) {
    assert.doesNotMatch(
      file,
      /(^|\/)(data|work|validation|node_modules|\.git|\.env[^/]*|\.browsers|\.python-venv)(\/|$)/,
    );
    const text = await fs.readFile(path.join(root, file), 'utf8');
    assert.equal(
      /sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
        text,
      ),
      false,
      'Credential-pattern match in file: ' + file,
    );
  }
  for (const mode of ['observe', 'off', 'assist']) {
    await t.test('isolated ' + mode + ' configuration and shutdown', async () => {
      const dataDir = path.join(output, mode);
      let app;
      try {
        app = await start({
          port: 0,
          dataDir,
          headless: true,
          provider: blockedProvider,
          experienceMode: mode,
        });
        const get = (route) => fetch(app.url + route, { signal: AbortSignal.timeout(5000) });
        const configResponse = await get('/api/config');
        assert.equal(configResponse.status, 200);
        const config = await configResponse.json();
        assert.equal(config.build_id, build.build_id);
        assert.equal(config.instance.data_directory_id, dataDirectoryId(dataDir));
        assert.equal(config.configured, false);
        assert.equal(config.active, null);
        assert.equal(config.ui_experience_mode, mode);
        assert.equal(app.controller.experience.mode, mode);
        assert.equal((await app.store.list()).length, 0);
        for (const [route, file] of [
          ['/', 'public/index.html'],
          ['/app.js', 'public/app.js'],
          ['/evidence-view.js', 'public/evidence-view.js'],
          ['/evidence.css', 'public/evidence.css'],
          ['/styles.css', 'public/styles.css'],
        ]) {
          const response = await get(route);
          assert.equal(response.status, 200);
          let expected = await fs.readFile(path.join(root, file));
          if (route === '/') {
            const template = expected.toString('utf8');
            assert.equal(template.split('__CSRF__').length - 1, 1);
            expected = Buffer.from(template.replace('__CSRF__', app.csrf));
          }
          assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(expected));
        }
        assert.equal(modelCalls, 0);
      } finally {
        await app?.close();
      }
      assert.equal(app.server.listening, false);
      await assert.rejects(fs.access(path.join(dataDir, '.writer.lock')), { code: 'ENOENT' });
      await assert.rejects(fs.access(path.join(dataDir, 'ui-experience.json')), { code: 'ENOENT' });
      await assert.rejects(fetch(app.url + '/api/config', { signal: AbortSignal.timeout(1000) }));
      records.push({
        mode,
        build_id: build.build_id,
        data_directory_id: dataDirectoryId(dataDir),
        closed: true,
        empty_task_store: true,
        model_calls: modelCalls,
      });
    });
  }
  assert.equal(records.length, 3);
  assert.equal(modelCalls, 0);
  await verifyCandidate(root, manifest);
});
