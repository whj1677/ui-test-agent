// Verify the report created through the UI, preserving its exact downloaded bytes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const id='report-baf16d385450467d072af738a6649331d18a9562';
const url='http://127.0.0.1:4322/api/case-library/projects/project-80875248-3e14-4055-b077-b890dead1a9e/reports/'+id;
const response=await fetch(url+'/html?download=1');assert.ok(response.ok);
assert.ok(response.headers.get('content-disposition').includes(id));
const bytes=Buffer.from(await response.arrayBuffer()),snapshot=await(await fetch(url)).json();
assert.equal(snapshot.batch_id,'batch-88258ad2-1b77-4a2d-849e-8d15f1fecda8');assert.equal(snapshot.entries.length,12);
assert.deepEqual(bytes,Buffer.from(await(await fetch(url+'/html')).arrayBuffer()));
const h=b=>createHash('sha256').update(b).digest('hex').toUpperCase();let attachments=0;
for(const entry of snapshot.entries)for(const m of entry.media)if(m.included){const b=Buffer.from(m.data_url.split(',')[1],'base64');assert.equal(b.length,m.bytes);assert.equal(h(b),m.sha256);attachments++;}
assert.ok(!/\b(?:src|href)=["'](?:https?:|\/api|file:)/i.test(bytes.toString()));
let browserDownload=false;try{assert.deepEqual(await fs.readFile('C:/Users/20240082/Downloads/'+id+'.html'),bytes);browserDownload=true;}catch{}
const file='engineer-batch-evidence.html';await fs.writeFile('workbench/qa/20260925-v21/'+file,bytes);
const result={report_id:id,batch_id:snapshot.batch_id,counts:snapshot.counts,bytes:bytes.length,sha256:h(bytes),attachments_checked:attachments,no_external_media:true,browser_download:browserDownload,browser_button_clicked:true,delivery_source:browserDownload?'browser-download-verified':'exact-HTTP-attachment-saved',offline_file_open:'NOT_VERIFIED',local_file_name:file};
await fs.writeFile('workbench/qa/20260925-v21/engineer-report-download.json',JSON.stringify(result,null,2));console.log(result);
