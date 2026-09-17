import { Store } from '../src/store.mjs';

const store = new Store(process.argv[2]);
await store.acquireLock();
const task = await store.create({
  name: '崩溃恢复工程样本',
  target: 'http://crash-fixture.test/app',
  filename: 'synthetic.json',
  baseline: {
    cases: [
      {
        case_id: 'CRASH-1',
        title: '已开始写入',
        steps: [{ step_id: 'S1', action: '合成动作', expected: '合成预期' }],
      },
    ],
  },
});
await store.update(task, (state) => {
  state.status = 'RUNNING';
  state.cases[0].status = 'RUNNING';
  state.cases[0].plan = { data_effect: 'mutation' };
});
process.send({ task, lock: store.writerLock });
setInterval(() => {}, 1000);
