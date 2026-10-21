import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadCache } from '../src/services/readCache.ts';

test('identical reads share a request but callers never share mutable response objects', async () => {
  const cache = createReadCache(); let calls = 0, release;
  const load = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const first = cache.read('page', load), second = cache.read('page', load);
  assert.equal(calls, 1); release({ rows: [{ name: 'Original' }] });
  const [a, b] = await Promise.all([first, second]); a.rows[0].name = 'Changed';
  assert.equal(b.rows[0].name, 'Original');
  await cache.read('page', async () => { calls++; return {}; }); assert.equal(calls, 2);
});
test('short-lived dashboard cache expires, bounds memory and clears after a write', async () => {
  let time = 0, calls = 0; const cache = createReadCache(() => time);
  const load = async () => ({ version: ++calls });
  assert.equal((await cache.read('dashboard', load, 5000)).version, 1);
  assert.equal((await cache.read('dashboard', load, 5000)).version, 1);
  time = 5000; assert.equal((await cache.read('dashboard', load, 5000)).version, 2);
  cache.clear(); assert.equal((await cache.read('dashboard', load, 5000)).version, 3);
  for (let i = 0; i < 21; i++) await cache.read('key-' + i, load, 5000);
  assert.equal((await cache.read('dashboard', load, 5000)).version, 25);
});
test('a read that finishes during a write cannot repopulate the cache with old data', async () => {
  const cache = createReadCache(); let release;
  const old = cache.read('dashboard', () => new Promise(r => { release = r; }), 5000);
  cache.clear();
  assert.equal(await cache.read('dashboard', async () => 'new', 5000), 'new');
  release('old'); assert.equal(await old, 'old');
  assert.equal(await cache.read('dashboard', async () => 'wrong', 5000), 'new');
});
test('logout/account change discards cached and in-flight confidential responses', async () => {
  const cache = createReadCache(); let release;
  await cache.read('known', async () => 'account A', 5000);
  const pending = cache.read('late', () => new Promise(r => { release = r; }), 5000);
  cache.reset(); release('confidential account A');
  await assert.rejects(pending, /sign-in changed/);
  assert.equal(await cache.read('known', async () => 'account B', 5000), 'account B');
});
test('failed requests are never retained and can be retried', async () => {
  const cache = createReadCache();
  await assert.rejects(cache.read('page', async () => { throw new Error('Unavailable'); }, 5000));
  assert.equal(await cache.read('page', async () => 'recovered', 5000), 'recovered');
});
