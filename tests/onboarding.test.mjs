import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HRDatabase } from '../server/db.ts';
import { validateOnboardingTemplate, onboardingDate, offsetDate } from '../server/onboarding.ts';
import { onboardingProgress } from '../src/utils/onboarding.ts';
import { notificationDestination, resolveRoute } from '../src/utils/navigation.ts';
process.env.INITIAL_ADMIN_EMAIL = 'onboard-admin@example.test';
process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-Onboarding-Admin-938!';
const seed = HRDatabase.bootstrap(), admin = seed.getAllEmployees()[0];
const person = (name, role = 'employee') => seed.createEmployee({ full_name: name, email: name.toLowerCase() + '@example.test', password: 'Synthetic-Onboarding-938!', role, department: 'Technology', country: 'Philippines', timezone: 'Asia/Manila' }, admin);
const hire = person('NewHire'), it = person('IT'), manager = person('Manager'), outsider = person('Outsider'), otherAdmin = person('OtherAdmin', 'admin');
const baseline = seed.exportState();
const spec = (id, extra = {}) => ({ id, title: id, instructions: 'Synthetic test instructions', stage: 'First day', owner: 'employee', kind: 'task', due_offset: 0, required: true, requires_review: false, resource_url: '', ...extra });
const input = () => ({ name: 'Synthetic checklist', description: 'Test only', welcome: 'Welcome to the test', tasks: [spec('profile'), spec('policy', { kind: 'acknowledgment' }), spec('document', { kind: 'document' }), spec('access', { owner: 'it' }), spec('meeting', { owner: 'manager' }), spec('optional', { owner: 'hr', required: false })] });
function setup(employee = hire) {
  const db = new HRDatabase(baseline), service = db.onboarding(admin), template = service.saveTemplate(input());
  const plan = service.create({ ...input(), employee_id: employee.id, template_id: template.id, template_revision: template.revision, start_date: '2026-01-01', assignments: { hr: admin.id, manager: manager.id, it: it.id } });
  const act = (who, title, action, data = {}, manage = false) => { const p = db.onboarding(admin).get(plan.id, true), t = p.tasks.find(t => t.title === title); return db.onboarding(who).taskAction(plan.id, t.id, action, { expected_revision: p.revision, ...data }, manage); };
  return { db, service, template, plan, act };
}
test('onboarding validation: limits, duplicate IDs, invalid dates, owner roles and unsafe resource URLs', () => {
  assert.equal(validateOnboardingTemplate(input()).tasks[2].requires_review, true);
  for (const patch of [{ tasks: [] }, { tasks: Array.from({ length: 31 }, (_, i) => spec(String(i))) }, { tasks: [spec('same'), spec('same')] }, { tasks: [spec('a', { owner: 'root' })] }, { tasks: [spec('a', { due_offset: 0.5 })] }, { tasks: [spec('a', { resource_url: 'javascript:alert(1)' })] }, { tasks: [spec('a', { resource_url: 'https://user:password@example.test' })] }]) assert.throws(() => validateOnboardingTemplate({ ...input(), ...patch }));
  assert.throws(() => onboardingDate('2026-02-30')); assert.equal(onboardingDate('2028-02-29'), '2028-02-29');
  assert.equal(offsetDate('2027-01-01', -1), '2026-12-31'); assert.equal(offsetDate('2028-02-28', 1), '2028-02-29');
});
test('onboarding template snapshots survive edits, archives and database reloads', () => {
  const { db, service, template, plan } = setup();
  service.saveTemplate({ ...input(), name: 'Changed template', tasks: [spec('new task')], expected_revision: template.revision }, template.id);
  assert.equal(service.get(plan.id, true).tasks.length, 6); assert.equal(service.get(plan.id, true).name, 'Synthetic checklist');
  service.archiveTemplate(template.id, 2);
  const restored = new HRDatabase(db.exportState()); assert.equal(restored.onboarding(admin).get(plan.id, true).tasks.length, 6);
  assert.equal(restored.onboarding(admin).listTemplates()[0].active, false);
  assert.throws(() => service.saveTemplate({ ...input(), expected_revision: 1 }, template.id), e => e.status === 409);
});
test('onboarding access uses current roles and exposes only assigned tasks to staff', () => {
  const { db, plan } = setup();
  assert.equal(db.onboarding(hire).get(plan.id).tasks.length, 3);
  assert.deepEqual(db.onboarding(it).get(plan.id).tasks.map(t => t.title), ['access']);
  assert.deepEqual(db.onboarding(manager).get(plan.id).tasks.map(t => t.title), ['meeting']);
  assert.equal(db.onboarding(outsider).list().length, 0);
  assert.throws(() => db.onboarding(outsider).get(plan.id), e => e.status === 404);
  assert.throws(() => db.onboarding({ ...hire, role: 'admin' }).list(true), e => e.status === 403);
  assert.throws(() => db.onboarding(hire).listTemplates(), e => e.status === 403);
  const state = db.exportState(); state.users.find(u => u.id === it.id).profile.status = 'disabled';
  assert.throws(() => new HRDatabase(state).onboarding(it), e => e.status === 403);
});
test('onboarding creation rejects duplicate active plans and invalid HR/manager assignments', () => {
  const { service, template } = setup();
  const assign = { ...input(), employee_id: hire.id, template_id: template.id, template_revision: 1, start_date: '2026-01-01', assignments: { hr: admin.id, manager: manager.id, it: it.id } };
  assert.throws(() => service.create(assign), e => e.status === 409);
  assert.throws(() => service.create({ ...assign, employee_id: outsider.id, assignments: { ...assign.assignments, hr: manager.id } }), /valid hr/);
  assert.throws(() => service.create({ ...assign, employee_id: outsider.id, assignments: { ...assign.assignments, manager: outsider.id } }), /valid manager/);
});
test('onboarding acknowledgment records explicit read and acknowledgment separately', () => {
  const { db, plan, act } = setup();
  assert.throws(() => act(hire, 'policy', 'acknowledge', { acknowledged: true }), /Read the instructions/);
  act(hire, 'policy', 'read'); let t = db.onboarding(hire).get(plan.id).tasks.find(t => t.title === 'policy');
  assert.ok(t.read_at); assert.equal(t.acknowledged_at, null); assert.equal(t.status, 'Not started');
  assert.throws(() => act(hire, 'policy', 'submit', { acknowledged: true }));
  act(hire, 'policy', 'acknowledge', { acknowledged: true }); t = db.onboarding(hire).get(plan.id).tasks.find(t => t.title === 'policy');
  assert.ok(t.acknowledged_at); assert.equal(t.status, 'Completed');
});
test('onboarding documents require HR review, preserve revisions, and never leak bytes in listings', () => {
  const { db, plan, act } = setup(), data = 'data:text/plain;base64,aGVsbG8=';
  assert.throws(() => act(hire, 'document', 'submit', { file_name: 'bad.svg', file_data: 'data:image/svg+xml;base64,aGVsbG8=' }));
  act(hire, 'document', 'submit', { file_name: 'test.txt', file_data: data });
  let view = db.onboarding(hire).get(plan.id), task = view.tasks.find(t => t.title === 'document');
  assert.equal(task.status, 'Needs review'); assert.equal(view.files[0].data, undefined);
  assert.equal(db.onboarding(hire).file(task.file_id).data, data);
  assert.throws(() => db.onboarding(it).file(task.file_id), e => e.status === 404);
  assert.equal(db.onboarding(it).get(plan.id).files.length, 0);
  assert.throws(() => act(hire, 'document', 'approve', {}, true), e => e.status === 403);
  act(admin, 'document', 'return', { note: 'Please submit the corrected file.' }, true);
  act(hire, 'document', 'submit', { file_name: 'corrected.txt', file_data: data });
  act(admin, 'document', 'approve', { note: 'Reviewed.' }, true);
  view = db.onboarding(hire).get(plan.id); assert.equal(view.files.length, 2); assert.equal(view.tasks.find(t => t.title === 'document').status, 'Completed');
  assert.equal(db.onboarding(admin).get(plan.id, true).tasks.find(t => t.title === 'document').completed_by, admin.id);
});
test('onboarding finish requires required tasks; optional tasks do not block; closed plans cannot mutate', () => {
  const { service, plan, act } = setup();
  assert.throws(() => service.planAction(plan.id, 'complete', { expected_revision: 1 }), /every required task/);
  act(hire, 'profile', 'submit'); act(hire, 'policy', 'read'); act(hire, 'policy', 'acknowledge', { acknowledged: true });
  act(admin, 'document', 'waive', { note: 'Not required for this synthetic test.' }, true);
  act(it, 'access', 'submit'); act(manager, 'meeting', 'submit');
  let p = service.get(plan.id, true); assert.equal(onboardingProgress(p.tasks).percent, 100);
  p = service.planAction(p.id, 'complete', { expected_revision: p.revision }); assert.equal(p.status, 'Completed');
  assert.throws(() => act(admin, 'optional', 'submit'), /closed/);
  p = service.planAction(p.id, 'reopen', { expected_revision: p.revision }); assert.equal(p.status, 'Active');
});
test('onboarding self-review and new-hire self-waivers are forbidden even for administrators', () => {
  const { db, plan, act } = setup(otherAdmin);
  act(otherAdmin, 'document', 'submit', { file_name: 'test.txt', file_data: 'data:text/plain;base64,aGVsbG8=' });
  assert.throws(() => act(otherAdmin, 'document', 'approve', {}, true), e => e.status === 403);
  assert.throws(() => act(otherAdmin, 'profile', 'waive', { note: 'self waiver' }, true), e => e.status === 403);
  assert.throws(() => db.onboarding(otherAdmin).planAction(plan.id, 'cancel', { expected_revision: db.onboarding(admin).get(plan.id, true).revision, note: 'cancel' }), e => e.status === 403);
});
test('onboarding task updates detect stale versions and notifications link to exact task', () => {
  const { db, plan, act } = setup(); act(hire, 'profile', 'start');
  assert.throws(() => db.onboarding(hire).taskAction(plan.id, plan.tasks[0].id, 'submit', { expected_revision: 1 }), e => e.status === 409);
  act(hire, 'profile', 'help', { message: 'Synthetic question' });
  const notification = db.getNotifications(admin.id).find(n => n.onboarding_task_id === plan.tasks[0].id && n.link_tab === 'administration/onboarding');
  assert.equal(notificationDestination(notification), `administration/onboarding?id=${plan.id}&task=${plan.tasks[0].id}`);
  assert.equal(resolveRoute('employee', 'personal', notificationDestination(notification)).mode, 'personal');
});
test('onboarding task conversations stay private to the owner and HR', () => {
  const { db, plan, act } = setup(); act(hire, 'profile', 'help', { message: 'Private onboarding question' });
  assert.equal(db.onboarding(manager).get(plan.id).messages.length, 0);
  assert.equal(db.onboarding(hire).get(plan.id).messages.length, 1);
  act(admin, 'profile', 'reply', { message: 'HR response' }, true);
  assert.equal(db.onboarding(hire).get(plan.id).tasks[0].help_open, false);
  assert.equal(db.onboarding(hire).get(plan.id).messages.length, 2);
});
test('onboarding reminders deduplicate by task/day and stop after plan cancellation', () => {
  const { db, service, plan } = setup();
  const first = db.getNotifications(hire.id).filter(n => n.onboarding_id).length;
  assert.equal(db.getNotifications(hire.id).filter(n => n.onboarding_id).length, first);
  const p = service.get(plan.id, true); assert.throws(() => service.taskAction(p.id, p.tasks[0].id, 'remind', { expected_revision: p.revision }, true), /already been sent/);
  service.planAction(plan.id, 'cancel', { expected_revision: p.revision, note: 'Synthetic cancellation' });
  assert.equal(db.getNotifications(hire.id).filter(n => n.onboarding_id).length, 0);
});
test('onboarding schedule changes preserve completed due dates and reject reassigning private submissions', () => {
  const { service, plan, act } = setup(); act(hire, 'profile', 'submit'); act(it, 'access', 'help', { message: 'Private IT question' });
  const p = service.get(plan.id, true), input = { name: p.name, welcome: p.welcome, start_date: '2026-02-01', assignments: { ...p.assignments }, expected_revision: p.revision };
  assert.throws(() => service.update(p.id, { ...input, assignments: { ...input.assignments, it: outsider.id } }), /cannot be reassigned/);
  assert.equal(service.get(p.id, true).start_date, p.start_date);
  const next = service.update(p.id, input); assert.equal(next.tasks[0].due_date, '2026-01-01'); assert.equal(next.tasks[1].due_date, '2026-02-01');
});
test('onboarding employee deletion removes plans, files and private messages', () => {
  const { db, plan, act } = setup(); act(hire, 'document', 'submit', { file_name: 'test.txt', file_data: 'data:text/plain;base64,aGVsbG8=' }); act(hire, 'profile', 'help', { message: 'test' });
  db.deleteEmployee(hire.id, admin); const state = db.exportState();
  assert.equal(state.onboardingPlans.length, 0); assert.equal(state.onboardingFiles.length, 0); assert.equal(state.onboardingMessages.length, 0);
  assert.equal(state.notifications.filter(n => n.onboarding_id === plan.id).length, 0);
});

