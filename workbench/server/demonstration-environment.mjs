import { createHash } from 'node:crypto';

const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();

// Only catalogued targets may be demonstrated. This object is public routing
// metadata; authentication state stays exclusively in TargetAuthSessions.
export async function resolveDemonstrationEnvironment(manager, projectId, environmentId) {
  await manager.projectEnvironments?.assert(projectId, 'ui', environmentId);
  const registered = await manager.projectTargetAccess?.get(projectId, environmentId).catch(error => {
    if (error.message === 'PROJECT_TARGET_NOT_FOUND') return null;
    throw error;
  });
  if (registered) {
    if (registered.project_id !== projectId || registered.environment_id !== environmentId ||
      !registered.configuration_sha256 || !registered.origin || !registered.path_prefix || !registered.entry_url)
      throw Error('DEMONSTRATION_REGISTERED_TARGET_REQUIRED');
    if (registered.login_required) {
      const auth_scope = { project_id: projectId, environment_id: environmentId, role: registered.role };
      manager.authSessions.environment(auth_scope);
      return { ...registered, auth_required: true, auth_scope };
    }
    return { ...registered, auth_required: false };
  }
  const environment = manager.developmentEnvironments?.find(item => item.id === environmentId);
  const requirement = environment?.auth_requirement;
  if (!environment || !requirement || !manager.authSessions ||
    environment.validation_mode !== 'normal-only' || requirement.environment_id !== environmentId ||
    typeof requirement.role !== 'string' || !requirement.role) throw Error('DEMONSTRATION_REGISTERED_TARGET_REQUIRED');
  const auth_scope = { project_id: projectId, environment_id: environmentId, role: requirement.role };
  const catalog = manager.authSessions.environment(auth_scope);
  let entry;
  try { entry = new URL(environment.normal_url); } catch { throw Error('DEMONSTRATION_AUTH_TARGET_INVALID'); }
  if (entry.origin !== catalog.origin || entry.username || entry.password || entry.hash ||
    !['http:', 'https:'].includes(entry.protocol)) throw Error('DEMONSTRATION_AUTH_TARGET_INVALID');
  const identity = { kind: 'registered-auth-target', project_id: projectId, environment_id: environmentId,
    entry_url: entry.href, origin: catalog.origin, role: requirement.role,
    login_url: catalog.login_url, identity_url: catalog.identity_url,
    session_termination_endpoints: catalog.session_termination_endpoints || [] };
  return { project_id: projectId, environment_id: environmentId, entry_url: entry.href,
    origin: catalog.origin, path_prefix: '/', auth_required: true, auth_scope,
    role: requirement.role, configuration_sha256: sha256(identity) };
}
