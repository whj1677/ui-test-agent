import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const manifest=JSON.parse(await fs.readFile(new URL('./manifest.json',import.meta.url),'utf8'));
for(const item of manifest.files){
 if(!/^(?:manual-lab|expanded-lab)\/[A-Za-z0-9./_-]+$/.test(item.path)||item.path.includes('..'))throw Error('INVALID_MANIFEST_PATH');
 const bytes=await fs.readFile(new URL('../'+item.path,import.meta.url));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('FREEZE_MISMATCH:'+item.path);
}
console.log(JSON.stringify({state:'FROZEN_INPUTS_MATCH',files:manifest.files.length,cases:32,not_product_acceptance:true}));
