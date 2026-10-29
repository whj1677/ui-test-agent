import http from 'node:http';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { digest } from './development-session.mjs';
import { startUnfamiliarSite, siteRoot } from '../../scripts/unfamiliar-site-server.mjs';

// One registered synthetic site adapter, not an arbitrary-URL execution API.
// A fresh listener is owned per execution and always closed by its lease.
export function frozenTrialEnvironment(config) {
  if(config.kind === 'registered-static-html') return staticEnvironment(config);
  if(config.kind === 'registered-auth-target') return authEnvironment(config);
  if(config.kind === 'registered-user-target') return registeredUserEnvironment(config);

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
  return { id: config.id, configurationIdentity: config, check, async acquire(lane) {
    const manifest = await check();
    if (!['a', 'b'].includes(config.flow) || !['normal', 'negative'].includes(lane)) throw new Error('TRIAL_ENVIRONMENT_UNAVAILABLE');
    const site = await startUnfamiliarSite();
    const url = `${site.base}/index.html?flow=${config.flow}&variant=${lane === 'normal' ? 'normal' : 'fault'}`;
    return { url, detection: config.detection, release: site.close,
      identity: { environment_id: config.id, url, ownership: 'THIS_RUN_EPHEMERAL_LISTENER', site_manifest_sha256: config.site_manifest_sha256, files: manifest.files } };
  } };
}

function registeredUserEnvironment(config) {
  const check = async () => {
    let entry;
    try { entry = new URL(config.normal_url); } catch { throw Error('PROJECT_TARGET_ENTRY_URL_INVALID'); }
    const prefix = config.path_prefix;
    const rawPath = typeof config.normal_url === 'string'
      ? config.normal_url.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i)?.[1] || '/'
      : '/';
    let decodedPath;
    try { decodedPath = decodeURIComponent(entry.pathname); } catch { throw Error('PROJECT_TARGET_CONFIGURATION_CHANGED'); }
    if (typeof config.normal_url !== 'string' || config.normal_url.length > 2048 ||
        /[\\\u0000-\u001f]/.test(config.normal_url) ||
        entry.origin !== config.origin || entry.username || entry.password || entry.hash ||
        !['http:', 'https:'].includes(entry.protocol) ||
        (['127.0.0.1', 'localhost', '[::1]'].includes(entry.hostname.toLowerCase()) && entry.port === '4322') ||
        typeof prefix !== 'string' || !prefix.startsWith('/') || prefix.startsWith('//') ||
        /[\\?#%\u0000-\u001f]/.test(prefix) || prefix.split('/').some(part => part === '.' || part === '..') ||
        /%(?:2e|2f|5c)/i.test(rawPath) || /\\/.test(rawPath) ||
        rawPath.split('/').some(part => part === '.' || part === '..') ||
        decodedPath.includes('%') || decodedPath.includes('\\') ||
        decodedPath.split('/').some(part => part === '.' || part === '..') ||
        !(prefix === '/' || decodedPath === prefix || decodedPath.startsWith(`${prefix}/`)))
      throw Error('PROJECT_TARGET_CONFIGURATION_CHANGED');
    if (config.kind === 'registered-auth-target') return true;
    try {
      const response = await fetch(entry, { signal: AbortSignal.timeout(2500), redirect: 'error' });
      await response.body?.cancel();
      if (!response.ok) throw Error('unavailable');
    } catch { throw Error('GENERATION_TARGET_UNREACHABLE'); }
    return true;
  };
  return { id: config.id, configurationIdentity: config, check, async acquire(lane) {
    if (lane !== 'normal') throw Error('TRIAL_ENVIRONMENT_UNAVAILABLE');
    await check();
    return { url: config.normal_url, identity: { environment_id: config.id, url: config.normal_url,
      name: typeof config.name === 'string' ? config.name : null,
      origin: config.origin, path_prefix: config.path_prefix, configuration_sha256: config.configuration_sha256,
      ownership: 'REGISTERED_USER_TARGET' }, release: async () => {} };
  } };
}

function authEnvironment(config) {
  if (config.project_id) return registeredUserEnvironment(config);
  return { id: config.id, configurationIdentity: config,
    async check() {
      let entry;
      try { entry = new URL(config.normal_url); } catch { throw Error('TRIAL_AUTH_TARGET_INVALID'); }
      if (entry.username || entry.password || entry.hash ||
          !(entry.protocol === 'https:' || entry.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(entry.hostname))) {
        throw Error('TRIAL_AUTH_TARGET_INVALID');
      }
    },
    async acquire(lane) {
      if (lane !== 'normal') throw Error('TRIAL_ENVIRONMENT_UNAVAILABLE');
      await this.check();
      return { url: config.normal_url, identity: { environment_id: config.id, url: config.normal_url,
        ownership: 'REGISTERED_EXISTING_AUTH_TARGET' }, release: async () => {} };
    } };
}

function staticEnvironment(config){
  const base=fileURLToPath(new URL('../../',import.meta.url));
  const check=async()=>{
    if(typeof config.file!=='string'||path.isAbsolute(config.file)||config.file.split(/[\\/]/).includes('..'))throw Error('TRIAL_SITE_PATH_INVALID');
    const real=await fs.realpath(path.join(base,config.file));if(!real.startsWith(await fs.realpath(base)+path.sep))throw Error('TRIAL_SITE_PATH_INVALID');
    const html=await fs.readFile(real);if(digest(html)!==config.sha256)throw Error('TRIAL_SITE_FILE_CHANGED');return html;
  };
  return {id:config.id,configurationIdentity:config,check,async acquire(lane){
    if(lane!=='normal')throw Error('TRIAL_ENVIRONMENT_UNAVAILABLE');const html=await check();
    const server=http.createServer((req,res)=>{if(req.method!=='GET'||!['/','/index.html'].includes(req.url)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const url=`http://127.0.0.1:${server.address().port}/`;
    return {url,identity:{environment_id:config.id,url,site_sha256:config.sha256,configuration:config,ownership:'THIS_RUN_TARGET_SITE'},release:()=>new Promise(r=>server.close(r))};
  }};
}
