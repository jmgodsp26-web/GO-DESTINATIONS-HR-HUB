import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { HRDatabase } from '../server/db.ts';
import { transactFirestore } from '../server/persistence.ts';
import { readPlanFor, writeTablesFor } from '../server/read-plan.ts';

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
  const reads = [], writes = [], queries = [];
  const ref = path => ({ path, id: path.split('/').at(-1) });
  const snapshot = (path, fields) => ({ id: path.split('/').at(-1), ref: ref(path), exists: documents.has(path), data: () => {
    const value = structuredClone(documents.get(path));
    return value && fields ? Object.fromEntries(fields.filter(k => k in value).map(k => [k, value[k]])) : value;
  }});
  const firestore = {
    doc: ref,
    collection: path => {
      const query = (filters = [], fields) => ({ path, query: true, filters, fields,
        doc: id => ref(path + '/' + id),
        where: (field, operator, value) => { assert.equal(operator, '=='); return query([...filters, { field, value }], fields); },
        select: (...next) => query(filters, next),
      });
      return query();
    },
    async runTransaction(operation) {
      const pending = [];
      const result = await operation({
        async get(target) {
          reads.push(target.path);
          if (!target.query) return snapshot(target.path);
          const docs = [...documents.keys()].filter(p => p.startsWith(target.path + '/') && (target.filters || []).every(f => documents.get(p)[f.field] === f.value)).map(p => snapshot(p, target.fields));
          queries.push({ path: target.path, fields: target.fields, filters: target.filters, bytes: Buffer.byteLength(JSON.stringify(docs.map(d => d.data()))) });
          return { docs, empty: docs.length === 0 };
        },
        set(target, value, options) { pending.push({ path: target.path, value: structuredClone(value), merge: options?.merge }); },
        delete(target) { pending.push({ path: target.path, remove: true }); },
      });
      for (const entry of pending) { writes.push(entry.path); if (entry.remove) documents.delete(entry.path); else documents.set(entry.path, entry.merge ? { ...documents.get(entry.path), ...entry.value } : entry.value); }
      return result;
    },
  };
  return { firestore, documents, reads, writes, queries };
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

test('document lists annotate legacy availability once, preserve bytes and avoid full-file reads afterward', async () => {
  const f = fixture(), token = 'synthetic-session-1', fileKey = 'hr_v2_employeeDocuments/private-file';
  const original = f.documents.get(fileKey).file_data;
  const list = () => transactFirestore(f.firestore, async db => ({ result: db.listDocuments(db.getUserByToken(token)), commit: true }), { readPlan: readPlanFor('GET', '/documents', token) });
  const first = await list();
  assert.equal(first[0].file_available, true); assert.equal(first[0].file_data, undefined);
  assert.equal(first[0].mime_type, 'text/plain'); assert.equal(f.documents.get(fileKey).file_data, original);
  assert.equal(f.documents.get(fileKey).file_available, true); assert.ok(f.reads.includes(fileKey));
  f.reads.length = 0; f.writes.length = 0;
  assert.deepEqual(await list(), first); assert.ok(!f.reads.includes(fileKey));
  assert.ok(!f.writes.includes(fileKey)); assert.equal(f.documents.get(fileKey).file_data, original);
  const file = await transactFirestore(f.firestore, async db => ({ result: db.documentFile(db.getUserByToken(token), 'private-file'), commit: true }), { readPlan: readPlanFor('GET', '/documents/private-file/file', token), employeeDocumentId: 'private-file' });
  assert.equal(file.file_data, original);
});

test('deleting a legacy document cannot be undone by its availability backfill', async () => {
  const f = fixture();
  await transactFirestore(f.firestore, async db => ({ result: db.deleteEmployeeDocument('employee-1', 'private-file'), commit: true }), { writeTables: writeTablesFor('DELETE', '/admin/employees/employee-1/documents/private-file') });
  assert.equal(f.documents.has('hr_v2_employeeDocuments/private-file'), false);
});

