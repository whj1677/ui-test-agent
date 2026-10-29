import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const active = new Set(['QUEUED', 'RUNNING', 'STOPPING']);
const formal = run => run?.schema === 'workbench/candidate-trial-v1' && run.origin === 'EXPLICIT_CANDIDATE_TRIAL' ||
  run?.schema === 'workbench/backend-run-v1' && run.origin === 'HTTP_BACKEND_PLAN' ||
  run?.schema === 'workbench/native-dsh-report-run-v1' && run.origin === 'NATIVE_DSH' && run.recorded_counts_for_case === true;
const known = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const statusOf = item => {
  if (item.kind === 'batch_item') return item.state === 'BLOCKED' ? 'BLOCKED' : item.state === 'CANCELLED' ? 'CANCELLED' : 'NOT_RUN';
  if (active.has(item.execution_status)) return 'RUNNING';
  if (item.execution_status === 'CANCELLED') return 'CANCELLED';
  if (item.execution_status === 'INTERRUPTED') return 'INTERRUPTED';
  if (item.status === 'PASSED') return 'PASSED';
  if (item.status === 'FAILED' || item.status === 'ERROR' || item.status === 'TIMEDOUT' || item.status === 'TIMED_OUT') return 'FAILED';
  return item.status || 'INCOMPLETE';
};
const compare = (a, b) => String(b.started_at || b.created_at || '').localeCompare(String(a.started_at || a.created_at || '')) ||
  String(b.finished_at || '').localeCompare(String(a.finished_at || '')) ||
  String(b.run_id || b.event_id || '').localeCompare(String(a.run_id || a.event_id || ''));

function scopeFor(record) {
  const binding = record.environment_binding || record.environment_identity || {};
  const environment_id = known(binding.environment_id) || known(record.selection?.environment_id) || known(record.environment_id);
  const configuration_sha256 = known(binding.configuration_sha256) || known(binding.site_sha256) || known(binding.site_manifest_sha256) ||
    (binding.configuration && hash(binding.configuration)) || null;
  const role = known(record.auth?.role) || known(binding.role) ||
    (binding.ownership === 'REGISTERED_USER_TARGET' || binding.ownership === 'THIS_RUN_TARGET_SITE' ||
      binding.mode === 'http-json-readonly' && Array.isArray(binding.allowed_headers) && binding.allowed_headers.length === 0 ? '无需登录' : null);
  const software_version = known(record.software_version);
  // A missing field has an independent identity. It cannot imply equality to an
  // explicitly identified target, role, or software build.
  const missingEnvironment = !environment_id;
  let target_url = null;
  try { const url = new URL(binding.normal_url || binding.url || binding.base_url); target_url = `${url.origin}${url.pathname}`; } catch {}
  const identity = { environment_id, configuration_sha256, role, software_version };
  const group_key = 'group-' + hash({ ...identity, unknown_environment: missingEnvironment ? record.run_id || record.event_id : null }).slice(0, 24);
  const environment_name = known(binding.name) || known(binding.configuration?.name);
  const label = `${environment_name || target_url || environment_id || '被测系统未记录'} · ${role || '角色未记录'} · ${software_version || '软件版本未记录'}`;
  return { group_key, label, scope: {...identity,environment_name,target_url} };
}

const currentVersion = testCase => {
  const version=testCase.versions.find(v => v.version === testCase.current_version);
  if(!version)throw Error('REPORT_CURRENT_CASE_VERSION_MISSING');
  return version;
};
export const latestCountsFor = entries => ({
  requested: entries.length,
  executed: entries.filter(e => e.run_id && !['RUNNING', 'NOT_RUN'].includes(e.state)).length,
  passed: entries.filter(e => e.state === 'PASSED').length,
  failed: entries.filter(e => e.state === 'FAILED').length,
  not_run: entries.filter(e => e.state === 'NOT_RUN').length,
  running: entries.filter(e => e.state === 'RUNNING').length,
  incomplete: entries.filter(e => e.state === 'INCOMPLETE' || e.evidence_status === 'INCOMPLETE').length,
  cancelled: entries.filter(e => e.state === 'CANCELLED').length,
  interrupted: entries.filter(e => e.state === 'INTERRUPTED').length,
  blocked: entries.filter(e => e.state === 'BLOCKED').length,
});

