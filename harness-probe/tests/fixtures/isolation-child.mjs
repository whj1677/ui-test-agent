import { readFile, writeFile } from 'node:fs/promises';

const [workspaceFile, outsideFile, outsideWriteFile, allowedUrl, deniedUrl] = process.argv.slice(2);

async function attempt(action) {
  try {
    const value = await action();
    return { succeeded: true, value };
  } catch (error) {
    return { succeeded: false, errorCode: error?.code ?? error?.name ?? 'UNKNOWN' };
  }
}

const result = {
  schema: 'm2b-isolation-child-v1',
  identity: { user: process.env.USERNAME ?? null },
  environment: {
    allowedMarkerPresent: process.env.M2B_ALLOWED_MARKER === 'allowed-marker',
    deepseekApiKeyPresent: Object.hasOwn(process.env, 'DEEPSEEK_API_KEY'),
    deepseekBaseUrlPresent: Object.hasOwn(process.env, 'DEEPSEEK_BASE_URL'),
    environmentNames: Object.keys(process.env).sort(),
  },
  files: {
    workspaceRead: await attempt(async () => (await readFile(workspaceFile, 'utf8')).trim()),
    workspaceWrite: await attempt(async () => { await writeFile(`${workspaceFile}.written`, 'workspace-write'); return true; }),
    outsideRead: await attempt(async () => (await readFile(outsideFile, 'utf8')).trim()),
    outsideWrite: await attempt(async () => { await writeFile(outsideWriteFile, 'outside-write'); return true; }),
  },
  network: {
    allowed: await attempt(async () => ({ status: (await fetch(allowedUrl)).status })),
    denied: await attempt(async () => ({ status: (await fetch(deniedUrl)).status })),
  },
};

process.stdout.write(`${JSON.stringify(result)}\n`);
