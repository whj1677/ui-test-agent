// Reuse the existing synthetic target; never start another workbench.
import { createLedgerServer } from '../../qa/20260926-req0038-completion/fixture/server.mjs';
import { fileURLToPath } from 'node:url';

const server = createLedgerServer({ stateRoot: fileURLToPath(new URL('../../.local/manual-trial-20261004/namespaces/', import.meta.url)) });
server.on('error', error => { console.error(`练习站点启动失败：${error.code || error.name}，不终止已有进程、不更换端口。`); process.exitCode = 1; });
server.listen(4401, '127.0.0.1', () => console.log(`合成设备台账：http://127.0.0.1:4401/ledger/；正式工作台仍为 http://127.0.0.1:4322/workspace/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
