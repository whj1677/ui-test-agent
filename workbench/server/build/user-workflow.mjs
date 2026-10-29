import { DEVELOPMENT_LIMITS } from './development-session.mjs';
import { resolveDemonstrationEnvironment } from '../demonstration-environment.mjs';

export const USER_GENERATION_LIMITS = Object.freeze({ ...DEVELOPMENT_LIMITS, harness_starts: 1 });

export function managedDevelopmentTarget(manager, environment) {
  const target = manager.candidateTrialEnvironments?.find(e => e.id === environment?.id);
  return environment?.validation_mode === 'normal-only' && target?.configurationIdentity?.kind === 'registered-static-html' ? target : null;
}

export function developmentAuthScope(manager, environment, projectId) {
  const requirement = environment?.auth_requirement;
  if (!requirement) return null;
  if (!manager.authSessions || !projectId ||
      !/^[\w-]+$/.test(requirement.environment_id || '') ||
      !/^[\w-]+$/.test(requirement.role || '') ||
      environment.validation_mode !== 'normal-only' ||
      environment.id !== requirement.environment_id) throw Error('DEVELOPMENT_AUTH_ENVIRONMENT_INVALID');
  const scope = { project_id: projectId, environment_id: requirement.environment_id, role: requirement.role };
  const registered = manager.authSessions.environment(scope);
  let entry;
  try { entry = new URL(environment.normal_url); } catch { throw Error('DEVELOPMENT_AUTH_ENVIRONMENT_INVALID'); }
  if (entry.origin !== registered.origin || entry.username || entry.password || entry.hash) throw Error('DEVELOPMENT_AUTH_ENVIRONMENT_INVALID');
  return scope;
}

export async function checkDevelopmentEnvironment(manager, environment, projectId = null, { checkBinding = true } = {}) {
  if (checkBinding && manager.projectEnvironments) await manager.projectEnvironments.assert(projectId, 'ui', environment?.id);
  if (!environment) throw Error('GENERATION_ENVIRONMENT_NOT_READY');
  if (environment.user_registered_target === true) {
    if (!projectId || environment.project_id !== projectId || !environment.target_scope?.origin || !environment.target_scope?.path_prefix) throw Error('PROJECT_TARGET_SCOPE_INVALID');
    const trial = manager.candidateTrialEnvironments.find(item => item.id === environment.id);
    if (!trial || trial.configurationIdentity?.kind !== (environment.auth_requirement ? 'registered-auth-target' : 'registered-user-target') ||
        trial.configurationIdentity.origin !== environment.target_scope.origin ||
        trial.configurationIdentity.path_prefix !== environment.target_scope.path_prefix) throw Error('PROJECT_TARGET_CONFIGURATION_CHANGED');
    await trial.check();
    if (environment.auth_requirement) {
      const scope = developmentAuthScope(manager, environment, projectId);
      if (checkBinding && (await manager.authSessions.check(scope)).status !== 'VALID') throw Error('AUTH_SESSION_REQUIRED');
      return { preparation: 'REGISTERED_AUTH_TARGET', entry: environment.normal_url, origin: environment.target_scope.origin,
        path_prefix: environment.target_scope.path_prefix, auth_required: true, auth_role: scope.role, auth_environment_id: scope.environment_id };
    }
    return { preparation: 'REGISTERED_USER_TARGET', entry: environment.normal_url,
      origin: environment.target_scope.origin, path_prefix: environment.target_scope.path_prefix, auth_required: false };
  }
  if (environment.auth_requirement) {
    // Catalog validation is independent of login. Preflight with a project also
    // requires a currently verified in-memory session; no anonymous probe runs.
    const scope = developmentAuthScope(manager, environment, projectId || 'project-preflight');
    if (projectId) {
      const status = await manager.authSessions.check(scope);
      if (status.status !== 'VALID') throw Error('AUTH_SESSION_REQUIRED');
    }
    return { preparation: 'REGISTERED_AUTH_TARGET', entry: environment.normal_url,
      auth_required: true, auth_role: scope.role, auth_environment_id: scope.environment_id };
  }
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

export async function scriptEnvironments(manager, projectId = null, { catalog = false } = {}) {
  const binding = manager.projectEnvironments && projectId ? await manager.projectEnvironments.binding(projectId) : null;
  const eligible = manager.developmentEnvironments.filter(env => (!env.user_registered_target || env.project_id === projectId) &&
    (catalog || !manager.projectEnvironments || env.id === binding?.ui_environment_id));
  const environments = await Promise.all(eligible.map(async env => {
    let readiness;
    try {
      if (!catalog && binding) await manager.projectEnvironments.assert(projectId, 'ui', env.id);
      readiness = { ready: true, ...await checkDevelopmentEnvironment(manager, env, env.user_registered_target ? projectId : null, { checkBinding: false }) };
    }
    catch (error) { readiness = { ready: false, reason: error.message }; }
    let demonstration = null;
    if (projectId && (env.user_registered_target || env.auth_requirement)) {
      try { demonstration = await resolveDemonstrationEnvironment(manager, projectId, env.id); }
      catch { /* Catalog validity is reported by demonstration_ready, never as a login assertion. */ }
    }
    const automatic = Boolean(managedDevelopmentTarget(manager, env));
    return { id: env.id, name: env.name || (automatic ? '本机被测应用 · ' : '已登记测试系统 · ') + env.id,
      entry_url: automatic ? null : env.normal_url || null,
      source: env.user_registered_target ? 'PROJECT_UI_REGISTRATION' : automatic ? 'LOCAL_AUTO_PREPARATION' : 'STARTUP_CONFIGURATION',
      ...(env.user_registered_target ? { operator: env.operator || null, registered_at: env.registered_at || null } : {}),
      validation_mode: env.validation_mode || 'paired', browser: '每次独立启动测试浏览器（后台无窗口）',
      ...(env.user_registered_target ? { user_registered_target: true, target_scope: env.target_scope,
        configuration_sha256: env.configuration_sha256 } : {}),
      ...(env.auth_requirement ? { auth_required: true, auth_role: env.auth_requirement.role } : {}),
      demonstration_ready: Boolean(demonstration && (demonstration.auth_required || readiness.ready)),
      ...(demonstration ? { demonstration_configuration_sha256: demonstration.configuration_sha256 } : {}),
      ...readiness };
  }));
  return { generation_disabled: manager.generationDisabled, user_initiated_operations: manager.userInitiatedOperations === true, environments,
    ...(manager.projectEnvironments ? { project_environment_required: true, environment_binding: binding } : {}) };
}
