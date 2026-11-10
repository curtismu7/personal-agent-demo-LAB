import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CAST, buildFlow, loadCast, messageCount, rawStory, unfilled } from '../src/flow.js';
import { scanHosts, scanKeys } from '../src/safety.js';

test('the story has one payload slot per message and the 12 steps cover every message once, in order', () => {
  const r = rawStory();
  const n = messageCount(r.source);
  assert.equal(n, 28);
  assert.equal(r.payloads.length, n);
  let next = 0;
  for (const h of r.hops) { assert.equal(h.first, next); assert.ok(h.last >= h.first); next = h.last + 1; }
  assert.equal(next, n);
});

test('every {{token}} in the story is in the default cast, and no host or key is real', () => {
  const r = rawStory();
  const all = [r.source, ...r.payloads.filter(Boolean), ...Object.values(r.details), ...r.hops.map((h) => h.say)].join('\n');
  assert.deepEqual(unfilled(all, DEFAULT_CAST), []);
  const filled = JSON.stringify(buildFlow(DEFAULT_CAST));
  assert.deepEqual(scanHosts(filled), []);
  assert.deepEqual(scanKeys(filled), []);
  assert.ok(!/\{\{/.test(filled), 'no token left unfilled');
});

test('the default story names no real company or customer', () => {
  const filled = JSON.stringify(buildFlow(DEFAULT_CAST)).toLowerCase();
  for (const word of ['united', 'mileageplus', 'datapower', 'optum', 'uhg', 'unitedhealth']) assert.ok(!filled.includes(word), word);
});

test('customer.config.json changes the cast; bad values fall back, extra keys are ignored', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'door-'));
  const file = path.join(dir, 'customer.config.json');
  fs.writeFileSync(file, JSON.stringify({ cast: { brand: 'Skyline Air', program: 'Skyline Club', host: 'Bad Host!' }, secret: 'x' }));
  const cast = loadCast(file);
  assert.equal(cast.brand, 'Skyline Air');
  assert.equal(cast.program, 'Skyline Club');
  assert.equal(cast.host, DEFAULT_CAST.host);
  assert.ok(buildFlow(cast).source.includes('Skyline Air MCP gateway'));
  assert.deepEqual(loadCast(path.join(dir, 'missing.json')), DEFAULT_CAST);
  fs.writeFileSync(file, 'not json');
  assert.deepEqual(loadCast(file), DEFAULT_CAST);
});

test('the access token payload is decoded JSON with sub, aud, scope and client_id, and says MOCK', () => {
  const tok = buildFlow().payloads.find((p) => p && p.startsWith('Token response'));
  for (const k of ['"sub"', '"aud"', '"scope"', '"client_id"', 'MOCK']) assert.ok(tok.includes(k), k);
  const body = tok.slice(tok.indexOf('\n') + 1);
  assert.doesNotThrow(() => JSON.parse(body), 'the payload body is valid JSON');
});

test('the story follows the twelve steps in order, from the 401 to the explained result', () => {
  const f = buildFlow();
  assert.deepEqual(f.hops.map((h) => h.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(f.hops[0].title, 'Protected tool request');
  assert.equal(f.hops[11].title, 'Authorized result');
  assert.match(f.payloads[2], /401 Unauthorized/);
});

test('customer values are length-capped and stripped of control characters', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'door-'));
  const file = path.join(dir, 'customer.config.json');
  fs.writeFileSync(file, JSON.stringify({ cast: { brand: 'A'.repeat(10_000), program: 'Club\u0000\u0007\u001bX' } }));
  const cast = loadCast(file);
  assert.equal(cast.brand.length, 40);
  assert.equal(cast.program, 'Club   X');
});

test('a customer value that names a URL, host, address or email keeps the default', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'door-'));
  const file = path.join(dir, 'customer.config.json');
  for (const brand of ['https://evil.com/x Corp', 'http://10.1.2.3/a', 'ops@evil.com', 'Air ftp://x.invalid/a']) {
    fs.writeFileSync(file, JSON.stringify({ cast: { brand } }));
    assert.equal(loadCast(file).brand, DEFAULT_CAST.brand, brand);
  }
  fs.writeFileSync(file, JSON.stringify({ cast: { brand: 'Skyline Air' } }));
  assert.equal(loadCast(file).brand, 'Skyline Air');
});

test('the host is lower-cased, and an invalid one falls back to the default', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'door-'));
  const file = path.join(dir, 'customer.config.json');
  fs.writeFileSync(file, JSON.stringify({ cast: { host: 'NorthWest' } }));
  assert.equal(loadCast(file).host, 'northwest');
  fs.writeFileSync(file, JSON.stringify({ cast: { host: 'North.West' } }));
  assert.equal(loadCast(file).host, DEFAULT_CAST.host);
});

