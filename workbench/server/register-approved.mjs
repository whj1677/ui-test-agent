import { createPaths } from './paths.mjs';
import { WorkbenchStore } from './store.mjs';
import { buildApprovedAsset } from './registry.mjs';

const paths = createPaths();
const store = new WorkbenchStore(paths.dataRoot);
await store.init();
const asset = await buildApprovedAsset(paths);
const result = await store.registerAsset(asset);
console.log(JSON.stringify({
  status: result.created ? 'REGISTERED' : 'ALREADY_REGISTERED',
  asset_id: result.asset.asset_id,
  script_sha256: result.asset.script.sha256,
  data_root: paths.dataRoot,
}));
