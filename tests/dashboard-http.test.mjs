import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { HRDatabase } from '../server/db.ts';
import { api } from '../src/services/api.ts';

test('dashboard HTTP: role boundaries, own records, current balances, file privacy and cache invalidation', async () => {
  process.env.INITIAL_ADMIN_EMAIL = 'dashboard-admin@example.test';
  process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-Dashboard-Only-938!';
  const db = HRDatabase.bootstrap(), admin = db.getAllEmployees()[0];
  const owner = db.createEmployee({ full_name: 'Synthetic owner', email: 'dashboard-owner@example.test', country: 'Philippines', holiday_calendar: 'Philippines' }, admin);
  const other = db.createEmployee({ full_name: 'Synthetic other', email: 'dashboard-other@example.test', country: 'Canada' }, admin);
  db.addHoliday({ name: 'Synthetic PH holiday', date: '2030-01-01', country: 'Philippines' }, admin);
  db.addHoliday({ name: 'Synthetic CA holiday', date: '2030-01-02', country: 'Canada' }, admin);
  const ownerLeave = db.submitLeaveRequest(owner, { leave_type: 'Vacation Leave', start_date: '2027-02-01', end_date: '2027-02-01', reason: 'Owner test' });
  db.submitLeaveRequest(other, { leave_type: 'Medical Leave', start_date: '2027-02-02', end_date: '2027-02-02', reason: 'PRIVATE_OTHER_MEDICAL_REASON' });
  db.submitLeaveRequest(admin, { leave_type: 'Vacation Leave', start_date: '2027-02-03', end_date: '2027-02-03', reason: 'Admin personal test' });
  const doc = db.addEmployeeDocument({ employee_id: owner.id, name: 'test.txt', category: 'Other', file_size: '5 Bytes', uploaded_by_name: admin.full_name, file_data: 'data:text/plain;base64,aGVsbG8=' });
  const state = db.exportState(), tokens = [admin, owner, other].map(() => randomBytes(32).toString('hex')), now = Date.now();
  state.users.forEach(u => { u.mustChangePassword = false; u.passwordCustomized = true; });
  state.sessions = [admin, owner, other].map((u, i) => [createHash('sha256').update(tokens[i]).digest('hex'), { userId: u.id, createdAt: now, lastActivityAt: now, expiresAt: now + 3600000 }]);
  const dir = await mkdtemp(tmpdir() + '/hr-dashboard-http-');
  await writeFile(dir + '/store.json', JSON.stringify(state), { mode: 0o600 });
  const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const child = spawn(process.execPath, ['build/server.cjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, NODE_ENV: 'test', HR_TEST_STORE: dir + '/store.json', PORT: String(port) }, stdio: 'ignore' });
  const root = `http://127.0.0.1:${port}`;
  async function call(path, actor, method = 'GET', body) {
    const res = await fetch(root + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(actor === undefined ? {} : { Cookie: '__session=' + tokens[actor] }) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, headers: res.headers, data: await res.json() };
  }
  const originalFetch = globalThis.fetch;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { if ((await call('/health')).status === 200) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
    assert.ok(ready);
    const html = await (await originalFetch(root)).text();
    const asset = /src="(\/assets\/[^\"]+\.js)"/.exec(html)[1];
    const plain = await originalFetch(root + asset, { headers: { 'Accept-Encoding': 'identity' } });
    const plainBytes = Buffer.from(await plain.arrayBuffer()); assert.equal(plain.headers.get('content-encoding'), null);
    for (const [accept, expected] of [['br, gzip', 'br'], ['gzip;q=1, br;q=0, identity;q=0', 'gzip']]) {
      const compressed = await originalFetch(root + asset, { headers: { 'Accept-Encoding': accept } });
      assert.equal(compressed.status, 200); assert.equal(compressed.headers.get('content-encoding'), expected);
      assert.match(compressed.headers.get('content-type'), /javascript/); assert.match(compressed.headers.get('vary'), /Accept-Encoding/i);
      assert.match(compressed.headers.get('cache-control'), /immutable/);
      assert.ok(Number(compressed.headers.get('content-length')) < plainBytes.length / 2);
      // Node's fetch decompresses on receipt, as browsers do.
      assert.deepEqual(Buffer.from(await compressed.arrayBuffer()), plainBytes);
    }
    for (const route of ['/dashboard/personal', '/dashboard/administration']) assert.equal((await call(route)).status, 401);
    assert.equal((await call('/dashboard/administration', 1)).status, 403);
    const personal = await call('/dashboard/personal?employee=' + other.id + '&scope=all&view=administration', 1);
    assert.equal(personal.status, 200); assert.match(personal.headers.get('cache-control'), /no-store/);
    assert.match(personal.headers.get('server-timing'), /^app;dur=\d+(\.\d+)?$/);
    assert.ok(personal.data.requests.length > 0); assert.ok(personal.data.requests.every(r => r.employee_id === owner.id));
    assert.ok(personal.data.balances.every(r => r.employee_id === owner.id));
    assert.ok(!JSON.stringify(personal.data).includes('PRIVATE_OTHER_MEDICAL_REASON'));
    assert.ok(personal.data.holidays.some(h => h.name === 'Synthetic PH holiday'));
    assert.ok(!personal.data.holidays.some(h => h.name === 'Synthetic CA holiday'));
    const mine = await call('/dashboard/personal', 0); assert.ok(mine.data.requests.length > 0); assert.ok(mine.data.requests.every(r => r.employee_id === admin.id));
    const management = await call('/dashboard/administration', 0);
    assert.equal(management.data.employees.length, 3); assert.equal(management.data.requests.length, 3);
    assert.ok(!JSON.stringify(management.data).includes('passwordHash'));
    const identity = await originalFetch(root + '/api/dashboard/administration', { headers: { Cookie: '__session=' + tokens[0], 'Accept-Encoding': 'identity' } });
    const uncompressed = Buffer.from(await identity.arrayBuffer());
    assert.equal(identity.headers.get('content-encoding'), null);
    const compressed = await originalFetch(root + '/api/dashboard/administration', { headers: { Cookie: '__session=' + tokens[0], 'Accept-Encoding': 'gzip' } });
    assert.equal(compressed.headers.get('content-encoding'), 'gzip');
    assert.match(compressed.headers.get('cache-control'), /no-store/);
    assert.ok(Number(compressed.headers.get('content-length')) < uncompressed.length);
    assert.deepEqual(Buffer.from(await compressed.arrayBuffer()), uncompressed);

    const importRow = {full_name:'Synthetic import',email:'import@example.test',department:'Technology',job_title:'Developer',country:'Philippines',holiday_calendar:'United States',phone:'',date_joined:'2024-01-01',date_of_birth:'',role:'employee',annual_leave_days:0,sick_leave_days:0};
    const importBody = {employees:[importRow],password:'Synthetic-Import-Password-123'};
    assert.equal((await call('/employees/import', undefined, 'POST', importBody)).status,401);
    assert.equal((await call('/employees/import', 1, 'POST', importBody)).status,403);
    const imported = await call('/employees/import',0,'POST',importBody);
    assert.equal(imported.status,200);assert.equal(imported.data.results[0].status,'created');
    assert.equal((await call('/employees/import',0,'POST',importBody)).data.results[0].status,'skipped');
    const beforeInvalid = (await call('/employees',0)).data.length;
    const invalidBatch = await call('/employees/import',0,'POST',{...importBody,employees:[{...importRow,email:'fresh@example.test',full_name:'Fresh'},{...importRow,email:'invalid',full_name:'Bad'}]});
    assert.equal(invalidBatch.status,400);
    assert.equal((await call('/employees',0)).data.length,beforeInvalid);
    const firstLogin = await call('/auth/login',undefined,'POST',{identifier:importRow.email,password:importBody.password});
    assert.equal(firstLogin.status,200);
    const importCookie=firstLogin.headers.get('set-cookie').split(';')[0];
    const restricted=await originalFetch(root+'/api/employees',{headers:{Cookie:importCookie}});
    assert.equal(restricted.status,403);

    // Use the real client API; no production origin or credentials are involved.
    let active = 1, dashboardCalls = 0;
    globalThis.fetch = (input, options = {}) => {
      if (String(input).startsWith('/api/dashboard/')) dashboardCalls++;
      const headers = new Headers(options.headers); headers.set('Cookie', '__session=' + tokens[active]);
      return originalFetch(new URL(input, root), { ...options, headers });
    };
    api.invalidateReadCache();
    const initial = await api.getPersonalDashboard(); await api.getPersonalDashboard(); assert.equal(dashboardCalls, 1);
    assert.equal(initial.requests[0].status, 'Pending');
    active = 0; await api.reviewLeaveRequest(ownerLeave.id, 'Approved'); active = 1;
    const updated = await api.getPersonalDashboard(); assert.equal(dashboardCalls, 2);
    assert.equal(updated.requests[0].status, 'Approved');
    assert.equal(updated.balances.find(b => b.leave_type === 'Vacation Leave').used_days, 1);
    const listing = await api.getMyDocuments(); assert.equal(listing[0].file_data, undefined); assert.equal(listing[0].file_available, true);
    const binary = await globalThis.fetch(`/api/documents/${doc.id}/file`); assert.equal(await binary.text(), 'hello');
    active = 2; const denied = await globalThis.fetch(`/api/documents/${doc.id}/file`); assert.equal(denied.status, 404);
  } finally {
    globalThis.fetch = originalFetch; api.invalidateReadCache();
    if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
    await rm(dir, { recursive: true, force: true });
  }
});
