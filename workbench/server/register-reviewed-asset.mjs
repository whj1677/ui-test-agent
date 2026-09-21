import { createPaths } from './paths.mjs';
import { WorkbenchStore } from './store.mjs';
import { CaseLibraryStore } from './cases/store.mjs';
import { registerReviewedProjectCaseAsset } from './reviewed-asset.mjs';

const paths = createPaths();
const store = new WorkbenchStore(paths.dataRoot);
const caseStore = new CaseLibraryStore(paths.caseLibraryRoot);
await Promise.all([store.init(), caseStore.init()]);
const result = await registerReviewedProjectCaseAsset({ store, paths, caseStore });
console.log(JSON.stringify({
  asset_id: result.asset.asset_id,
  version: result.asset.version,
  created: result.created,
  candidate_sha256: result.asset.script.sha256,
  scope: result.asset.scope,
}, null, 2));