import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
test('onboarding HTTP: authentication, concurrency, file authorization, rollback and persistence', async () => {
  const dir = await mkdtemp(tmpdir() + '/hr-onboarding-http-'), store = dir + '/store.json';
  const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r)); const port = socket.address().port; await new Promise(r => socket.close(r));
  const child = spawn(process.execPath, ['build/server.cjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, NODE_ENV: 'test', HR_TEST_STORE: store, PORT: String(port) }, stdio: 'ignore' });
  async function call(path, method = 'GET', body, cookie) { const res = await fetch(`http://127.0.0.1:${port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; } return { status: res.status, data, headers: res.headers, cookie: res.headers.get('set-cookie')?.split(';')[0] }; }
  async function login(email, password) { const r = await call('/auth/login', 'POST', { email, password }); assert.equal(r.status, 200); return r.cookie; }
  async function enroll(name) { const email = name + '@example.test'; const u = await call('/employees', 'POST', { full_name: name, email, password: 'Temporary-Onboarding-938!', department: 'Technology', country: 'Philippines' }, a); assert.equal(u.status, 201); let c = await login(email, 'Temporary-Onboarding-938!'); await call('/auth/change-password', 'POST', { new_password: 'Personal-Onboarding-938!' }, c); c = await login(email, 'Personal-Onboarding-938!'); return { user: u.data, cookie: c }; }
  let a;
  try {
    for (let i = 0; i < 100; i++) { try { if ((await call('/health')).status === 200) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    a = await login(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD); await call('/auth/change-password', 'POST', { new_password: 'Personal-Admin-Onboarding-938!' }, a); a = await login(process.env.INITIAL_ADMIN_EMAIL, 'Personal-Admin-Onboarding-938!');
    const me = (await call('/auth/me', 'GET', undefined, a)).data.user, e = await enroll('onboarding-employee'), other = await enroll('onboarding-outsider');
    assert.equal((await call('/onboarding/plans')).status, 401); assert.equal((await call('/onboarding/templates', 'GET', undefined, e.cookie)).status, 403);
    const templateInput = { ...input(), tasks: [spec('doc', { kind: 'document' }), spec('task')] };
    const t = await call('/onboarding/templates', 'POST', templateInput, a); assert.equal(t.status, 201);
    const p = await call('/onboarding/plans', 'POST', { ...templateInput, template_id: t.data.id, template_revision: t.data.revision, employee_id: e.user.id, start_date: '2026-01-01', assignments: { hr: me.id, manager: '', it: '' } }, a); assert.equal(p.status, 201);
    const path = '/onboarding/plans/' + p.data.id, doc = p.data.tasks[0], task = p.data.tasks[1];
    assert.equal((await call(path + '?view=manage', 'GET', undefined, e.cookie)).status, 403);
    assert.equal((await call(path, 'GET', undefined, other.cookie)).status, 404);
    const attempts = await Promise.all([1, 2].map(() => call(path + '/tasks/' + task.id + '/actions/submit', 'POST', { expected_revision: p.data.revision }, e.cookie)));
    assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
    let current = (await call(path, 'GET', undefined, e.cookie)).data;
    const upload = await call(path + '/tasks/' + doc.id + '/actions/submit', 'POST', { expected_revision: current.revision, file_name: 'test.pdf', file_data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\nsynthetic').toString('base64') }, e.cookie); assert.equal(upload.status, 200);
    assert.equal(upload.data.tasks[0].status, 'Needs review'); assert.equal(upload.data.files[0].data, undefined);
    const filePath = upload.data.files[0].url.replace('/api', '');
    assert.equal((await call(filePath)).status, 401); assert.equal((await call(filePath, 'GET', undefined, other.cookie)).status, 404);
    const file = await call(filePath + '?preview=1', 'GET', undefined, e.cookie); assert.equal(file.status, 200); assert.match(file.headers.get('content-disposition'), /^inline/); assert.match(file.headers.get('cache-control'), /no-store/);
    assert.equal((await call(path + '/tasks/' + doc.id + '/actions/approve?view=manage', 'POST', { expected_revision: upload.data.revision }, e.cookie)).status, 403);
    const before = JSON.parse(await readFile(store, 'utf8')).onboardingPlans;
    assert.equal((await call(path + '/tasks/' + doc.id + '/actions/approve?view=manage', 'POST', { expected_revision: upload.data.revision, note: 'x'.repeat(1001) }, a)).status, 400);
    assert.deepEqual(JSON.parse(await readFile(store, 'utf8')).onboardingPlans, before);
    const approve = await call(path + '/tasks/' + doc.id + '/actions/approve?view=manage', 'POST', { expected_revision: upload.data.revision, note: 'Reviewed' }, a); assert.equal(approve.status, 200);
    const finish = await call(path + '/actions/complete', 'POST', { expected_revision: approve.data.revision }, a); assert.equal(finish.status, 200);
    const restored = new HRDatabase(JSON.parse(await readFile(store, 'utf8'))); assert.equal(restored.onboarding(me).get(p.data.id, true).status, 'Completed'); assert.ok(restored.onboarding(me).file(upload.data.files[0].id).data);
  } finally { const exited = new Promise(r => child.once('exit', r)); child.kill(); await exited; await rm(dir, { recursive: true, force: true }); }
});
