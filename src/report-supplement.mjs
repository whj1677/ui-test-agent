import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,fail,escapeHTML as h} from './common.mjs';

// Optional operator observations are presentation supplements, never execution facts.
export async function loadReportSupplement(store,id,state,baseline){
  let bytes;try{bytes=await fs.readFile(path.join(store.dir(id),'report-supplement.json'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  let input;try{input=JSON.parse(bytes);}catch{fail('REPORT_SUPPLEMENT_INVALID');}
  if(input.schema_version!=='ui-agent-report-supplement/v1'||input.baseline_sha256!==state.baseline_sha256||!Array.isArray(input.cases)||input.cases.length>baseline.cases.length)fail('REPORT_SUPPLEMENT_BASELINE_MISMATCH');
  const ids=new Set(),cases=[];let mediaBytes=0;
  for(const entry of input.cases){
    const original=baseline.cases.find(c=>c.case_id===entry.case_id);
    if(!original||ids.has(entry.case_id)||!Array.isArray(entry.steps)||entry.steps.length!==original.steps.length)fail('REPORT_SUPPLEMENT_CASE_MISMATCH');ids.add(entry.case_id);
    const steps=[];let media='';
    for(const [i,s]of entry.steps.entries()){
      const expected=original.steps[i];
      if(s.step_id!==expected.step_id||s.action!==expected.action||s.expected!==expected.expected||typeof s.passed!=='boolean'||typeof s.actual!=='string')fail('REPORT_SUPPLEMENT_STEP_MISMATCH');
      if(s.evidence){
        const {file,sha256}=s.evidence;if(typeof file!=='string'||path.basename(file)!==file||!file.endsWith('.png'))fail('REPORT_SUPPLEMENT_MEDIA_INVALID');
        const image=await fs.readFile(path.join(store.dir(id),'report-supplement-media',file));mediaBytes+=image.length;
        if(hash(image)!==sha256||mediaBytes>100*1024*1024)fail('REPORT_SUPPLEMENT_MEDIA_CHANGED');
        media+=`<figure><figcaption>${h(s.step_id)} · 浏览器补充复核截图</figcaption><img loading="lazy" alt="${h(s.step_id)} 补充复核" src="data:image/png;base64,${image.toString('base64')}"></figure>`;
      }
      steps.push(s);
    }
    cases.push({case_id:entry.case_id,steps,passed:steps.every(s=>s.passed),media,reviewer_note:typeof entry.reviewer_note==='string'?entry.reviewer_note:''});
  }
  return {cases,sha256:hash(bytes),summary:{total:cases.length,pass:cases.filter(c=>c.passed).length,fail:cases.filter(c=>!c.passed).length,authority:'OPERATOR_SUPPLEMENT_NOT_AGENT_EXECUTION'}};
}

export function renderSupplement(review){
  if(!review)return '';
  return `<section class="supplement"><h3>浏览器补充复核 · ${review.passed?'原预期满足':'发现不一致'}</h3><p class="muted">由 Codex 浏览器逐步复核；以下结果不计入 Agent 已执行数量。</p><div class="table-scroll"><table class="steps"><thead><tr><th>步骤</th><th>操作步骤</th><th>原预期</th><th>复核实际结果</th><th>复核结果</th></tr></thead><tbody>${review.steps.map(s=>`<tr><td>${h(s.step_id)}</td><td class="prose">${h(s.action)}</td><td class="prose">${h(s.expected)}</td><td class="prose">${h(s.actual)}</td><td><span class="pill ${s.passed?'good':'bad'}">${s.passed?'预期满足':'不一致'}</span></td></tr>`).join('')}</tbody></table></div><details><summary>查看补充复核截图</summary><div class="media-grid">${review.media}</div></details></section>`;
}
