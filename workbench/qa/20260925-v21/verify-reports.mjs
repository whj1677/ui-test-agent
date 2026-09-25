// Actual sole-workbench API checks. Creates/cancels a report only, never executes cases.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',project='project-6f4c682c-590c-4d65-a23c-120835e00e0c';
const route=`/api/case-library/projects/${project}/reports`;
const post=(url,body)=>fetch(base+url,{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify(body)});
const input={scope:'batch',batch_id:'batch-25f153bf-f392-410a-8172-8fd685a2334d',request_id:'v21-real-report-cancel-'+Date.now(),include_video:true,include_trace:true};
const pending=post(route,input);
await new Promise(r=>setTimeout(r,20));
const cancellation=await post(route+'/cancel',{request_id:input.request_id});
const cancelBody=await cancellation.json(),created=await pending,createdBody=await created.json();
assert.equal(cancelBody.state,'CANCEL_REQUESTED');assert.equal(createdBody.error,'REPORT_CANCELLED');
const {reports}=await (await fetch(base+route)).json();
assert.ok(!reports.some(r=>r.report_id==='report-'+createHash('sha256').update(project+':'+input.request_id).digest('hex').slice(0,40)));
const batchReport=reports.find(r=>r.batch_id===input.batch_id);assert.ok(batchReport);
const snapshot=await (await fetch(base+route+'/'+batchReport.report_id)).json();
assert.deepEqual(snapshot.counts,{requested:12,executed:3,passed:2,failed:1,not_run:9});
assert.equal(snapshot.entries.find(e=>e.external_id==='KC-22').case_version,1);
const media=[];
for(const entry of snapshot.entries){
  if(entry.run_id)assert.ok(entry.steps.length>0);
  for(const item of entry.media.filter(m=>m.included)){
    const bytes=Buffer.from(item.data_url.split(',')[1],'base64'),sha=createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha.toUpperCase(),item.sha256.toUpperCase());assert.equal(bytes.length,item.bytes);
    media.push({run_id:entry.run_id,file_id:item.file_id,sha256:sha,bytes:bytes.length});
  }
}
const download=await fs.readFile(`${process.env.USERPROFILE}/Downloads/${batchReport.report_id}.html`);
const served=Buffer.from(await (await fetch(base+route+'/'+batchReport.report_id+'/html')).arrayBuffer());
assert.ok(download.equals(served));assert.ok(!/<(?:script|link)\b|(?:src|href)=["'](?:https?:|file:)/i.test(download.toString()));
const cross=await fetch(base+`/api/case-library/projects/project-5fb015d9-a47d-4e14-9444-449a997692f7/reports/${batchReport.report_id}`);assert.ok(!cross.ok);
await fs.writeFile('workbench/qa/20260925-v21/report-final-verification.json',JSON.stringify({checked_at:new Date().toISOString(),report_id:batchReport.report_id,counts:snapshot.counts,download_bytes:download.length,download_sha256:createHash('sha256').update(download).digest('hex'),media,cancel_state:cancelBody.state,create_error:createdBody.error,cancel_saved_no_report:true,cross_project_rejected:true,external_resources:0,offline_browser_open:'UNVERIFIED_FILE_SCHEME_RESTRICTION'},null,2));
console.log(JSON.stringify({report_id:batchReport.report_id,counts:snapshot.counts,cancel_state:cancelBody.state,media_count:media.length}));
