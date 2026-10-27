import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaces, workspaceFrom } from '../src/workspaces.js';
import { withServer } from './helpers.js';

const post = (url, path, body, ws) => fetch(`${url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: url.replace(/\/$/, ''), ...(ws ? { 'x-workspace': ws } : {}) }, body: JSON.stringify(body) });
const get = (url, path, ws) => fetch(`${url}${path}`, { headers: ws ? { 'x-workspace': ws } : {} });

test('rule 13: one workspace\'s decision and Reset never touch another\'s', async () => {
  await withServer(async (url) => {
    assert.equal((await (await get(url, '/api/hold', 'w-a')).json()).decision, null);
    assert.equal((await (await post(url, '/api/hold/decision', { decision: 'approved' }, 'w-a')).json()).decision, 'approved');
    assert.equal((await (await post(url, '/api/hold/decision', { decision: 'declined' }, 'w-b')).json()).decision, 'declined');
    assert.equal((await (await get(url, '/api/hold', 'w-a')).json()).decision, 'approved');
    assert.equal((await (await get(url, '/api/hold', 'w-b')).json()).decision, 'declined');
    assert.equal((await (await post(url, '/api/reset', {}, 'w-a')).json()).workspace, 'w-a');
    assert.equal((await (await get(url, '/api/hold', 'w-a')).json()).decision, null);
    assert.equal((await (await get(url, '/api/hold', 'w-b')).json()).decision, 'declined', 'w-b survived w-a\'s Reset');
    assert.equal((await (await get(url, '/api/hold')).json()).workspace, 'default');
  });
});

test('a bad workspace id or decision is refused with short JSON, never defaulted', async () => {
  await withServer(async (url) => {
    for (const ws of ['UPPER', 'a'.repeat(41), 'has space', '../x', 'a;b']) {
      const r = await get(url, '/api/hold', ws);
      assert.equal(r.status, 400, ws);
      assert.deepEqual(await r.json(), { error: 'bad_workspace' });
    }
    for (const decision of ['maybe', '', null, 5, { x: 1 }]) assert.equal((await post(url, '/api/hold/decision', { decision }, 'w-a')).status, 400);
    assert.equal((await post(url, '/api/hold/decision', {}, 'w-a')).status, 400);
  });
});

test('the store is bounded in count and age', () => {
  let t = 0;
  const w = createWorkspaces({ max: 3, ttlMs: 1000, now: () => t });
  for (const id of ['a', 'b', 'c', 'd']) w.decide(id, 'approved');
  assert.equal(w.size(), 3);
  assert.equal(w.get('a').decision, null, 'the oldest was dropped');
  t = 5000;
  assert.equal(w.get('d').decision, null, 'an expired decision is gone');
  assert.equal(w.size(), 0);
  assert.throws(() => w.decide('x', 'nope'), RangeError);
});

test('workspaceFrom: default when absent, null when invalid', () => {
  assert.equal(workspaceFrom({ headers: {} }), 'default');
  assert.equal(workspaceFrom({ headers: { 'x-workspace': 'ok-1' } }), 'ok-1');
  assert.equal(workspaceFrom({ headers: { 'x-workspace': 'Bad' } }), null);
});
