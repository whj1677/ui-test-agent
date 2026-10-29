import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canRestart, restartAndWait } from '../web-v2/service-restart.js';

const root = fileURLToPath(new URL('../web-v2/', import.meta.url));
const app = await fs.readFile(path.join(root, 'app.js'), 'utf8');
const pollerStart = app.indexOf('function createServiceHealthPoller(');
const pollerEnd = app.indexOf('\nlet serviceHealth = null;', pollerStart);
assert.ok(pollerStart >= 0 && pollerEnd > pollerStart, 'health poller implementation is present for direct behavior testing');
const createServiceHealthPoller = new Function(`${app.slice(pollerStart, pollerEnd)}\nreturn createServiceHealthPoller;`)();
const previous = { service_instance_id:'old', data_root_sha256:'data-a', configuration_sha256:'config-a' };
const health = (identity = previous, accepting = true, status = 'ready') => ({ service_identity:identity, accepting, status });
const nextIdentity = { ...previous, service_instance_id:'new' };
const updated = (key, value) => ({ ...nextIdentity, [key]:value });
function controlledTimers() {
  let nextId = 0;
  const tasks = [];
  return {
    setTimer(callback, delay) { const task = { id:++nextId, callback, delay }; tasks.push(task); return task.id; },
    clearTimer(id) { const index = tasks.findIndex(task => task.id === id); if (index >= 0) tasks.splice(index, 1); },
    async fireNext() {
      const task = tasks.shift(); assert.ok(task, 'expected a scheduled poll');
      task.callback();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
    get pending() { return tasks.length; },
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('only an explicitly managed, available, connected service enables restart; legacy app startup has no new static dependency', () => {
  assert.equal(canRestart({ restart:{managed:true, available:true} }), true);
  assert.equal(canRestart({ restart:{managed:false, available:true} }), false);
  assert.equal(canRestart({ restart:{managed:true, available:false} }), false);
  assert.equal(canRestart(null), false);
  assert.equal(canRestart({ restart:{managed:true, available:true} }, true), false);
  assert.doesNotMatch(app, /import\s+.*service-restart\.js/);
  assert.match(app, /await import\('\/workspace\/service-restart\.js'\)/);
  assert.match(app, /if \(!ok\) serviceHealth = null/);
  assert.match(app, /if \(isDirty\(\)\) \{ toast\('请先保存或取消当前编辑，再重启工作台。'/);
});

test('waits through old ID and rejects mismatched data, config, or non-accepting health', async () => {
  const observations = [
    health(), health(updated('data_root_sha256', 'other-data')),
    health(updated('configuration_sha256', 'other-config')),
    health(nextIdentity, false), health(nextIdentity, true, 'starting'), health(nextIdentity),
  ];
  let posts = 0;
  const result = await restartAndWait({
    previous, postRestart:async id => { posts++; assert.equal(id, 'old'); return { status:'restart_scheduled' }; },
    getHealth:async () => observations.shift(), intervalMs:1, requestTimeoutMs:20,
  });
  assert.equal(posts, 1);
  assert.deepEqual(result.service_identity, nextIdentity);
});

test('hung POST and health requests are bounded, aborted, and the POST is never replayed', async () => {
  let posts = 0, healthCalls = 0, aborted = 0;
  const started = Date.now();
  await assert.rejects(restartAndWait({
    previous, timeoutMs:35, intervalMs:1, requestTimeoutMs:5,
    postRestart:(_id, signal) => { posts++; signal.addEventListener('abort', () => aborted++); return new Promise(() => {}); },
    getHealth:signal => { healthCalls++; signal.addEventListener('abort', () => aborted++); return new Promise(() => {}); },
  }), { code:'SERVICE_RESTART_UNCONFIRMED' });
  assert.equal(posts, 1);
  assert.ok(healthCalls > 0);
  assert.ok(aborted >= 2);
  assert.ok(Date.now() - started < 250);
});

test('a timed out POST is not resent, but a verified new instance can still confirm recovery', async () => {
  let posts = 0;
  const result = await restartAndWait({
    previous, timeoutMs:100, requestTimeoutMs:5, intervalMs:1,
    postRestart:() => { posts++; return new Promise(() => {}); },
    getHealth:async () => health(nextIdentity),
  });
  assert.equal(posts, 1);
  assert.deepEqual(result.service_identity, nextIdentity);
});

test('a network-unknown POST outcome polls health once without repeating the POST', async () => {
  let posts = 0, healthCalls = 0;
  const result = await restartAndWait({
    previous, timeoutMs:100, intervalMs:1,
    postRestart:async () => { posts++; throw Object.assign(new Error('WORKBENCH_UNREACHABLE'), { code:'WORKBENCH_UNREACHABLE', status:0 }); },
    getHealth:async () => { healthCalls++; return health(nextIdentity); },
  });
  assert.equal(posts, 1);
  assert.equal(healthCalls, 1);
  assert.deepEqual(result.service_identity, nextIdentity);
});

test('HTTP errors do not enter recovery polling', async () => {
  let healthCalls = 0;
  await assert.rejects(restartAndWait({
    previous,
    postRestart:async () => { throw Object.assign(new Error('SERVICE_RESTART_BUSY'), { code:'SERVICE_RESTART_BUSY' }); },
    getHealth:async () => { healthCalls++; return health(nextIdentity); },
  }), { code:'SERVICE_RESTART_BUSY' });
  assert.equal(healthCalls, 0);
});

test('health poll refreshes busy to idle without redrawing the page', async () => {
  const seen = [];
  const timers = controlledTimers();
  const samples = [{ ...health(previous), restart:{managed:true, available:false, reason:'任务运行中'} }, { ...health(previous), restart:{managed:true, available:true} }];
  const poller = createServiceHealthPoller({
    intervalMs:4000, setTimer:timers.setTimer, clearTimer:timers.clearTimer,
    read:async () => samples.shift(), apply:value => seen.push(value.restart.available),
    onError:() => seen.push('error'), shouldPause:() => false, getGeneration:() => 0,
  });
  poller.start();
  assert.equal(timers.pending, 1);
  await timers.fireNext();
  await timers.fireNext();
  poller.stop();
  assert.deepEqual(seen, [false, true]);
  assert.match(app, /apply:health => \{ serviceHealth = health; setService\(true\); \}/);
  assert.match(app, /serviceHealthPoller\.start\(\)/);
});

test('health poll failures and slow requests never overlap', async () => {
  const timers = controlledTimers();
  let active = 0, maximum = 0, calls = 0, failures = 0;
  const slowRead = deferred();
  const poller = createServiceHealthPoller({
    intervalMs:4000, setTimer:timers.setTimer, clearTimer:timers.clearTimer,
    read:async () => {
      calls++; active++; maximum = Math.max(maximum, active);
      try {
        if (calls === 1) throw new Error('temporary health failure');
        if (calls === 2) return await slowRead.promise;
        return { ...health(previous), restart:{managed:true, available:true} };
      } finally { active--; }
    },
    apply:() => {}, onError:() => failures++, shouldPause:() => false, getGeneration:() => 0,
  });
  poller.start();
  await timers.fireNext();
  assert.equal(failures, 1);
  await timers.fireNext();
  assert.equal(calls, 2);
  assert.equal(active, 1);
  assert.equal(timers.pending, 0, 'no next timer is scheduled while health is pending');
  slowRead.resolve(health(previous, true));
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(active, 0);
  assert.equal(timers.pending, 1);
  await timers.fireNext();
  poller.stop();
  assert.equal(calls, 3);
  assert.equal(failures, 1);
  assert.equal(maximum, 1);
});

test('connection timeout is reported as an incomplete check and disables restart until a healthy response',()=>{
  const start=app.indexOf('function setService('),end=app.indexOf('\nasync function readServiceHealth()',start);
  assert.ok(start>=0 && end>start);
  const nodes=new Map();
  const document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',disabled:false,dataset:{},classList:{toggle(){}}});return nodes.get(selector);}};
  const state=new Function('document',`let serviceHealth=null,restartInProgress=false;${app.slice(start,end)};return {set:setService,healthy(h){serviceHealth=h;setService(true)}};`)(document);
  state.healthy({status:'ready',restart:{managed:true,available:true}});
  assert.equal(nodes.get('#service-restart').disabled,false);
  state.set(false,new Error('HEALTH_CHECK_TIMEOUT'));
  assert.equal(nodes.get('#service-label').textContent,'连接检查超时 · 正在重试');
  assert.equal(nodes.get('#service-restart').disabled,true);
  state.healthy({status:'ready',restart:{managed:true,available:false}});
  assert.equal(nodes.get('#service-label').textContent,'服务就绪 · 真实后端');
  assert.equal(nodes.get('#service-restart').disabled,true);
});

test('pausing during restart drops an old health response and resumes with fresh state', async () => {
  let generation = 0;
  const timers = controlledTimers();
  const oldRead = deferred();
  const applied = [];
  const poller = createServiceHealthPoller({
    intervalMs:4000, setTimer:timers.setTimer, clearTimer:timers.clearTimer,
    shouldPause:() => false, getGeneration:() => generation,
    read:async () => {
      if (generation === 0) return oldRead.promise;
      return { ...health(nextIdentity), restart:{managed:true, available:true} };
    },
    apply:value => applied.push(value.service_identity.service_instance_id), onError:() => applied.push('error'),
  });
  poller.start();
  await timers.fireNext();
  poller.pause(); generation++;
  oldRead.resolve({ ...health(previous), restart:{managed:true, available:false, reason:'stale'} });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.deepEqual(applied, []);
  poller.resume();
  await timers.fireNext();
  poller.stop();
  assert.deepEqual(applied, ['new']);
  assert.match(app, /if \(restartInProgress \|\| generation !== serviceHealthGeneration\) return serviceHealth/);
  assert.match(app, /serviceHealthGeneration\+\+;\s*serviceHealthPoller\.pause\(\)/);
});
