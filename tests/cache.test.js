import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_TTL_MS, createCacheScope, createCollectionCache, pruneCollectionCache, removeLegacyCollectionCache } from '../src/services/collectionCache.js';

const memoryStorage = () => {
  const entries = new Map();
  return { get length() { return entries.size; }, key: (i) => [...entries.keys()][i],
    getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
};
const scheduler = () => {
  const tasks = new Map(); let nextId = 0;
  return { schedule: (task) => { tasks.set(++nextId, task); return nextId; }, cancel: (id) => tasks.delete(id),
    run: () => { for (const task of tasks.values()) task(); tasks.clear(); }, get size() { return tasks.size; } };
};

test('cached records cannot cross accounts, roles, units, or Firebase projects', () => {
  const storage = memoryStorage(); const queue = scheduler();
  const scope = createCacheScope('cct', 'alice', 'Heads', 'Computer Studies');
  const cache = createCollectionCache({ storage, scope, ...queue });
  cache.write('records', [{ id: 'alice-record' }]); queue.run();
  assert.deepEqual(cache.read('records'), [{ id: 'alice-record' }]);
  for (const other of [createCacheScope('cct', 'bob', 'Heads', 'Computer Studies'),
    createCacheScope('cct', 'alice', 'President', 'Computer Studies'),
    createCacheScope('cct', 'alice', 'Heads', 'Business'), createCacheScope('other', 'alice', 'Heads', 'Computer Studies'), '']) {
    assert.deepEqual(createCollectionCache({ storage, scope: other, ...queue }).read('records'), []);
  }
});

test('writes coalesce and an old account cannot flush after a switch', () => {
  const storage = memoryStorage(); const queue = scheduler();
  const cache = createCollectionCache({ storage, scope: 'alice', ...queue });
  cache.write('records', [{ id: 'old' }]); cache.write('records', [{ id: 'new' }]);
  assert.equal(queue.size, 1); queue.run(); assert.deepEqual(cache.read('records'), [{ id: 'new' }]);
  cache.write('records', [{ id: 'late' }]); cache.dispose({ clear: true }); queue.run();
  assert.equal(storage.length, 0); cache.write('records', [{ id: 'after-sign-out' }]);
  assert.equal(queue.size, 0);
});

test('a verified login removes other-account and previous-role caches from this project', () => {
  const storage = memoryStorage(); const queue = scheduler();
  const scopes = [createCacheScope('cct', 'alice', 'VPAA', 'All'), createCacheScope('cct', 'alice', 'Heads', 'Computing'),
    createCacheScope('cct', 'bob', 'Heads', 'Computing'), createCacheScope('other', 'alice', 'VPAA', 'All')];
  for (const scope of scopes) { const cache = createCollectionCache({ storage, scope, ...queue }); cache.write('records', [{ id: scope }]); }
  queue.run(); pruneCollectionCache(storage, 'cct', scopes[1]);
  assert.equal(storage.length, 2);
  assert.equal(createCollectionCache({ storage, scope: scopes[0], ...queue }).read('records').length, 0);
  assert.equal(createCollectionCache({ storage, scope: scopes[1], ...queue }).read('records').length, 1);
  pruneCollectionCache(storage, 'cct'); assert.equal(storage.length, 1);
});

test('expired and corrupt entries are rejected and cannot become live data', () => {
  const storage = memoryStorage(); const queue = scheduler(); let time = 100;
  const cache = createCollectionCache({ storage, scope: 'alice', now: () => time, ...queue });
  cache.write('records', [{ id: 'old' }]); queue.run();
  time += CACHE_TTL_MS + 1; assert.deepEqual(cache.read('records'), []);
  storage.setItem('cct:collections:v1:alice:records', '{broken'); assert.deepEqual(cache.read('records'), []);
});

test('quota exhaustion and disabled browser storage do not crash the workspace', () => {
  const storage = { getItem() { throw Error('disabled'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('disabled'); } };
  const queue = scheduler(); const cache = createCollectionCache({ storage, scope: 'alice', ...queue });
  assert.deepEqual(cache.read('records'), []); cache.write('records', [{ id: 'one' }]);
  assert.doesNotThrow(() => queue.run()); assert.doesNotThrow(() => cache.dispose({clear:true}));
});

test('legacy shared caches are removed without deleting sign-in preferences or other projects', () => {
  const storage = memoryStorage(); storage.setItem('cct:cct_records','old'); storage.setItem('cct:cct_keep_signed_in','true'); storage.setItem('other:cct_records','other');
  removeLegacyCollectionCache(storage, 'cct'); assert.equal(storage.getItem('cct:cct_records'),null);
  assert.equal(storage.getItem('cct:cct_keep_signed_in'),'true'); assert.equal(storage.getItem('other:cct_records'),'other');
});
