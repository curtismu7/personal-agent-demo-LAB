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
  assert.equal(n, 26);
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
