// Rule 13: a workspace id keeps one visitor's state apart from another's. The only server state is the held-request decision.
// The browser sends its id in X-Workspace (default "default"); state is bounded in count and age, so a stranger cannot grow it.
export const WORKSPACE_RE = /^[a-z0-9-]{1,40}$/;
export const DEFAULT_WORKSPACE = 'default';
export const DECISIONS = ['approved', 'declined'];

export function workspaceFrom(req) {
  const raw = req.headers['x-workspace'];
  if (raw === undefined) return DEFAULT_WORKSPACE;
  return typeof raw === 'string' && WORKSPACE_RE.test(raw) ? raw : null;
}

export function createWorkspaces({ max = 500, ttlMs = 60 * 60 * 1000, now = Date.now } = {}) {
  const map = new Map(); // id -> { decision, at }; insertion order = oldest first
  const sweep = () => {
    const t = now();
    for (const [id, v] of map) { if (t - v.at > ttlMs) map.delete(id); else break; }
    while (map.size > max) map.delete(map.keys().next().value);
  };
  return {
    get(id) { sweep(); const v = map.get(id); return { workspace: id, decision: v ? v.decision : null, at: v ? v.at : null }; },
    decide(id, decision) {
      if (!DECISIONS.includes(decision)) throw new RangeError('bad decision');
      map.delete(id); map.set(id, { decision, at: now() }); sweep();
      return this.get(id);
    },
    reset(id) { map.delete(id); },
    size() { return map.size; },
  };
}