export function selectProjectLatest(project, records, batches = [], { group_key = 'all', cutoff_at = new Date().toISOString() } = {}) {
  if (!project || !Array.isArray(project.cases)) throw Error('CASE_PROJECT_NOT_FOUND');
  const events = records.filter(r => formal(r) && r.project_id === project.project_id && r.run_id && r.executed_case_id &&
    String(r.started_at || r.created_at || '') <= cutoff_at);
  for (const batch of batches.filter(b => b.project_id === project.project_id && b.state !== 'PREVIEW' && b.started_at)) {
    for (const [index, item] of (batch.items || []).entries()) {
      if (item.run_id || !['BLOCKED', 'NOT_RUN', 'CANCELLED'].includes(item.state)) continue;
      if(String(batch.started_at)>cutoff_at)continue;
      events.push({kind:'batch_item',event_id:`${batch.batch_id}:${index}`,project_id:batch.project_id,
        executed_case_id:item.case_id,executed_case_version:item.case_version,executed_external_id:item.external_id,
        state:item.state,reason:item.reason,created_at:batch.created_at,started_at:batch.started_at || batch.created_at,
        finished_at:batch.finished_at || null,environment_identity:item.environment_identity,
        selection:item.selection,software_version:batch.software_version,batch_id:batch.batch_id});
    }
  }
  const grouped = new Map();
  for (const event of events) {
    const group = scopeFor(event);
    if (!grouped.has(group.group_key)) grouped.set(group.group_key, {...group, events:[]});
    const stored=grouped.get(group.group_key);
    stored.events.push(event);
    const time=known(event.started_at)||known(event.created_at);
    if(time){
      stored.scope.tested_from=!stored.scope.tested_from||time<stored.scope.tested_from?time:stored.scope.tested_from;
      stored.scope.tested_to=!stored.scope.tested_to||time>stored.scope.tested_to?time:stored.scope.tested_to;
    }
  }
  if (!grouped.size) grouped.set('group-unrecorded', {group_key:'group-unrecorded',label:'未记录被测范围 · 尚无正式执行',scope:{environment_id:null,configuration_sha256:null,role:null,software_version:null,environment_name:null,target_url:null},events:[]});
  const entryForCase=(testCase,pool)=>{
    const version=currentVersion(testCase);
    const history=pool.filter(e=>e.executed_case_id===testCase.case_id).sort(compare);
    const matching=history.filter(e=>e.executed_case_version===version.version &&
      (!e.executed_content_sha256 || !version.content_sha256 || e.executed_content_sha256.toLowerCase()===version.content_sha256.toLowerCase()));
    const chosen=matching[0],prior=matching.find(e=>e!==chosen&&e.run_id);
    let state=chosen?statusOf(chosen):'NOT_RUN';
    const evidence_status=chosen?.evidence_status||(chosen?.schema==='workbench/backend-run-v1'&&chosen.http_evidence?'HTTP_REQUEST_RESPONSE_ASSERTIONS':chosen?.kind==='batch_item'?'NOT_COLLECTED':null);
    if(state==='PASSED'&&evidence_status&&!['COMPLETE','HTTP_REQUEST_RESPONSE_ASSERTIONS'].includes(evidence_status))state='INCOMPLETE';
    const reason=chosen?.reason||(!chosen&&history.length?'CURRENT_VERSION_NOT_RUN':!chosen?'NO_FORMAL_RUN':null);
    return {chosen,entry:{case_id:testCase.case_id,external_id:version.content.external_id,title:version.content.title,
      case_type:['UI','BACKEND'].includes(version.content.case_type)?version.content.case_type:'UNCLASSIFIED',case_version:version.version,content_sha256:version.content_sha256,
      run_id:chosen?.run_id||null,batch_id:chosen?.batch_id||null,started_at:chosen?.started_at||null,
      finished_at:chosen?.finished_at||null,state,result:chosen?.status||state,evidence_status,
      reason,retest_count:Math.max(0,matching.filter(e=>e.run_id).length-1),previous_run_id:prior?.run_id||null,
      event_id:chosen?.event_id||null}};
  };
  let groups;
  if(group_key==='latest_per_case'){
    const selected=new Map();
    const unexecuted={group_key:'group-unexecuted',label:'当前版本未执行',scope:{environment_id:null,configuration_sha256:null,role:null,software_version:null,environment_name:null,target_url:null}};
    for(const testCase of project.cases){
      const {chosen,entry}=entryForCase(testCase,events);
      const scope=chosen?scopeFor(chosen):unexecuted;
      if(chosen)scope.scope={...scope.scope,...grouped.get(scope.group_key)?.scope};
      if(!selected.has(scope.group_key))selected.set(scope.group_key,{...scope,entries:[]});
      selected.get(scope.group_key).entries.push(entry);
    }
    groups=[...selected.values()].map(group=>({...group,counts:latestCountsFor(group.entries)}));
  }else{
    if(group_key!=='all'&&!grouped.has(group_key))throw Error('REPORT_GROUP_NOT_FOUND');
    const selectedGroups=[...grouped.values()].filter(g=>group_key==='all'||g.group_key===group_key);
    groups=selectedGroups.map(group=>{
      const entries=project.cases.map(testCase=>entryForCase(testCase,group.events).entry);
      return {group_key:group.group_key,label:group.label,scope:group.scope,counts:latestCountsFor(entries),entries};
    });
  }
  const allEntries = groups.flatMap(g => g.entries);
  const overall = {...latestCountsFor(allEntries),count_unit:'CASE_SCOPE'};
  return {project_id:project.project_id,project_name:project.name,created_at:cutoff_at,cutoff_at,
    case_count:project.cases.length,entry_count:allEntries.length,group_key,
    group_options:[{group_key:'latest_per_case',label:'每个用例最新结果',scope:null},
      {group_key:'all',label:'所有历史范围展开（含重复用例）',scope:null},
      ...[...grouped.values()].map(({group_key,label,scope})=>({group_key,label,scope}))],
    groups,counts:overall};
}
