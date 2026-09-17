import { Worker } from 'node:worker_threads';
import { fail } from './common.mjs';
import { DEFAULT_ADAPTER_SOURCE } from './adapter-program.mjs';

// Worker bounds parsing/CPU/memory; the restrictive interpreter (not a Worker or
// vm alone) is the capability boundary. Only metadata is sent, never credentials.
export function runAdapter(
  inputs,
  { source = DEFAULT_ADAPTER_SOURCE, regression = false, signal } = {},
) {
  if (signal?.aborted)
    return Promise.reject(Object.assign(new Error('STOPPED'), { code: 'STOPPED' }));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./adapter-worker.mjs', import.meta.url), {
      workerData: { source, inputs, regression },
      resourceLimits: { maxOldGenerationSizeMb: 32, stackSizeMb: 2 },
    });
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate().catch(() => {});
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(Object.assign(new Error('STOPPED'), { code: 'STOPPED' }));
    const timer = setTimeout(
      () => finish(Object.assign(new Error('ADAPTER_TIMEOUT'), { code: 'ADAPTER_TIMEOUT' })),
      3000,
    );
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', (result) => {
      if (result.ok) finish(null, result);
      else {
        try {
          fail(result.code);
        } catch (e) {
          finish(e);
        }
      }
    });
    worker.once('error', () =>
      finish(Object.assign(new Error('ADAPTER_WORKER_FAILED'), { code: 'ADAPTER_WORKER_FAILED' })),
    );
    worker.once('exit', () => {
      if (!finished)
        finish(
          Object.assign(new Error('ADAPTER_WORKER_FAILED'), { code: 'ADAPTER_WORKER_FAILED' }),
        );
    });
    if (signal?.aborted) abort();
  });
}
