// One package-local native DSH identity for setup, launch and the server.
// No download, private CLI lookup, model request or credential access.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const NATIVE_DSH_VERSION='0.2.0-rc.2';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function regular(file){
  const stat=await fs.lstat(file).catch(error=>{if(error.code==='ENOENT')throw Error('NATIVE_DSH_PACKAGE_NOT_INSTALLED');throw error;});
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('NATIVE_DSH_PACKAGE_FILE_INVALID');
  return fs.readFile(file);
}
export async function nativeDshPackage(root){
  if(!path.isAbsolute(root||''))throw Error('NATIVE_DSH_PACKAGE_ROOT_REQUIRED');
  const directory=path.join(root,'workbench/native'),packageRoot=path.join(directory,'node_modules/@deepseek-ai/dsh');
  const declaration=JSON.parse(await regular(path.join(directory,'package.json')));
  const lockBytes=await regular(path.join(directory,'package-lock.json')),lock=JSON.parse(lockBytes);
  const locked=lock.packages?.['node_modules/@deepseek-ai/dsh'];
  if(Object.keys(declaration.dependencies||{}).length!==1||Object.keys(lock.packages?.['']?.dependencies||{}).length!==1||Object.values(lock.packages||{}).some(item=>item.link)||declaration.dependencies?.['@deepseek-ai/dsh']!==NATIVE_DSH_VERSION||lock.packages?.['']?.dependencies?.['@deepseek-ai/dsh']!==NATIVE_DSH_VERSION||locked?.version!==NATIVE_DSH_VERSION||!/^sha512-[A-Za-z0-9+/=]+$/.test(locked.integrity||''))throw Error('NATIVE_DSH_PACKAGE_LOCK_MISMATCH');
  const installed=JSON.parse(await regular(path.join(packageRoot,'package.json')));
  if(installed.name!=='@deepseek-ai/dsh'||installed.version!==NATIVE_DSH_VERSION||installed.bin?.dsh!=='lib/bin.js')throw Error('NATIVE_DSH_PACKAGE_VERSION_MISMATCH');
  const binary=path.join(packageRoot,'lib/bin.js'),bytes=await regular(binary);
  return {version:NATIVE_DSH_VERSION,binary,binary_sha256:hash(bytes),lock_sha256:hash(lockBytes)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  nativeDshPackage(path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url))))
    .then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(/^NATIVE_DSH_PACKAGE_[A-Z_]+$/.test(error.message)?error.message:'NATIVE_DSH_PACKAGE_INVALID');process.exitCode=1;});
}
