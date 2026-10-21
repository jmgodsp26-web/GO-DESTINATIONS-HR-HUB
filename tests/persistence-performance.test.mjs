import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { HRDatabase } from '../server/db.ts';
import { transactFirestore } from '../server/persistence.ts';
import { readPlanFor } from '../server/read-plan.ts';

process.env.INITIAL_ADMIN_EMAIL = 'performance-admin@example.test';
process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-Performance-Only-938!';
const initial = HRDatabase.bootstrap().exportState();
const hash = token => createHash('sha256').update(token).digest('hex');

// Record the real adapter's Firestore calls. This is a contract/regression
// fixture, not a substitute for Firestore latency or contention measurements.
function fixture(count = 3) {
  const state = structuredClone(initial), now = Date.now();
  state.users = []; state.sessions = []; state.leaveBalances = []; state.auditLogs = [];
  for (let i = 0; i < count; i++) {
    const id = `employee-${i}`, token = `synthetic-session-${i}`;
    state.users.push({ ...structuredClone(initial.users[0]), id, email: `employee-${i}@example.test`, passwordCustomized: true, mustChangePassword: false,
      profile: { ...initial.users[0].profile, id, user_id: id, employee_id: `HR-${100+i}`, role: 'employee', status: 'active', email: `employee-${i}@example.test` } });
    state.sessions.push([hash(token), { userId: id, createdAt: now - 60000, lastActivityAt: now - 60000, expiresAt: now + 3600000 }]);
    state.leaveBalances.push({ ...initial.leaveBalances[0], id: `balance-${i}`, employee_id: id });
  }
  state.nextEmployeeNumber = 100 + count;
  state.employeeDocuments = [{ id: 'private-file', employee_id: 'employee-1', name: 'Private test file', file_data: 'data:text/plain;base64,aGVsbG8=' }];
  const documents = new Map();
  const metadataKeys = ['nextEmployeeNumber', 'companySettings', 'deletedEmployeeIds', 'deletedHolidayIds', 'deletedShiftIds'];
  documents.set('hr_v2_meta/state', Object.fromEntries(metadataKeys.map(k => [k, state[k]])));
  for (const [name, rows] of Object.entries(state)) {
    if (name === 'employees' || !Array.isArray(rows) || metadataKeys.includes(name)) continue;
    for (const row of rows) {
      const [id, value] = name === 'sessions' ? row : [row.id, row];
      documents.set(`hr_v2_${name}/${id}`, structuredClone(value));
    }
  }
  const reads = [], writes = [];
  const ref = path => ({ path, id: path.split('/').at(-1) });
  const snapshot = (path, fields) => ({ id: path.split('/').at(-1), exists: documents.has(path), data: () => {
    const value = structuredClone(documents.get(path));
    return value && fields ? Object.fromEntries(fields.filter(k => k in value).map(k => [k, value[k]])) : value;
  }});
  const firestore = {
    doc: ref,
    collection: path => ({ path, query: true, doc: id => ref(path + '/' + id), select: (...fields) => ({ path, query: true, fields }) }),
    async runTransaction(operation) {
      const pending = [];
      const result = await operation({
        async get(target) {
          reads.push(target.path);
          if (!target.query) return snapshot(target.path);
          const docs = [...documents.keys()].filter(p => p.startsWith(target.path + '/')).map(p => snapshot(p, target.fields));
          return { docs, empty: docs.length === 0 };
        },
        set(target, value) { pending.push({ path: target.path, value: structuredClone(value) }); },
        delete(target) { pending.push({ path: target.path, remove: true }); },
      });
      for (const entry of pending) { writes.push(entry.path); if (entry.remove) documents.delete(entry.path); else documents.set(entry.path, entry.value); }
      return result;
    },
  };
  return { firestore, documents, reads, writes };
}

test('GET route plans are internal, retain auth data and leave mutations on the full transaction', () => {
  assert.deepEqual(readPlanFor('GET', '/holidays/', 'token').tables, ['users', 'sessions', 'holidays']);
  assert.deepEqual(readPlanFor('HEAD', '/HOLIDAY-COVERAGE/id', 'token').tables, ['users', 'sessions', 'holidays', 'holidayShifts', 'leaveRequests', 'leaveBalances']);
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) assert.equal(readPlanFor(method, '/holidays', 'token'), undefined);
  assert.equal(readPlanFor('GET', '/holidays', ''), undefined);
  assert.equal(readPlanFor('GET', '/new-unreviewed-route', 'token').tables, undefined);
});