test('the pattern diagram, both paths: every step joins two known nodes, and no host or key is real', async () => {
  const { buildPattern, PATHS } = await import('../src/patternData.js');
  for (const { id } of PATHS) {
    const P = buildPattern(id);
    const ids = new Set(P.nodes.map((n) => n.id));
    assert.equal(ids.size, P.nodes.length);
    for (const s of P.steps) { assert.ok(ids.has(s.from) && ids.has(s.to), `${id} ${s.from}->${s.to}`); assert.ok(s.say && s.label); }
    const all = JSON.stringify(P);
    assert.deepEqual(scanHosts(all), []);
    assert.deepEqual(scanKeys(all), []);
  }
  assert.ok(buildPattern('privilege').steps.some((s) => /coming soon/.test(s.label)));
  assert.ok(buildPattern('ig').steps.some((s) => s.label === 'Token exchange (OBO)'));
});

test('the discovery payloads use the RFC 9728 path-suffixed well-known URL and the authorize request carries a code_challenge', () => {
  const f = buildFlow();
  assert.match(f.payloads[2], /oauth-protected-resource\/mcp/);
  assert.match(f.payloads[3], /oauth-protected-resource\/mcp/);
  assert.match(f.payloads[8], /code_challenge_method: S256/);
});

test('rule 17: the Pattern diagrams are diagram-studio/1 data files that pass the studio validator, and each step is one edge', async () => {
  const fs = await import('node:fs');
  const { validateDiagram } = await import('../src/diagramStudioValidate.js');
  const { PATHS } = await import('../src/patternData.js');
  for (const p of PATHS) {
    const doc = JSON.parse(fs.readFileSync(new URL(`../diagrams/personal-agent-pattern-${p.id}.json`, import.meta.url), 'utf8'));
    assert.equal(doc.schema, 'diagram-studio/1');
    assert.deepEqual(validateDiagram(doc), []);
    assert.equal(doc.steps.length, doc.edges.length);
    doc.steps.forEach((s, i) => assert.deepEqual(s.edges, [i]));
  }
  const bad = { schema: 'diagram-studio/1', id: 'x', title: 't', groups: { a: { label: 'A', color: 'red' } }, nodes: [{ id: 'n', label: 'N', group: 'zzz', x: 0, y: 0 }], edges: [] };
  assert.ok(validateDiagram(bad).length > 0, 'the vendored validator really rejects a bad diagram');
});

test('PingOne Protect is a participant and its two messages sit inside step 6, with payloads, and the steps stay twelve', () => {
  const r = rawStory();
  assert.match(r.source, /participant R as Risk engine\\nPingOne Protect/);
  assert.ok(r.details.R && /UNVERIFIED/.test(r.details.R), 'reel detail for Protect, with the claim labelled');
  const lines = r.source.split('\n');
  const note = lines.findIndex((l) => /Note over .*Step 6/.test(l));
  const end = lines.findIndex((l, i) => i > note && l.trim() === 'end');
  const block = lines.slice(note, end);
  assert.ok(block.some((l) => /I->>R:/.test(l)), 'request to Protect inside step 6');
  assert.ok(block.some((l) => /R-->>I:/.test(l)), 'risk level back inside step 6');
  assert.ok(!lines.some((l, i) => (i < note || i > end) && /\bR\b\s*-?-?>>|>>R:/.test(l)), 'Protect appears only in step 6');
  const f = buildFlow();
  assert.equal(f.hops.length, 12);
  const six = f.hops[5];
  assert.match(six.title, /risk evaluation/);
  assert.match(six.say, /PingOne Protect/);
  assert.equal(six.last - six.first + 1, 6, 'step 6 now covers six messages');
  const slice = f.payloads.slice(six.first, six.last + 1).join('\n');
  assert.match(slice, /Protect request \(STUB\)/);
  assert.match(slice, /Protect result \(STUB\)/);
  assert.match(slice, /"level": "LOW"/);
  });

test('the Protect agent-type claim is always labelled UNVERIFIED and no Protect text names a real host', () => {
  const f = buildFlow();
  const protectText = [f.details.R, ...f.payloads.filter((p) => p && /Protect (request|result)/.test(p)), f.hops[5].say];
  for (const t of protectText) assert.ok(/UNVERIFIED|STUB/.test(t), t.slice(0, 40));
  assert.ok(/agent_type/.test(f.payloads.join('\n')) && /UNVERIFIED/.test(f.payloads.join('\n')));
  assert.deepEqual(scanHosts(protectText.join('\n')), []);
});
