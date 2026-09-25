import fs from 'node:fs/promises';
import path from 'node:path';
import { digest } from './development-session.mjs';
import { startUnfamiliarSite, siteRoot } from '../../scripts/unfamiliar-site-server.mjs';

// One registered synthetic site adapter, not an arbitrary-URL execution API.
// A fresh listener is owned per execution and always closed by its lease.
export function frozenTrialEnvironment(config) {
  const check = async () => {
    try {
    const bytes = await fs.readFile(path.join(siteRoot, 'freeze.json'));
    if (digest(bytes) !== config.site_manifest_sha256) throw new Error('TRIAL_SITE_MANIFEST_CHANGED');
    const manifest = JSON.parse(bytes);
    for (const file of manifest.files) {
      if (!/^[\w.-]+$/.test(file.name) || digest(await fs.readFile(path.join(siteRoot, file.name))) !== file.sha256) throw new Error('TRIAL_SITE_FILE_CHANGED');
    }
    return manifest;
    } catch (error) { if (error.code === 'ENOENT') throw new Error('TRIAL_SITE_FILES_MISSING'); throw error; }
  };
  return { id: config.id, check, async acquire(lane) {
    const manifest = await check();
    if (!['a', 'b'].includes(config.flow) || !['normal', 'negative'].includes(lane)) throw new Error('TRIAL_ENVIRONMENT_UNAVAILABLE');
    const site = await startUnfamiliarSite();
    const url = `${site.base}/index.html?flow=${config.flow}&variant=${lane === 'normal' ? 'normal' : 'fault'}`;
    return { url, detection: config.detection, release: site.close,
      identity: { environment_id: config.id, url, ownership: 'THIS_RUN_EPHEMERAL_LISTENER', site_manifest_sha256: config.site_manifest_sha256, files: manifest.files } };
  } };
}