test('page read fetches its collections and own session, preserves idle activity and never rewrites global metadata', async () => {
  const f = fixture(), token = 'synthetic-session-0';
  const untouched = structuredClone([...f.documents]);
  const result = await transactFirestore(f.firestore, async db => {
    const actor = db.getUserByToken(token); assert.equal(actor.id, 'employee-0');
    return { result: db.getLeaveBalances(actor.id), commit: true };
  }, { readPlan: readPlanFor('GET', '/leave-balances', token) });
  assert.equal(result.length, 1); assert.equal(result[0].employee_id, 'employee-0');
  assert.deepEqual(f.reads.sort(), ['hr_v2_meta/state', 'hr_v2_users', `hr_v2_sessions/${hash(token)}`, 'hr_v2_leaveBalances'].sort());
  assert.deepEqual(f.writes, [`hr_v2_sessions/${hash(token)}`]);
  for (const [key, value] of untouched) if (key !== `hr_v2_sessions/${hash(token)}`) assert.deepEqual(f.documents.get(key), value, key);
});

test('revoked, expired and disabled sessions remain denied without client-side identity caching', async () => {
  for (const mode of ['revoked', 'expired', 'disabled', 'idle']) {
    const f = fixture(), token = 'synthetic-session-0', key = `hr_v2_sessions/${hash(token)}`;
    if (mode === 'revoked') f.documents.delete(key);
    if (mode === 'expired') f.documents.get(key).expiresAt = Date.now() - 1;
    if (mode === 'idle') f.documents.get(key).lastActivityAt = Date.now() - 3 * 3600000;
    if (mode === 'disabled') f.documents.get('hr_v2_users/employee-0').profile.status = 'disabled';
    assert.equal(await transactFirestore(f.firestore, async db => ({ result: db.getUserByToken(token), commit: false }), { readPlan: readPlanFor('GET', '/profile', token) }), null);
    assert.deepEqual(f.writes, []);
  }
});

test('90 distinct concurrent readers never write another session, HR records or the metadata barrier', async () => {
  const f = fixture(90);
  const replies = await Promise.all(Array.from({ length: 90 }, (_, i) => {
    const token = `synthetic-session-${i}`;
    return transactFirestore(f.firestore, async db => {
      const actor = db.getUserByToken(token);
      return { result: db.getLeaveBalances(actor.id), commit: true };
    }, { readPlan: readPlanFor('GET', '/leave-balances', token) });
  }));
  replies.forEach((rows, i) => assert.deepEqual(rows.map(r => r.employee_id), [`employee-${i}`]));
  assert.equal(f.writes.length, 90); assert.equal(new Set(f.writes).size, 90);
  assert.ok(f.writes.every(p => p.startsWith('hr_v2_sessions/')));
  assert.equal(f.reads.length, 360);
});

test('write operations retain complete reads and the cross-instance serialization barrier', async () => {
  const f = fixture();
  const result = await transactFirestore(f.firestore, async db => {
    const actor = { ...db.getAllEmployees()[0], role: 'admin' };
    return { result: db.addHoliday({ name: 'Synthetic holiday', date: '2027-01-04', country: 'Philippines' }, actor), commit: true };
  });
  assert.equal(result.name, 'Synthetic holiday');
  assert.ok(f.reads.includes('hr_v2_sessions')); assert.ok(f.reads.includes('hr_v2_employeeDocuments'));
  assert.ok(f.writes.includes('hr_v2_meta/state')); assert.ok(f.documents.has('hr_v2_holidays/' + result.id));
  assert.ok(f.documents.has('hr_v2_employeeDocuments/private-file'));
});

test('missing initialization marker cannot bootstrap from a partial page read', async () => {
  const f = fixture(); f.documents.delete('hr_v2_meta/state');
  await assert.rejects(transactFirestore(f.firestore, async () => ({ result: null, commit: true }), { readPlan: readPlanFor('GET', '/profile', 'synthetic-session-0') }), /initialization marker/);
  assert.deepEqual(f.writes, []);
});

test('notification reads retain reminder persistence and do not repeat it on the next poll', async () => {
  const f = fixture(), token = 'synthetic-session-0';
  f.documents.set('hr_v2_onboardingPlans/plan', { id: 'plan', employee_id: 'employee-0', status: 'Active', tasks: [{ id: 'task', assigned_to: 'employee-0', status: 'Not started', due_date: '2020-01-01', last_reminded: null }] });
  const poll = () => transactFirestore(f.firestore, async db => {
    const actor = db.getUserByToken(token);
    return { result: db.getNotifications(actor.id), commit: true };
  }, { readPlan: readPlanFor('GET', '/notifications', token) });
  const first = await poll(), second = await poll();
  assert.equal(first.length, 1); assert.equal(second.length, 1); assert.equal(first[0].id, second[0].id);
  assert.ok(f.documents.get('hr_v2_onboardingPlans/plan').tasks[0].last_reminded);
  assert.ok(!f.writes.includes('hr_v2_meta/state'));
});
