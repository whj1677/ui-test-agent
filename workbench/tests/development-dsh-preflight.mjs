// Zero-model boot of the locked profile: no headless agent driver is mounted.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runProfile } from '../../harness-probe/node_modules/@deepseek-ai/dsh/lib/profile-boot.js';
import { loadLayeredEnv } from '../../harness-probe/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js';
import { developmentPatch } from '../server/build/development-patch.mjs';
import { startDevelopmentMcp } from '../server/build/development-mcp.mjs';

const workbench = fileURLToPath(new URL('../', import.meta.url));
const directory = await fs.mkdtemp(path.join(workbench, '.local/dev-preflight-'));
const bridge = await startDevelopmentMcp(async () => ({ engineering_fixture: true }));
process.env.WORKBENCH_DEVELOPMENT_ENDPOINT = bridge.url;
process.env.WORKBENCH_DEVELOPMENT_NORMAL_URL = 'http://127.0.0.1:1/normal';
let boot;
try {
  const patch = path.join(directory, 'zero-model.yml');
  await fs.writeFile(patch, developmentPatch('', workbench) + '\n- id: headless-startup\n  disabled: true\n- id: headless-runner\n  disabled: true\n- id: llm-retry\n  disabled: true\n');
  boot = await runProfile({ environment: loadLayeredEnv('dsh'), profile: 'headless', patchFiles: [patch], args: [] });
  assert.ok(boot.ctx.tools.schemas().some(item => item.name === 'mcp__workbench__self_test'));
  const denied = await boot.ctx.waterfall('tools/pre-execute', { name: 'bash', arguments: {} }, async () => ({ kind: 'allow' }));
  assert.equal(denied.kind, 'deny');
  const allowed = await boot.ctx.waterfall('tools/pre-execute', { name: 'mcp__workbench__read_draft', arguments: {} }, async () => ({ kind: 'allow' }));
  assert.equal(allowed.kind, 'allow');
  console.log(JSON.stringify({ status: 'ENGINEERING_PREFLIGHT_PASSED', locked_dsh: '0.1.6-alpha.2', file_url_plugin_loaded: true, mcp_self_test_registered: true, actual_guard_denies_shell: true, model_calls: 0 }));
} finally {
  await boot?.ctx.fiber.dispose(); await bridge.close(); await fs.rm(directory, { recursive: true, force: true });
}
