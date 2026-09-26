import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',project='project-80875248-3e14-4055-b077-b890dead1a9e',prefix=`/api/case-library/projects/${project}/reports`;
const body={scope:'run',run_id:'build-20260925135104-907921c7-normal',request_id:'reliability-20260925-recovery-report',include_video:true,include_trace:true};
const response=await fetch(base+prefix,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)});
assert.equal(response.status,201);const r=await response.json();assert.equal(r.entries[0].failure_category,'BUSINESS_DIFFERENCE');
assert.equal(r.counts.failed,1);assert.equal(r.entries[0].fidelity_review.semantic_approval,false);
assert.equal(r.entries[0].fidelity_review.bundle_sha256,r.entries[0].bundle_sha256);
let checked=0;
for(const m of r.entries[0].media){assert.equal(m.included,true);const bytes=Buffer.from(m.data_url.split(',')[1],'base64');
  assert.equal(bytes.length,m.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(),m.sha256);checked++;}
const download=await fetch(base+prefix+'/'+r.report_id+'/html?download=1');assert.equal(download.status,200);const html=await download.text();
assert.ok(html.includes(r.report_service_identity.source_sha256));assert.ok(html.includes(r.entries[0].service_identity.source_sha256));
assert.ok(html.includes('BUSINESS_DIFFERENCE'));assert.ok(html.includes('semantic_approval'));
await fs.writeFile(new URL('recovery-report.html',import.meta.url),html);
const result={report_id:r.report_id,counts:r.counts,media_checked:checked,report_source:r.report_service_identity.source_sha256,run_source:r.entries[0].service_identity.source_sha256,
  download_bytes:Buffer.byteLength(html),identity_and_review_in_html:true};
await fs.writeFile(new URL('recovery-report-verification.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
