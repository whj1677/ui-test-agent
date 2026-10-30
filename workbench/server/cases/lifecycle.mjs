import { validCaseId } from './store.mjs';

// Keep the complete original case outside the active collection. Execution
// admission already resolves cases from that collection; no files are removed.
export async function changeCaseLifecycle(store, projectId, body, { restore = false } = {}) {
  const items = body?.items;
  if (!Number.isInteger(body?.revision) || body[restore ? 'confirm_restore' : 'confirm_delete'] !== true ||
      !Array.isArray(items) || !items.length || items.length > 200 ||
      items.some(item => !validCaseId(item?.case_id) || !Number.isInteger(item.case_version) || item.case_version < 1 ||
        !/^[a-f0-9]{64}$/i.test(item.content_sha256 || '')) ||
      new Set(items.map(item => item.case_id)).size !== items.length) throw Error('CASE_LIFECYCLE_REQUEST_INVALID');

  return store.updateProject(projectId, body.revision, project => {
    const source = restore ? (project.deleted_cases || []) : project.cases;
    const targets = items.map(input => {
      const item = source.find(row => row.case_id === input.case_id);
      if (!item) throw Error('CASE_LIFECYCLE_NOT_FOUND');
      const version = item.versions.find(row => row.version === item.current_version);
      if (item.current_version !== input.case_version || version?.content_sha256 !== input.content_sha256)
        throw Error('CASE_LIFECYCLE_CONFLICT');
      if (restore && project.cases.some(row => row.case_id === item.case_id)) throw Error('CASE_LIFECYCLE_CONFLICT');
      return item;
    });
    const ids = new Set(targets.map(item => item.case_id));
    if (restore) {
      project.deleted_cases = source.filter(item => !ids.has(item.case_id));
      project.cases.push(...targets.map(({ deletion, ...item }) => item));
    } else {
      const deleted_at = new Date().toISOString();
      project.cases = source.filter(item => !ids.has(item.case_id));
      project.deleted_cases = [...(project.deleted_cases || []), ...targets.map(item => ({ ...item, deletion: { deleted_at } }))];
    }
    return project;
  });
}
