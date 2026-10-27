// The Personal Agent Pattern: who talks to whom, and which part of the Ping Agentic Control Plane decides at each hop.
// The diagrams are DATA in the diagram-studio/1 format (server/diagrams/*.json, loaded by name and checked with the studio's own
// validator); nothing here builds nodes or edges by hand. Each step is one edge, walked in order by Simulate. A step may carry
// an optional `payload` (mock token JSON), an extension the studio ignores. Mock only; hosts are .example.
import fs from 'node:fs';
import { validateDiagram } from './diagramStudioValidate.js';

const DIR = new URL('../diagrams/', import.meta.url);
export const PATHS = [{ id: 'privilege', label: 'Agent Privilege' }, { id: 'ig', label: 'Agent Gateway (IG)' }];

const load = (name) => {
  const doc = JSON.parse(fs.readFileSync(new URL(`${name}.json`, DIR), 'utf8'));
  const problems = validateDiagram(doc);
  if (problems.length) throw new Error(`diagram ${name} is not valid diagram-studio/1: ${problems.join('; ')}`);
  return doc;
};
const DOCS = Object.fromEntries(PATHS.map((p) => [p.id, load(`personal-agent-pattern-${p.id}`)]));

// A studio group becomes a box style; the two control-plane lanes keep their own look.
const kindOf = (group) => (group === 'iam' || group === 'authz' ? `lane-${group}` : group);

export function diagramNames() { return PATHS.map((p) => `personal-agent-pattern-${p.id}`); }

export function buildPattern(path = 'privilege') {
  const d = DOCS[path] || DOCS.privilege;
  return {
    title: d.title,
    intro: d.lede,
    paths: PATHS,
    nodes: d.nodes.map((n) => ({ id: n.id, label: n.label, kind: kindOf(n.group), x: n.x, y: n.y })),
    steps: d.steps.map((s) => {
      const e = d.edges[s.edges[0]];
      return { from: e.source, to: e.target, label: s.title, say: s.what, payload: s.payload ?? null };
    }),
  };
}
