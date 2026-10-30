// One project scope follows the user through the case library and DSH pages.
// Session storage survives refresh without sharing a selection between tabs.
const projects = new Map();
export function selectionRouteIdentity(hash) {
  const [route, search = ''] = hash.split('?');
  if (!/^#\/projects\/[^/]+(?:\/cases|\/native-dsh)?$/.test(route)) return hash;
  const query = new URLSearchParams(search); query.delete('selected');
  return `${route}?${query}`;
}
class SavedSelection extends Set {
  constructor(key, values) { super(); this.key = key; for (const id of values) super.add(id); }
  save() {
    try { globalThis.sessionStorage?.setItem(this.key, JSON.stringify([...this])); } catch { /* Memory remains usable. */ }
    if (this.pendingUrl) return;
    this.pendingUrl = true;
    queueMicrotask(() => {
      this.pendingUrl = false;
      const hash = globalThis.location?.hash || '', [route, search = ''] = hash.split('?');
      const base = `#/projects/${encodeURIComponent(this.key.slice('workbench.case-selection.v1.'.length))}`;
      if (![base, base + '/cases', base + '/native-dsh'].includes(route)) return;
      const query = new URLSearchParams(search); query.set('selected', [...this].join(','));
      globalThis.history?.replaceState?.(null, '', `${route}?${query}`);
    });
  }
  add(id) { super.add(id); this.save(); return this; }
  delete(id) { const changed = super.delete(id); if (changed) this.save(); return changed; }
  clear() { super.clear(); this.save(); }
}
export function projectCaseSelection(projectId, cases, query) {
  if (!projects.has(projectId)) {
    const key = `workbench.case-selection.v1.${projectId}`; let ids = [];
    try { const value = JSON.parse(globalThis.sessionStorage?.getItem(key) || '[]'); if (Array.isArray(value)) ids = value.filter(id => typeof id === 'string'); } catch { /* Empty initial scope. */ }
    projects.set(projectId, new SavedSelection(key, ids));
  }
  const selected = projects.get(projectId);
  if (query?.has('selected')) {
    selected.clear(); for (const id of (query.get('selected') || '').split(',').filter(Boolean)) selected.add(id);
  }
  if (cases) { const valid = new Set(cases.map(item => item.case_id)); for (const id of selected) if (!valid.has(id)) selected.delete(id); }
  return selected;
}
