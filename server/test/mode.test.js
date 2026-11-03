// Rule 19: the Mock/Real toggle. Only MODE=mock exists, so Real is never available and POST /api/mode
// keeps Mock (200), refuses Real (409 with the reason) and rejects malformed bodies (400).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installNetguard } from '../src/netguard.js';
import { withServer } from './helpers.js';

let guard;
before(() => { guard = installNetguard(); });
after(() => { assert.deepEqual(guard.attempts, [], 'the app tried to leave the machine'); guard.restore(); });

const mode = (base, body, raw) => fetch(`${base}/api/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

test('GET /api/info carries the rule 19 fields: source mock, realAvailable false', async () => {
  await withServer(async (base) => {
    const j = await (await fetch(`${base}/api/info`)).json();
    assert.equal(j.source, 'mock'); assert.equal(j.realAvailable, false);
  });
});

test('POST /api/mode keeps Mock and refuses Real with the reason (409)', async () => {
  await withServer(async (base) => {
    const keep = await mode(base, { source: 'mock' });
    assert.equal(keep.status, 200);
    assert.equal((await keep.json()).source, 'mock');
    const real = await mode(base, { source: 'real' });
    assert.equal(real.status, 409);
    assert.match((await real.json()).message, /mock mode only/i);
    assert.equal((await (await fetch(`${base}/api/info`)).json()).source, 'mock');
  });
});

test('POST /api/mode rejects malformed bodies with 400', async () => {
  await withServer(async (base) => {
    for (const body of [{}, { source: 'live' }, { source: 'mock', extra: 1 }, []]) {
      assert.equal((await mode(base, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await mode(base, null, '"mock"')).status, 400);
  });
});
