import assert from 'node:assert/strict';
import {PLAN_PROMPT,REVIEW_PROMPT} from '../src/plans.mjs';
import {PLAN_AUDIT_PROMPT} from '../src/plan-quality.mjs';
import {INPUT_REVIEW_PROMPT} from '../src/input-review.mjs';

// Test-only protocol replies. They make no claim about real-model review quality.
export function fixtureModelPhase(prompt,input){
  if(input?.purpose==='case_ui_discovery')return 'discovery';
  if(prompt.startsWith(PLAN_AUDIT_PROMPT))return 'plan_audit';
  if(prompt.startsWith(INPUT_REVIEW_PROMPT))return 'input_review';
  if(input?.blocked_response&&prompt.startsWith("Review a planner's blocked response"))return 'blocked_audit';
  if(prompt.startsWith(REVIEW_PROMPT))return 'input_review';
  if(prompt.startsWith(PLAN_PROMPT))return 'plan';
  throw new Error('Unknown fixture model prompt');
}

export function fixtureAuditReply(c,plan){
  return {checks:c.steps.flatMap(step=>step.obligations.map(obligation=>{
    const candidate=plan.steps.find(s=>s.step_id===step.step_id);
    const assertion_indices=candidate.assertions.flatMap((a,i)=>a.obligation_ids?.includes(obligation.id)?[i]:[]);
    assert.ok(assertion_indices.length,'Fixture plan must have mapped assertions before mocked acceptance');
    return {step_id:step.step_id,obligation_id:obligation.id,status:'COVERED',assertion_indices,reason:'Test fixture audit response; not a real semantic review.'};
  })),issues:[]};
}

export function fixtureModelReply(prompt,input,plans){
  const phase=fixtureModelPhase(prompt,input);
  if(phase==='input_review')return {issues:[]};
  if(phase==='blocked_audit')return {outcome:'BLOCKED',reason:input.blocked_response.reason,evidence_quotes:[]};
  if(phase==='plan_audit')return fixtureAuditReply(input.original,input.candidate_plan);
  if(phase==='plan'){
    const plan=plans.find(p=>p.case_id===input.original.case_id);
    assert.ok(plan,'Missing fixture candidate for requested case');return {plan};
  }
  throw new Error('Discovery reply must be supplied by the discovery fixture');
}

export function fixtureTransportRequest(options){
  const body=JSON.parse(options.body);
  return {prompt:body.messages.find(m=>m.role==='system').content,input:JSON.parse(body.messages.find(m=>m.role==='user').content)};
}
