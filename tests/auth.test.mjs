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
  const env = { ...process.env, NODE_ENV: 'production', FIRESTORE_DISABLED: 'true', HR_DATA_DIR: dir, PORT: String(port), BOOTSTRAP_ADMIN_PASSWORD: 'Temporary-test-938!' };
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
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, data: await res.json() };
  };
  const login = (identifier, password) => call('/api/auth/login', { identifier, password });
  try {
    await start();
    assert.equal((await login('admin', env.BOOTSTRAP_ADMIN_PASSWORD)).status, 401);
    let r = await login('HR-001', env.BOOTSTRAP_ADMIN_PASSWORD);
    assert.equal(r.status, 200); assert.equal(r.data.mustChangePassword, true);
    const restricted = r.data.token;
    assert.equal((await call('/api/employees', undefined, restricted)).status, 403);
    assert.equal((await call('/api/auth/me', undefined, restricted)).data.mustChangePassword, true);
    assert.equal((await call('/api/auth/change-password', { new_password: 'short' }, restricted)).status, 400);
    assert.equal((await call('/api/auth/change-password', { new_password: 'Admin-personal-938!' }, restricted)).status, 200);
    assert.equal((await call('/api/auth/me', undefined, restricted)).status, 401);
    assert.equal((await login('HR-001', 'Welcome2026!')).status, 401);
    assert.equal((await login('HR-001', env.BOOTSTRAP_ADMIN_PASSWORD)).status, 401);
    r = await login('igeguera@gmail.com', 'Admin-personal-938!');
    const admin = r.data.token;
    assert.equal(r.data.mustChangePassword, false);
    assert.equal((await call('/api/auth/change-password', { current_password: 'Welcome2026!', new_password: 'Unwanted-change-938!' }, admin)).status, 400);
    r = await call('/api/employees', { full_name: 'Test Employee', email: 'test@example.com', password: 'Employee-temp-938!', role: 'employee' }, admin);
    assert.equal(r.status, 201); const employeeId = r.data.id;
    const stored = JSON.parse(await readFile(join(dir, 'hr_hub_store.json'), 'utf8'));
    assert.match(stored.users.find(u => u.id === employeeId).passwordHash, /^\$2[ab]\$/);
    assert.equal(stored.sessions, undefined);
    r = await login('test@example.com', 'Employee-temp-938!'); const temp = r.data.token;
    assert.equal((await call('/api/auth/change-password', { new_password: 'Employee-personal-938!' }, temp)).status, 200);
    r = await login('test@example.com', 'Employee-personal-938!'); const employee = r.data.token;
    assert.equal((await call('/api/employees', { full_name: 'Unauthorized' }, employee)).status, 403);
    assert.equal((await call(`/api/admin/employees/${employeeId}/reset-password`, { temporary_password: 'Reset-temp-938!' }, admin)).status, 200);
    assert.equal((await call('/api/auth/me', undefined, employee)).status, 401);
    r = await login('test@example.com', 'Reset-temp-938!'); assert.equal(r.data.mustChangePassword, true);
    assert.equal((await call('/api/auth/logout', {}, r.data.token)).status, 200);
    assert.equal((await call('/api/auth/me', undefined, r.data.token)).status, 401);
    await stop(); await start();
    assert.equal((await call('/api/auth/me', undefined, admin)).status, 401);
    assert.equal((await login('HR-001', 'Admin-personal-938!')).status, 200);
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
