import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

test('authentication lifecycle and authorization', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hr-auth-'));
  const listener = createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const env = { ...process.env, NODE_ENV: 'test', HR_TEST_STORE: join(dir, 'store.json'), PORT: String(port), INITIAL_ADMIN_EMAIL: 'admin@godestinationservices.com', INITIAL_ADMIN_PASSWORD: 'Temporary-test-938!' };
  const emulator = process.env.HR_AUTH_TEST_EMULATOR;
  let firestore;
  if (emulator) {
    if (!/^127\.0\.0\.1:\d+$/.test(emulator)) throw new Error('Tests require a local emulator.');
    env.FIRESTORE_EMULATOR_HOST = emulator;
    env.GOOGLE_CLOUD_PROJECT = 'demo-hr-auth-tests';
    env.FIRESTORE_DATABASE_ID = '(default)';
    delete env.HR_TEST_STORE;
    delete env.FIRESTORE_DISABLED;
    const { initializeApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    process.env.FIRESTORE_EMULATOR_HOST = emulator;
    firestore = getFirestore(initializeApp({ projectId: env.GOOGLE_CLOUD_PROJECT }));
    await fetch(`http://${emulator}/emulator/v1/projects/${env.GOOGLE_CLOUD_PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  }
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['dist/server.cjs'], { env, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Server did not start');
  };
  const stop = async () => { if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; } };
  const call = async (path, body, token) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, cookie: res.headers.get('set-cookie')?.split(';')[0], data: await res.json() };
  };
  const login = (identifier, password) => call('/api/auth/login', { identifier, password });
  try {
    await start();
    assert.equal((await login('admin', env.INITIAL_ADMIN_PASSWORD)).status, 401);
    let r = await login(env.INITIAL_ADMIN_EMAIL, env.INITIAL_ADMIN_PASSWORD);
    assert.equal(r.status, 200); assert.equal(r.data.mustChangePassword, true);
    const restricted = r.cookie;
    assert.equal((await call('/api/employees', undefined, restricted)).status, 403);
    assert.equal((await call('/api/auth/me', undefined, restricted)).data.mustChangePassword, true);
    assert.equal((await call('/api/auth/change-password', { new_password: 'short' }, restricted)).status, 400);
    assert.equal((await call('/api/auth/change-password', { new_password: 'Admin-personal-938!' }, restricted)).status, 200);
    assert.equal((await call('/api/auth/me', undefined, restricted)).status, 401);
    assert.equal((await login(env.INITIAL_ADMIN_EMAIL, 'Welcome2026!')).status, 401);
    assert.equal((await login(env.INITIAL_ADMIN_EMAIL, env.INITIAL_ADMIN_PASSWORD)).status, 401);
    r = await login(env.INITIAL_ADMIN_EMAIL, 'Admin-personal-938!');
    const admin = r.cookie;
    assert.equal(r.data.token, undefined);
    assert.equal((await call('/api/employees', undefined, admin)).data.length, 1);
    assert.equal((await call('/api/holidays', undefined, admin)).data.length, 0);
    const csrf = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, { method: 'POST', headers: { Cookie: admin, Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(csrf.status, 403);
    assert.equal(r.data.mustChangePassword, false);
    assert.equal((await call('/api/auth/change-password', { current_password: 'Welcome2026!', new_password: 'Unwanted-change-938!' }, admin)).status, 400);
    r = await call('/api/employees', { full_name: 'Test Employee', email: 'test@example.com', password: 'Employee-temp-938!', role: 'employee' }, admin);
    assert.equal(r.status, 201); const employeeId = r.data.id;
    const stored = firestore ? {
      users: (await firestore.collection('hr_v2_users').get()).docs.map(doc => doc.data()),
      sessions: (await firestore.collection('hr_v2_sessions').get()).docs.map(doc => [doc.id, doc.data()]),
    } : JSON.parse(await readFile(join(dir, 'store.json'), 'utf8'));
    assert.match(stored.users.find(u => u.id === employeeId).passwordHash, /^\$2[ab]\$/);
    assert.ok(stored.sessions.length > 0);
    assert.ok(stored.sessions.every(([hash]) => /^[a-f0-9]{64}$/.test(hash)));
    assert.equal(JSON.stringify(stored).includes(admin.split('=')[1]), false);
    r = await login('test@example.com', 'Employee-temp-938!'); const temp = r.cookie;
    assert.equal((await call('/api/auth/change-password', { new_password: 'Employee-personal-938!' }, temp)).status, 200);
    r = await login('test@example.com', 'Employee-personal-938!'); const employee = r.cookie;
    assert.equal((await call('/api/employees', { full_name: 'Unauthorized' }, employee)).status, 403);
    const approved = await call('/api/leave-requests', { leave_type: 'Vacation Leave', start_date: '2026-10-12', end_date: '2026-10-12', reason: 'Test' }, employee);
    assert.equal(approved.status, 201, JSON.stringify(approved.data));
    const concurrent = await Promise.all([1, 2].map(() => call('/api/leave-requests', { leave_type: 'Vacation Leave', start_date: '2026-10-13', end_date: '2026-10-13', reason: 'Concurrent test' }, employee)));
    assert.deepEqual(concurrent.map(reply => reply.status).sort(), [201, 400]);
    assert.equal((await call('/api/leave-requests', undefined, employee)).data.length, 2);
    assert.equal((await call(`/api/admin/employees/${employeeId}/reset-password`, { temporary_password: 'Reset-temp-938!' }, admin)).status, 200);
    assert.equal((await call('/api/auth/me', undefined, employee)).status, 401);
    r = await login('test@example.com', 'Reset-temp-938!'); assert.equal(r.data.mustChangePassword, true);
    const loggedOut = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, { method: 'POST', headers: { Cookie: r.cookie, 'Content-Type': 'application/json' } });
    assert.equal(loggedOut.status, 200);
    assert.equal((await call('/api/auth/me', undefined, r.cookie)).status, 401);
    await stop(); await start();
    assert.equal((await call('/api/auth/me', undefined, admin)).status, 200);
    assert.equal((await login(env.INITIAL_ADMIN_EMAIL, 'Admin-personal-938!')).status, 200);
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
