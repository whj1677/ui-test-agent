import { DEVELOPMENT_LIMITS } from './development-session.mjs';

export const USER_GENERATION_LIMITS = Object.freeze({ ...DEVELOPMENT_LIMITS, harness_starts: 1 });

export function managedDevelopmentTarget(manager, environment) {
  const target = manager.candidateTrialEnvironments?.find(e => e.id === environment?.id);
  return environment?.validation_mode === 'normal-only' && target?.configurationIdentity?.kind === 'registered-static-html' ? target : null;
}

export async function checkDevelopmentEnvironment(manager, environment) {
  if (!environment) throw Error('GENERATION_ENVIRONMENT_NOT_READY');
  const managed = managedDevelopmentTarget(manager, environment);
  if (managed) { await managed.check(); return { preparation: 'AUTO_START_ISOLATED_TARGET', entry: '运行时自动准备本机被测页面' }; }
  const urls = [environment.normal_url, environment.fault_url, environment.semantic_url].filter(Boolean);
  if (!urls.length) throw Error('GENERATION_ENVIRONMENT_NOT_READY');
  for (const value of urls) {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) throw Error('DEVELOPMENT_ENVIRONMENT_NOT_LOCAL');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: 'error' });
      await response.body?.cancel();
      if (!response.ok) throw Error('unavailable');
    } catch { throw Error('GENERATION_TARGET_UNREACHABLE'); }
  }
  return { preparation: 'EXISTING_TARGET_READY', entry: environment.normal_url };
}

export async function scriptEnvironments(manager) {
  const environments = await Promise.all(manager.developmentEnvironments.map(async env => {
    let readiness;
    try { readiness = { ready: true, ...await checkDevelopmentEnvironment(manager, env) }; }
    catch (error) { readiness = { ready: false, reason: error.message }; }
    return { id: env.id, name: env.name || (managedDevelopmentTarget(manager, env) ? '本机被测应用 · ' : '已登记测试系统 · ') + env.id,
      validation_mode: env.validation_mode || 'paired', browser: '每次独立启动测试浏览器（后台无窗口）', ...readiness };
  }));
  return { generation_disabled: manager.generationDisabled, user_initiated_operations: manager.userInitiatedOperations === true, environments };
}
