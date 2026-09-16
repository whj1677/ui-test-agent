// A read-only projection of the validated handoff, not a newly signed artifact.
export function scopedHandoff(handoff,caseId){
  if(!handoff)return null;
  const case_bindings=handoff.case_bindings.filter(b=>b.case_id===caseId);
  const ids=new Set(case_bindings.flatMap(b=>b.steps.map(s=>s.action_id)));
  const actions=handoff.actions.filter(a=>ids.has(a.id));
  const refs=new Map();
  function collect(value){
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value.source_refs))for(const ref of value.source_refs){
      if(!refs.has(ref.path))refs.set(ref.path,new Set());
      refs.get(ref.path).add(ref.anchor_id);
    }
    for(const [key,child] of Object.entries(value))if(key!=='source_refs')collect(child);
  }
  collect({case_bindings,actions,authentication:handoff.authentication});
  const files=handoff.source.files.filter(f=>refs.has(f.path)).map(f=>({...f,anchors:f.anchors.filter(a=>refs.get(f.path).has(a.id))}));
  const {integrity,...rest}=handoff;
  return {...rest,view_kind:'case_scoped_projection',source_artifact_integrity:integrity,
    source:{...handoff.source,files},case_bindings,actions};
}

export function planningInput(state,c,row,inputHash){
  const handoff=scopedHandoff(state.handoff,c.case_id);
  // Put short, case-bound navigation/control facts before long source snippets.
  // These are locator candidates, never observations of test success.
  const controls=new Map();for(const action of handoff?.actions??[])for(const control of action.controls??[]){
    if(control.locator)controls.set(JSON.stringify(control.locator),{id:control.id,locator:control.locator});
  }
  const technical_context={entry_paths:[...new Set((handoff?.actions??[]).map(a=>a.entry_path).filter(Boolean))],
    source_control_candidates:[...controls.values()],runtime_confirmation_required:true};
  const mode=state.handoff?.authentication?.mode??'operator_confirmed';
  const authentication={mode,session_preflight_enforced:true,
    ...(mode==='none'?{}:{preflight_url:state.target,preflight_marker:state.auth_marker})};
  return {original:c,case_hash:inputHash,target_origin:new URL(state.target).origin,technical_context,
    pages:state.snapshots.filter(p=>!p.discovery_case_id||(p.discovery_case_id===c.case_id&&(!row.discovery?.job_id||p.discovery_job_id===row.discovery.job_id))),
    ...(row.discovery_memory&&row.discovery_memory.job_id===row.discovery?.job_id?{discovery_memory:row.discovery_memory}:{}),
    authentication,handoff,revision_feedback:row.plan_feedback??[]};
}
