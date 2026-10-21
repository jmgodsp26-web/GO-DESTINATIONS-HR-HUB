// Run after npm run build: node --import tsx scripts/check-local-capacity.mjs
// Uses only a temporary synthetic database and a server on loopback. It cannot
// target production. Timing is for local file persistence, NOT Cloud Firestore.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { HRDatabase } from '../server/db.ts';

process.env.INITIAL_ADMIN_EMAIL = 'capacity-admin@example.test';
process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-Capacity-Only-938!';
const template = HRDatabase.bootstrap().exportState(), state = structuredClone(template);
state.users = []; state.sessions = []; state.leaveBalances = []; state.auditLogs = [];
const tokens = [], now = Date.now();
for (let i = 0; i < 90; i++) {
  const id = `capacity-${i}`, email = `capacity-${i}@example.test`, token = randomBytes(32).toString('hex');
  tokens.push(token);
  state.users.push({ ...structuredClone(template.users[0]), id, email, passwordCustomized: true, mustChangePassword: false,
    profile: { ...template.users[0].profile, id, user_id: id, employee_id: `HR-${100+i}`, full_name: `Synthetic employee ${i}`, email, role: i === 0 ? 'admin' : 'employee' } });
  state.leaveBalances.push(...template.leaveBalances.map((b, j) => ({ ...b, id: `balance-${i}-${j}`, employee_id: id })));
  state.sessions.push([createHash('sha256').update(token).digest('hex'), { userId: id, createdAt: now, lastActivityAt: now, expiresAt: now + 3600000 }]);
}
state.nextEmployeeNumber = 190;
const dir = await mkdtemp(tmpdir() + '/hr-capacity-');
await writeFile(dir + '/store.json', JSON.stringify(state), { mode: 0o600 });
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r));
const child = spawn(process.execPath, ['build/server.cjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, NODE_ENV: 'test', HR_TEST_STORE: dir + '/store.json', PORT: String(port) }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
const timings = [];
async function call(path, user = 0, method = 'GET', body) {
  const start = performance.now();
  const res = await fetch(base + path, { method, headers: { Cookie: '__session=' + tokens[user], 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const data = await res.json(); assert.ok(res.ok, `${method} ${path}: ${res.status}`);
  return { data, ms: performance.now() - start, headers: res.headers };
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { await call('/api/health'); ready = true; break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'Local test server did not start');
  for (const users of [3, 30, 90]) for (const combined of [false, true]) {
    const durations = [], started = performance.now();
    await Promise.all(Array.from({ length: users }, async (_, i) => {
      const start = performance.now();
      if (combined) {
        const dashboard = await call('/api/dashboard/personal', i);
        assert.ok(dashboard.data.balances.every(b => b.employee_id === `capacity-${i}`));
        assert.ok(dashboard.data.requests.every(r => r.employee_id === `capacity-${i}`));
        assert.match(dashboard.headers.get('cache-control'), /no-store/);
      } else {
        const [balances, leave] = await Promise.all([
          call('/api/leave-balances?scope=mine', i), call('/api/leave-requests?scope=mine', i), call('/api/holidays', i), call('/api/holiday-shifts?employee_id=capacity-' + i, i),
        ]);
        assert.ok(balances.data.every(b => b.employee_id === `capacity-${i}`));
        assert.ok(leave.data.every(r => r.employee_id === `capacity-${i}`));
      }
      durations.push(performance.now() - start);
    }));
    durations.sort((a, b) => a - b);
    timings.push({ mode: combined ? 'combined dashboard' : 'separate core requests', users, requests: users * (combined ? 1 : 4), failures: 0, p50_dashboard_ms: Math.round(durations[Math.ceil(durations.length * .5) - 1]), p95_dashboard_ms: Math.round(durations[Math.ceil(durations.length * .95) - 1]), total_ms: Math.round(performance.now() - started) });
  }
  const holiday = await call('/api/holidays', 0, 'POST', { name: 'Synthetic capacity holiday', date: '2027-01-04', country: 'Philippines' });
  assert.equal(holiday.data.name, 'Synthetic capacity holiday');
  assert.ok((await call('/api/holidays', 89)).data.some(h => h.id === holiday.data.id));
  console.log(JSON.stringify({ environment: 'Local loopback HTTP and synthetic file database; not a Cloud Run/Firestore capacity certification', timings, savedHolidayVisibleToAnotherEmployee: true }, null, 2));
} finally {
  if (child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; }
  await rm(dir, { recursive: true, force: true });
}
