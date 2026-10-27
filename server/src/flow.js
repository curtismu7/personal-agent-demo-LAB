// Builds the story with the cast filled in. customer.config.json (optional, git-ignored) overrides the cast.
import fs from 'node:fs';
import { scanHosts } from './safety.js';
import { DETAILS, HOPS, PAYLOADS, SOURCE } from './flowData.js';

export const DEFAULT_CAST = { brand: 'Northwind Health', program: 'Northwind Health', host: 'northwind' };
const TOKEN = /\{\{(\w+)\}\}/g;
const MAX_CAST = 40;
const MESSAGE = /^\s*\w+--?>>\w+:/;

export const messageCount = (source) => source.split('\n').filter((l) => MESSAGE.test(l)).length;
export const unfilled = (text, cast) => [...String(text).matchAll(TOKEN)].map((m) => m[1]).filter((k) => !(k in cast));
const fill = (text, cast) => String(text).replace(TOKEN, (m, k) => (k in cast ? cast[k] : m));

// Only brand, program and host, as plain short strings; anything else in the file is ignored.
export function loadCast(file) {
  const cast = { ...DEFAULT_CAST };
  if (!file) return cast;
  try {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const k of Object.keys(DEFAULT_CAST)) {
      const v = cfg?.cast?.[k];
      if (typeof v !== 'string' || !v.trim()) continue;
      const clean = v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, MAX_CAST);
      // A display name is not a URL: anything that names a host or an address keeps the default.
      if (/:\/\/|@/.test(clean) || scanHosts(clean).length) continue;
      cast[k] = k === 'host' ? clean.toLowerCase() : clean;
    }
    if (!/^[a-z0-9-]{1,30}$/.test(cast.host)) cast.host = DEFAULT_CAST.host;
  } catch { /* no file or not JSON: the defaults */ }
  return cast;
}

export function rawStory() { return { source: SOURCE, payloads: PAYLOADS, details: DETAILS, hops: HOPS }; }

export function buildFlow(cast = DEFAULT_CAST) {
  return {
    title: fill("How an AI assistant reaches {{brand}}'s member benefits", cast),
    intro: fill("Twelve steps: the assistant discovers {{brand}}'s MCP gateway, finds the sign-in service, is identified by its client metadata, the member consents, the assistant proves itself with a signed assertion, and the gateway asks a policy engine before it calls the benefits API. The assistant never holds the member's credentials.", cast),
    cast,
    source: fill(SOURCE, cast),
    payloads: PAYLOADS.map((p) => (p === null ? null : fill(p, cast))),
    details: Object.fromEntries(Object.entries(DETAILS).map(([k, v]) => [k, fill(v, cast)])),
    hops: HOPS.map((h) => ({ ...h, say: fill(h.say, cast) })),
  };
}
