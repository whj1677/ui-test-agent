import { parentPort, workerData } from 'node:worker_threads';
import { compileAdapter, checkAdapterRegression } from './adapter-program.mjs';

try {
  const { source, inputs, regression } = workerData;
  if (!Array.isArray(inputs) || inputs.length > 300) throw new Error('ADAPTER_INPUT_LIMIT');
  const program = regression ? checkAdapterRegression(source) : compileAdapter(source);
  parentPort.postMessage({
    ok: true,
    hash: program.hash,
    locators: inputs.map((input) => program.locate(input)),
  });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    code: /^ADAPTER_|^INVALID_LOCATOR|^UNSAFE_CSS_LOCATOR|^LOCATOR_EXACT_REQUIRED/.test(
      error.code ?? error.message,
    )
      ? (error.code ?? error.message)
      : 'ADAPTER_PROGRAM_REJECTED',
  });
}
