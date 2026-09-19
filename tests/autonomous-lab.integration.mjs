import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DeepSeek } from '../src/deepseek.mjs';
import { runLab } from '../scripts/autonomous-lab.mjs';

test(
  'autonomous runner owns login and records a bounded model-boundary failure with no external calls',
  { timeout: 45000 },
  async () => {
    const provider = new DeepSeek({
      key: 'synthetic-orchestration-only',
      fetchImpl: async () => {
        throw Error('NETWORK_FORBIDDEN');
      },
    });
    let invoked = 0;
    provider.json = async () => {
      invoked++;
      throw Object.assign(new Error('SYNTHETIC_RUNNER_MODEL_BOUNDARY'), {
        code: 'SYNTHETIC_RUNNER_MODEL_BOUNDARY',
      });
    };
    const result = await runLab({
      realModel: true,
      suite: 'smoke',
      maxCalls: 2,
      maxMinutes: 0.5,
      modelProvider: provider,
    });
    assert.equal(result.tasks.length, 1);
    assert.deepEqual(result.tasks[0].case_ids, ['LAB-V01', 'LAB-V02', 'LAB-V03']);
    assert.ok(invoked > 0 && invoked <= 2);
    assert.equal(result.budget.calls, invoked);
    assert.equal(result.acceptance, 'NOT_ESTABLISHED');
    const saved = JSON.parse(await fs.readFile(path.join(result.directory, 'round.json'), 'utf8'));
    assert.equal(saved.budget.calls, invoked);
    assert.ok(saved.tasks[0].finished_at);
    assert.ok(saved.tasks[0].results.every((c) => c.status !== 'PASS_ASSERTIONS'));
    assert.ok(!JSON.stringify(saved).includes('synthetic-orchestration-only'));
  },
);
