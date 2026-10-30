import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import unzipper from 'unzipper';
import {fileURLToPath} from 'node:url';
const qa=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(qa,'../../../outputs/20261030-现场WPS诊断-v2');
const manifest=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));
const archive=await fs.readFile(path.join(out,manifest.file));
const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(archive)!==manifest.sha256)throw Error('ARCHIVE_BYTE_VIEW_MISMATCH');
const zip=await unzipper.Open.buffer(archive);
if(zip.files.length!==manifest.entries.length)throw Error('ZIP_ENTRY_COUNT_MISMATCH');
const extract=path.join(qa,'extracted-v2 中文 空格');await fs.mkdir(extract,{recursive:true});
for(const entry of zip.files){
 if(entry.type!=='File'||/[\\/:\x00]/.test(entry.path)||entry.path==='..')throw Error('UNEXPECTED_ZIP_ENTRY');
 const expected=manifest.entries.find(row=>row.name===entry.path);if(!expected)throw Error('UNEXPECTED_ZIP_FILE');
 const bytes=await entry.buffer();if(hash(bytes)!==expected.sha256||bytes.length!==expected.bytes)throw Error('ENTRY_BYTE_VIEW_MISMATCH');
 if(/\.(ps1|mjs|md|json|cmd)$/.test(entry.path))new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(entry.path.endsWith('.ps1')&&bytes.subarray(0,3).toString('hex')!=='efbbbf')throw Error('PS5_UTF8_BOM_REQUIRED');
 if(entry.path.endsWith('.md')&&!bytes.toString('utf8').includes('现场诊断包'))throw Error('README_UNREADABLE');
 await fs.writeFile(path.join(extract,entry.path),bytes);
}
console.log(JSON.stringify({status:'PASS',entries:zip.files.length,bytes:archive.length,sha256:hash(archive),native_zip_reader:'unzipper',text_entries_utf8:true}));
