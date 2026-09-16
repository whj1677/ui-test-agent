import test from 'node:test';
import assert from 'node:assert/strict';
import {caseHash,planHash} from '../src/plans.mjs';
import {PLAN_AUDIT_PROMPT,auditInput,validatePlanAudit,repairablePlanError} from '../src/plan-quality.mjs';

function fixture(){
  const c={case_id:'CASE-1',title:'read-only record details',steps:[
    {step_id:'S1',action:'Open record A details',expected:'Name is Alpha; status is Active',obligations:[{id:'O1',text:'Name is Alpha'},{id:'O2',text:'status is Active'}]},
    {step_id:'S2',action:'Close details',expected:'Dialog is hidden',obligations:[{id:'O3',text:'Dialog is hidden'}]}
  ]};
  const plan={schema_version:'ui-agent-plan/v2',case_id:c.case_id,case_hash:caseHash(c),entry_path:'/records',data_effect:'read_only',preconditions:[],cleanup:null,steps:c.steps.map(s=>({step_id:s.step_id,source_action:s.action,source_expected:s.expected,actions:[],assertion_mode:'simultaneous',within_ms:8000,assertions:s.obligations.map(o=>({target:{kind:'testid',value:'details'},check:'contains',expected:o.text,oracle_quote:o.text,obligation_ids:[o.id]}))}))};
  const reply={checks:c.steps.flatMap(s=>s.obligations.map((o,i)=>({step_id:s.step_id,obligation_id:o.id,status:'COVERED',assertion_indices:[i],reason:'Explicit value assertion covers this original obligation.'}))),issues:[]};
  return {c,plan,reply};
}
const code=expected=>e=>e.code===expected;

test('complete audit is accepted only as a model finding, not execution approval',()=>{
  const {c,plan,reply}=fixture(),result=validatePlanAudit(reply,c,plan);
  assert.equal(result.outcome,'ACCEPT');assert.deepEqual(Object.keys(result).sort(),['checks','issues','outcome']);
  result.checks[0].reason='changed';assert.notEqual(reply.checks[0].reason,'changed');
  assert.match(PLAN_AUDIT_PROMPT,/does not prove semantic completeness, runtime success or authorize execution/);
});

test('audit input keeps originals and candidate hashes authoritative and clones evidence',()=>{
  const {c,plan}=fixture(),context={original:{case_id:'different'},case_hash:'wrong',plan_hash:'wrong',candidate_plan:{bad:true},pages:[{text:'captured state'}],technical_context:{source_control_candidates:[{locator:{kind:'testid',value:'details'}}]}};
  const input=auditInput(c,plan,context);
  assert.deepEqual(input.original,c);assert.deepEqual(input.candidate_plan,plan);assert.equal(input.case_hash,caseHash(c));assert.equal(input.plan_hash,planHash(plan));
  assert.equal(input.audit_indexing.final_approval,false);input.pages[0].text='changed';assert.equal(context.pages[0].text,'captured state');
  assert.match(PLAN_AUDIT_PROMPT,/source is NOT observed success/);assert.match(PLAN_AUDIT_PROMPT,/never create, merge, delete or rewrite obligations/);
});

test('missing semantic coverage becomes a bounded repair finding',()=>{
  const {c,plan,reply}=fixture();reply.checks[1]={...reply.checks[1],status:'MISSING',assertion_indices:[],reason:'Status value is not measured.'};
  reply.issues=[{code:'ASSERTION_GAP',step_id:'S1',reason:'Measure the explicit status value using a supported observed/source-confirmed target.'}];
  assert.equal(validatePlanAudit(reply,c,plan).outcome,'REPAIR');
});

test('Oracle ambiguity wins over repairable findings without rewriting original',()=>{
  const {c,plan,reply}=fixture(),before=structuredClone(c);
  reply.checks[0]={...reply.checks[0],status:'UNCLEAR',assertion_indices:[],reason:'The intended record population is undecided.'};
  reply.issues=[{code:'ORACLE_UNCLEAR',step_id:'S1',reason:'Clarify the intended population.'},{code:'LOCATOR_UNSUPPORTED',step_id:'S2',reason:'Closing control lacks technical evidence.'}];
  assert.equal(validatePlanAudit(reply,c,plan).outcome,'NEEDS_CLARIFICATION');assert.deepEqual(c,before);
});

test('action-level ambiguity also needs clarification when assertion checks are covered',()=>{
  const {c,plan,reply}=fixture();reply.issues=[{code:'ORACLE_UNCLEAR',step_id:'S1',reason:'Original action identifies two different target records.'}];
  assert.equal(validatePlanAudit(reply,c,plan).outcome,'NEEDS_CLARIFICATION');
});

