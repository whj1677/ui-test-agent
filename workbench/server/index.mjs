import { createWorkbenchServer } from './app.mjs';

const host = '127.0.0.1';
const port = Number(process.env.WORKBENCH_PORT || 4210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_WORKBENCH_PORT');

const server = createWorkbenchServer();
server.listen(port, host, () => {
  console.log(`Approved test workbench http://${host}:${port}`);
});
