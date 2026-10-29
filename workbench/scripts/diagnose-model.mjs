// Read-only support output. Never opens/decrypts a Key, starts a service or
// contacts a model or business target.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {applicationRoot,privateRuntimeHome,readJson,optionalStat} from './native-runtime.mjs';
import {locateModelCredential} from '../server/model-credential-storage.mjs';
import {savedModelOptIn} from './native-entry.mjs';

export async function modelDiagnostics({root=applicationRoot,environment=process.env,fetchHealth=async()=>{
  const response=await fetch('http://127.0.0.1:4322/api/health',{signal:AbortSignal.timeout(3000),redirect:'error'});
  if(!response.ok)throw Error('HEALTH_HTTP_ERROR');
  return response.json();
}}={}) {
  const result={schema:'workbench/model-startup-diagnostic-v1',read_only:true,model_requests:0};
  result.package_version=(await readJson(path.join(root,'workbench/release.json'))).version;
  try {result.saved_key=Boolean(await locateModelCredential({environment}));}catch {result.saved_key='CHECK_FAILED';}
  try {
    const runtimeHome=privateRuntimeHome(environment);
    result.explicit_model_opt_in=await savedModelOptIn(runtimeHome);
    const profile=(await readJson(path.join(runtimeHome,'config/start-workbench.json'))).profiles?.['fresh-b'];
    result.harness_profile_exists=Boolean(profile?.WORKBENCH_DSH_HOME && await optionalStat(path.join(profile.WORKBENCH_DSH_HOME,'profiles/headless/package.json')));
    result.model_patch_exists=Boolean(profile?.WORKBENCH_HARNESS_PATCH && await optionalStat(profile.WORKBENCH_HARNESS_PATCH));
  } catch {result.runtime_configuration='MISSING_OR_INVALID';}
  try {
    const health=await fetchHealth();
    const expected=createHash('sha256').update(path.join(path.resolve(root),'workbench/.local/fresh25-b')).digest('hex');
    result.service={recognized:health.service==='approved-test-workbench',status:health.status,
      same_program_directory:health.service_identity?.data_root_sha256===expected,
      version:health.service_identity?.release?.version,assistant_available:health.case_assistant?.available===true,
      native_dsh_state:health.native_dsh?.runtime?.runtime?.state,
      active:Boolean(health.preparing || health.active_run_id || health.active_build_task_id || health.active_batch_id || health.active_script_operation_id || health.active_demonstration_id || health.case_assistant?.active_turn_id || health.case_assistant?.starting || health.requirements?.active || health.backend || health.native_dsh?.active_task_id)};
  } catch {result.service={status:'UNREACHABLE'};}
  if(result.service.recognized && !result.service.same_program_directory)result.next_step='4322由另一份程序目录提供服务。请核对原启动窗口和程序目录，不要结束未知进程。';
  else if(result.service.assistant_available)result.next_step='服务端助手当前可用。请刷新页面后重新进入 AI 用例助手；若仍不可用，请保留本诊断结果。';
  else if(result.service.active)result.next_step='当前仍有运行任务，请等待任务结束。';
  else result.next_step='先配置模型密钥；工作台已运行时正常停止，然后运行“启用模型工作台.cmd”。保存密钥不会改变已运行实例的模式。';
  return result;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  modelDiagnostics().then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{
    console.error('MODEL_DIAGNOSTIC_FAILED：诊断未完成，请保留此窗口。');process.exitCode=1;
  });
}