for(const [label,mutate,error] of [
  ['missing obligation',r=>r.checks.pop(),'PLAN_AUDIT_COUNT_INVALID'],
  ['fabricated obligation',r=>r.checks[0].obligation_id='invented','PLAN_AUDIT_REFERENCE_INVALID'],
  ['fabricated step',r=>r.checks[0].step_id='UNKNOWN','PLAN_AUDIT_REFERENCE_INVALID'],
  ['duplicate obligation instead of another',r=>r.checks[1]=structuredClone(r.checks[0]),'PLAN_AUDIT_DUPLICATE_CHECK'],
  ['negative index',r=>r.checks[0].assertion_indices=[-1],'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'],
  ['fractional index',r=>r.checks[0].assertion_indices=[0.5],'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'],
  ['string index',r=>r.checks[0].assertion_indices=['0'],'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'],
  ['outside index',r=>r.checks[0].assertion_indices=[2],'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'],
  ['index belongs to another obligation',r=>r.checks[0].assertion_indices=[1],'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'],
  ['covered with no index',r=>r.checks[0].assertion_indices=[],'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'],
  ['duplicate assertion index',r=>r.checks[0].assertion_indices=[0,0],'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'],
  ['unknown top-level field',r=>r.approved=true,'PLAN_AUDIT_SCHEMA_INVALID'],
  ['unknown check field',r=>r.checks[0].replacement_expected='new expected','PLAN_AUDIT_SCHEMA_INVALID'],
  ['unknown issue field',r=>r.issues=[{code:'ACTION_MISMATCH',step_id:'S1',reason:'Mismatch',replacement_action:'save'}],'PLAN_AUDIT_SCHEMA_INVALID'],
  ['unknown finding code',r=>r.issues=[{code:'AUTO_APPROVE',step_id:'S1',reason:'Approve'}],'PLAN_AUDIT_ISSUE_INVALID'],
  ['issue references another case step',r=>r.issues=[{code:'ACTION_MISMATCH',step_id:'S9',reason:'Mismatch'}],'PLAN_AUDIT_ISSUE_INVALID'],
  ['empty reason',r=>r.checks[0].reason='  ','PLAN_AUDIT_CHECK_INVALID'],
  ['oversized reason',r=>r.checks[0].reason='x'.repeat(1201),'PLAN_AUDIT_CHECK_INVALID'],
  ['UNCLEAR without question issue',r=>r.checks[0].status='UNCLEAR','PLAN_AUDIT_INCONSISTENT'],
  ['MISSING without gap issue',r=>r.checks[0].status='MISSING','PLAN_AUDIT_INCONSISTENT'],
  ['gap contradicts covered checks',r=>r.issues=[{code:'ASSERTION_GAP',step_id:'S1',reason:'missing'}],'PLAN_AUDIT_INCONSISTENT']
])test(`audit rejects ${label}`,()=>{const {c,plan,reply}=fixture();mutate(reply);assert.throws(()=>validatePlanAudit(reply,c,plan),code(error));});

test('missing checks may cite partial but only relevant same-step assertions',()=>{
  const {c,plan,reply}=fixture();reply.checks[0].status='MISSING';reply.issues=[{code:'ASSERTION_GAP',step_id:'S1',reason:'The referenced assertion measures only part of this expectation.'}];
  assert.equal(validatePlanAudit(reply,c,plan).outcome,'REPAIR');reply.checks[0].assertion_indices=[1];assert.throws(()=>validatePlanAudit(reply,c,plan),code('PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'));
});

test('stale candidate or changed source mapping cannot be audited as current',()=>{
  const {c,plan,reply}=fixture();plan.steps[0].source_expected='New Oracle';assert.throws(()=>auditInput(c,plan,{}),code('PLAN_AUDIT_BASELINE_MISMATCH'));assert.throws(()=>validatePlanAudit(reply,c,plan),code('PLAN_AUDIT_BASELINE_MISMATCH'));
  const fresh=fixture();fresh.plan.case_hash='wrong';assert.throws(()=>validatePlanAudit(fresh.reply,fresh.c,fresh.plan),code('PLAN_AUDIT_BASELINE_MISMATCH'));
});

test('candidate error whitelist repairs structure/types/mapping but never runtime or external failures',()=>{
  for(const error of ['INVALID_SCHEMA','ASSERTION_BOOL_INVALID','UNSAFE_CSS_LOCATOR','PLAN_ORIGINAL_STEP_CHANGED','ORACLE_COVERAGE_INCOMPLETE','CLEANUP_IDENTITY_REQUIRED'])assert.equal(repairablePlanError(error),true,error);
  for(const error of ['DEEPSEEK_AUTH_FAILED','DEEPSEEK_RATE_LIMIT','DEEPSEEK_OUTPUT_TRUNCATED','DEEPSEEK_JSON_INVALID','ETIMEDOUT','ENOSPC','EVIDENCE_CHANGED','SENSITIVE_CONTROL_FORBIDDEN','OUTSIDE_TARGET_ORIGIN','CASE_CLEANUP_FAILED','BASELINE_CHANGED','OBLIGATIONS_CONFIRMATION_REQUIRED','ORACLE_REQUIRED','PLAN_AUDIT_SCHEMA_INVALID','LOCATOR_NOT_VISIBLE','LOCATOR_NOT_UNIQUE','ASSERTION_FAILED','UNKNOWN',null,{}])assert.equal(repairablePlanError(error),false,String(error));
});

test('structural validator does not pretend to prove truth of a covered audit',()=>{
  const {c,plan,reply}=fixture();
  // A lying reviewer can cite an existing mapped assertion. This module checks
  // references and schema, not arbitrary natural-language entailment.
  plan.steps[0].assertions[0].expected='Name label only';
  assert.equal(validatePlanAudit(reply,c,plan).outcome,'ACCEPT');
  assert.match(PLAN_AUDIT_PROMPT,/Identify counterexamples/);
});