test('reviewed leave write plans preserve approval/cancellation accounting and unrelated files', async () => {
  const f = fixture(); f.documents.get('hr_v2_users/employee-0').profile.role = 'admin';
  const file = structuredClone(f.documents.get('hr_v2_employeeDocuments/private-file'));
  f.documents.set('hr_v2_leaveTransactions/historical', { id: 'historical', employee_id: 'employee-2', description: 'Keep historical ledger' });
  const execute = (method, path, action) => transactFirestore(f.firestore, async db => ({ result: await action(db), commit: true }), {
    writeTables: writeTablesFor(method, path), writeSessionId: hash(path.endsWith('/review') ? 'synthetic-session-0' : 'synthetic-session-1'),
    writeLeaveRequestId: /^\/leave-requests\/([^/]+)/.exec(path)?.[1],
  });
  const request = await execute('POST', '/leave-requests', db => db.submitLeaveRequest(db.getProfile('employee-1'), { leave_type: 'Vacation Leave', start_date: '2027-01-04', end_date: '2027-01-04', reason: 'Synthetic performance test' }));
  assert.equal(request.status, 'Pending');
  await execute('PATCH', `/leave-requests/${request.id}/review`, db => db.reviewLeaveRequest(request.id, 'Approved', db.getProfile('employee-0')));
  assert.equal(f.documents.get('hr_v2_leaveBalances/balance-1').used_days, 1);
  await assert.rejects(execute('PATCH', `/leave-requests/${request.id}/review`, db => db.reviewLeaveRequest(request.id, 'Approved', db.getProfile('employee-0'))), /already/);
  await execute('PATCH', `/leave-requests/${request.id}/cancel`, db => db.cancelLeaveRequest(request.id, db.getProfile('employee-1')));
  assert.equal(f.documents.get('hr_v2_leaveBalances/balance-1').used_days, 0);
  assert.equal(f.documents.get('hr_v2_leaveRequests/' + request.id).status, 'Cancelled');
  assert.deepEqual(f.documents.get('hr_v2_employeeDocuments/private-file'), file);
  assert.ok(!f.reads.includes('hr_v2_employeeDocuments')); assert.ok(!f.reads.includes('hr_v2_onboardingPlans'));
  assert.ok(!f.reads.includes('hr_v2_leaveTransactions')); assert.ok(!f.reads.includes('hr_v2_auditLogs'));
  assert.ok(f.documents.has('hr_v2_leaveTransactions/historical'));
  assert.ok(f.reads.includes('hr_v2_leaveRequests/' + request.id));
  assert.ok(f.queries.filter(q => q.path === 'hr_v2_leaveBalances').every(q => q.filters.some(f => f.field === 'employee_id' && f.value === 'employee-1')));
  assert.ok(f.writes.includes('hr_v2_meta/state')); assert.equal(writeTablesFor('DELETE', '/employees/person'), undefined);
});

test('known document metadata excludes large file contents from list and unrelated write reads', async () => {
  const f = fixture(), data = 'data:text/plain;base64,' + Buffer.alloc(300000, 'x').toString('base64');
  for (let i = 0; i < 10; i++) f.documents.set(`hr_v2_employeeDocuments/large-${i}`, { id: `large-${i}`, employee_id: 'employee-1', name: 'Synthetic file', category: 'Other', uploaded_at: '2026-01-01T00:00:00Z', file_available: true, mime_type: 'text/plain', file_data: data });
  // Mark the legacy fixture separately so this test measures the established path.
  f.documents.get('hr_v2_employeeDocuments/private-file').file_available = true;
  f.documents.get('hr_v2_employeeDocuments/private-file').uploaded_at = '2026-01-01T00:00:00Z';
  const token = 'synthetic-session-1';
  const result = await transactFirestore(f.firestore, async db => ({ result: db.listDocuments(db.getUserByToken(token)), commit: true }), { readPlan: readPlanFor('GET', '/documents', token) });
  assert.equal(result.length, 11); assert.ok(result.every(d => d.file_data === undefined && d.file_available));
  const query = f.queries.find(q => q.path === 'hr_v2_employeeDocuments');
  assert.ok(!query.fields.includes('file_data')); assert.ok(query.bytes < 5000);
  assert.equal(f.documents.get('hr_v2_employeeDocuments/large-0').file_data, data);
});
