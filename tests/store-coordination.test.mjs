import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { demoCases } from '../src/demo.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-store-coordination-'));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(root).startsWith('ui-store-coordination-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new Store(root);
  await store.init();
  const create = () =>
    store.create({ name: 'synthetic', target: 'http://localhost', baseline: demoCases().baseline });
  const id = await create();
  return { store, id, create, file: path.join(store.dir(id), 'state.json') };
}

test('a pending state read cannot overlap file replacement or starve a commit', async (t) => {
  const { store, id, file } = await fixture(t);
  const originalRead = fs.readFile,
    originalRename = fs.rename;
  const entered = deferred(),
    release = deferred(),
    collision = deferred();
  let first = true,
    reading = false,
    overlaps = 0,
    callbacks = 0;
  t.mock.method(fs, 'readFile', async (...args) => {
    if (args[0] === file && first) {
      first = false;
      reading = true;
      entered.resolve();
      await release.promise;
      try {
        return await originalRead(...args);
      } finally {
        reading = false;
      }
    }
    return originalRead(...args);
  });
  t.mock.method(fs, 'rename', async (...args) => {
    if (args[1] === file && reading) {
      overlaps++;
      collision.resolve();
      throw Object.assign(new Error('injected Windows sharing conflict'), { code: 'EPERM' });
    }
    return originalRename(...args);
  });
  const readingState = store.read(id);
  await entered.promise;
  const writingState = store.update(id, (s) => {
    callbacks++;
    store.event(s, 'COORDINATED');
  });
  try {
    await Promise.race([collision.promise, delay(150)]);
  } finally {
    release.resolve();
  }
  await Promise.all([readingState, writingState]);
  assert.equal(overlaps, 0, 'commit must wait for its own active readers, not collide and retry');
  assert.equal(callbacks, 1);
  assert.equal((await store.read(id)).events.filter((e) => e.type === 'COORDINATED').length, 1);
});

for (const mode of ['transient', 'persistent', 'nonretryable']) {
  test(`${mode} commit errors keep callback-once and intact state guarantees`, async (t) => {
    const { store, id, file } = await fixture(t);
    const before = await store.read(id),
      originalRename = fs.rename;
    let calls = 0,
      callbacks = 0;
    const code = mode === 'nonretryable' ? 'ENOSPC' : 'EPERM';
    t.mock.method(fs, 'rename', async (...args) => {
      if (args[1] === file) {
        calls++;
        if (mode !== 'transient' || calls <= 2)
          throw Object.assign(new Error('injected file commit failure'), { code });
      }
      return originalRename(...args);
    });
    const pending = store.update(id, (s) => {
      callbacks++;
      store.event(s, 'ONCE');
    });
    if (mode === 'transient') await pending;
    else await assert.rejects(pending, { code });
    assert.equal(callbacks, 1);
    assert.equal(calls, mode === 'transient' ? 3 : mode === 'persistent' ? 9 : 1);
    const after = await store.read(id);
    assert.equal(after.revision, before.revision + (mode === 'transient' ? 1 : 0));
    assert.equal(
      after.events.filter((e) => e.type === 'ONCE').length,
      mode === 'transient' ? 1 : 0,
    );
    if (mode !== 'transient') assert.deepEqual(after, before);
    t.mock.restoreAll();
    await store.update(id, (s) => store.event(s, 'RECOVERED'));
    assert.equal((await store.read(id)).events.filter((e) => e.type === 'RECOVERED').length, 1);
  });
}

test(
  'a business update can read its own prior state without holding the file lock',
  { timeout: 3000 },
  async (t) => {
    const { store, id } = await fixture(t);
    const before = await store.read(id);
    await store.update(id, async (s) => {
      assert.equal((await store.read(id)).revision, before.revision);
      store.event(s, 'CALLBACK_READ');
    });
    assert.equal((await store.read(id)).revision, before.revision + 1);
  },
);

test('a slow task read cannot hold up another task commit', { timeout: 4000 }, async (t) => {
  const { store, id, create, file } = await fixture(t);
  const other = await create(),
    originalRead = fs.readFile;
  const entered = deferred(),
    release = deferred();
  t.mock.method(fs, 'readFile', async (...args) => {
    if (args[0] === file) {
      entered.resolve();
      await release.promise;
    }
    return originalRead(...args);
  });
  const slow = store.read(id);
  await entered.promise;
  let completed = false;
  const writing = store
    .update(other, (s) => store.event(s, 'INDEPENDENT'))
    .then(() => {
      completed = true;
    });
  try {
    await Promise.race([writing, delay(1000)]);
    assert.equal(completed, true);
  } finally {
    release.resolve();
    await Promise.all([slow, writing]);
  }
});

test(
  'eight real-file pollers and one hundred commits retain every event exactly once',
  { timeout: 20000 },
  async (t) => {
    const { store, id } = await fixture(t);
    let writing = true,
      reads = 0;
    const pollers = Array.from({ length: 8 }, async () => {
      let revision = -1;
      while (writing) {
        const s = await store.read(id);
        assert.ok(s.revision >= revision);
        revision = s.revision;
        assert.equal(new Set(s.events.map((e) => e.seq)).size, s.events.length);
        reads++;
        await delay(1);
      }
    });
    try {
      for (let i = 0; i < 100; i++) await store.update(id, (s) => store.event(s, 'STRESS', { i }));
    } finally {
      writing = false;
      await Promise.all(pollers);
    }
    const after = await store.read(id);
    assert.deepEqual(
      after.events.filter((e) => e.type === 'STRESS').map((e) => e.i),
      Array.from({ length: 100 }, (_, i) => i),
    );
    assert.ok(reads >= 8);
    t.diagnostic(`actual completed state reads: ${reads}; committed events: 100`);
  },
);
