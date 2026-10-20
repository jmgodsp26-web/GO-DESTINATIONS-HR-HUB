import crypto from 'node:crypto';
import type { AuditLog, NotificationItem, UserProfile } from '../src/types.js';
import { ONBOARDING_STAGES, ONBOARDING_OWNERS } from '../src/types/onboarding.js';
import type { OnboardingAssignmentInput, OnboardingFile, OnboardingMessage, OnboardingPlan, OnboardingPlanView, OnboardingTaskSpec, OnboardingTemplate, OnboardingTemplateInput } from '../src/types/onboarding.js';
import { taskDone } from '../src/utils/onboarding.js';
import { getTodayDateString } from '../src/utils/countryUtils.js';
import { decodeUpload } from './files.js';

export class OnboardingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const fail = (message: string, status = 400): never => { throw new OnboardingError(message, status); };
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v : fail('Enter valid onboarding details.');
function text(v: unknown, label: string, max: number, optional = false): string {
  if (typeof v !== 'string' || v.trim().length > max || (!optional && !v.trim())) fail(`${label} ${optional ? 'must be' : 'is required and must be'} ${max} characters or fewer.`);
  return (v as string).trim();
}
export function onboardingDate(value: unknown): string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Choose a valid start date.');
  return value as string;
}
export function offsetDate(date: string, offset: number): string {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}
export function validateOnboardingTemplate(value: unknown): OnboardingTemplateInput {
  const v = object(value);
  if (!Array.isArray(v.tasks) || !v.tasks.length || v.tasks.length > 30) fail('Include between 1 and 30 tasks.');
  const ids = new Set<string>();
  const tasks: OnboardingTaskSpec[] = v.tasks.map((item: unknown) => {
    const t = object(item), id = text(t.id, 'Task ID', 100);
    if (ids.has(id)) fail('Task IDs must be unique.'); ids.add(id);
    if (!ONBOARDING_STAGES.includes(t.stage) || !ONBOARDING_OWNERS.includes(t.owner) || !['task', 'acknowledgment', 'document'].includes(t.kind)) fail('Choose a valid task stage, owner, and type.');
    if (!Number.isInteger(t.due_offset) || t.due_offset < -60 || t.due_offset > 365) fail('Task due dates must be from 60 days before to 365 days after the start date.');
    if (typeof t.required !== 'boolean' || typeof t.requires_review !== 'boolean') fail('Choose valid task options.');
    const resource_url = text(t.resource_url, 'Resource link', 1500, true);
    if (resource_url) { try { const u = new URL(resource_url); if (u.protocol !== 'https:' || u.username || u.password) fail('Resource links must use HTTPS without embedded credentials.'); } catch { fail('Enter a valid HTTPS resource link.'); } }
    return { id, title: text(t.title, 'Task title', 160), instructions: text(t.instructions, 'Instructions', 3000), stage: t.stage, owner: t.owner, kind: t.kind,
      due_offset: t.due_offset, required: t.required, requires_review: t.kind === 'document' || t.requires_review, resource_url };
  });
  return { name: text(v.name, 'Checklist name', 120), description: text(v.description ?? '', 'Description', 800, true), welcome: text(v.welcome, 'Welcome message', 2000), tasks };
}
export type OnboardingState = { templates: OnboardingTemplate[]; plans: OnboardingPlan[]; files: OnboardingFile[]; messages: OnboardingMessage[] };
type Hooks = { audit: (entry: Omit<AuditLog, 'id' | 'timestamp'>) => void; notifications: NotificationItem[] };
export class OnboardingService {
  private actor: UserProfile;
  constructor(private state: OnboardingState, private users: UserProfile[], actor: UserProfile, private hooks: Hooks) {
    const current = users.find(u => u.id === actor.id);
    if (!current || current.status !== 'active' || !['admin', 'employee'].includes(current.role)) fail('Access denied.', 403);
    this.actor = current!;
  }
  private admin() { if (this.actor.role !== 'admin') fail('HR administrator access is required.', 403); }
  private audit(action: string, id: string) {
    this.hooks.audit({ action, target_type: 'onboarding', target_id: id, user_id: this.actor.id, user_name: this.actor.full_name, user_role: this.actor.role, details: action });
  }
  private revision(current: { revision: number }, expected: unknown) {
    if (expected !== current.revision) fail('This onboarding record changed. Refresh it before trying again.', 409);
  }
  private person(id: string) { const u = this.users.find(u => u.id === id && u.status === 'active'); return u ? { id: u.id, name: u.full_name, email: u.email } : null; }
  private notify(userId: string, p: OnboardingPlan, title: string, taskId?: string, manage = false) {
    if (!this.person(userId)) return;
    this.hooks.notifications.unshift({ id: 'notif-' + crypto.randomUUID(), user_id: userId, title,
      message: 'Open your onboarding checklist to view the next step.', type: 'system', read: false,
      created_at: new Date().toISOString(), link_tab: manage ? 'administration/onboarding' : 'personal/onboarding', onboarding_id: p.id, onboarding_task_id: taskId });
  }
  private plan(id: string, manage = false): OnboardingPlan {
    if (manage) this.admin();
    const p = this.state.plans.find(p => p.id === id);
    if (!p || (!manage && p.employee_id !== this.actor.id && !p.tasks.some(t => t.assigned_to === this.actor.id))) fail('Onboarding record not available.', 404);
    return p!;
  }
  private reviewAccess(p: OnboardingPlan) { this.admin(); if (p.employee_id === this.actor.id) fail('Another HR administrator must review your onboarding.', 403); }
  private assignments(input: unknown, employeeId: string, tasks: OnboardingTaskSpec[]) {
    const v = object(input), result = { hr: '', manager: '', it: '' };
    for (const role of ['hr', 'manager', 'it'] as const) {
      result[role] = text(v[role] ?? '', role + ' contact', 100, true);
      const u = this.users.find(u => u.id === result[role] && u.status === 'active');
      if ((role === 'hr' || tasks.some(t => t.owner === role)) && !u) fail(`Choose an active ${role === 'it' ? 'IT' : role} contact.`);
      if (result[role] && (!u || u.id === employeeId || (role === 'hr' && u.role !== 'admin'))) fail(`Choose a valid ${role} contact other than the new hire.`);
    }
    return result;
  }
  listTemplates() { this.admin(); return structuredClone(this.state.templates); }
  saveTemplate(value: unknown, id?: string) {
    this.admin(); const input = object(value), data = validateOnboardingTemplate(value);
    const old = id ? this.state.templates.find(t => t.id === id) : undefined;
    if (id && !old) fail('Template not found.', 404);
    if (old) this.revision(old, input.expected_revision);
    const next: OnboardingTemplate = { ...data, id: old?.id || crypto.randomUUID(), active: old?.active ?? true, revision: (old?.revision || 0) + 1, updated_at: new Date().toISOString() };
    if (old) Object.assign(old, next); else this.state.templates.push(next);
    this.audit('Save onboarding template', next.id); return structuredClone(next);
  }
  archiveTemplate(id: string, expected: unknown) {
    this.admin(); const t = this.state.templates.find(t => t.id === id); if (!t) fail('Template not found.', 404);
    this.revision(t!, expected); t!.active = false; t!.revision++; t!.updated_at = new Date().toISOString(); this.audit('Archive onboarding template', id); return structuredClone(t);
  }
  create(value: unknown): OnboardingPlanView {
    this.admin(); const v = object(value), data = validateOnboardingTemplate(v);
    const employee = this.users.find(u => u.id === v.employee_id && u.status === 'active'); if (!employee) fail('Choose an active employee.');
    if (this.state.plans.some(p => p.employee_id === employee!.id && p.status === 'Active')) fail('This employee already has an active onboarding plan.', 409);
    const template = this.state.templates.find(t => t.id === v.template_id && t.active);
    if (!template || template.revision !== v.template_revision) fail('This template changed. Select its latest version before assigning.', 409);
    const start = onboardingDate(v.start_date), assignments = this.assignments(v.assignments, employee!.id, data.tasks), now = new Date().toISOString();
    const p: OnboardingPlan = { id: crypto.randomUUID(), employee_id: employee!.id, template_id: template.id, template_revision: template.revision,
      name: data.name, welcome: data.welcome, start_date: start, assignments, status: 'Active', revision: 1, created_at: now, updated_at: now, completed_at: null, completed_by: null,
      tasks: data.tasks.map(t => ({ ...t, id: crypto.randomUUID(), assigned_to: t.owner === 'employee' ? employee!.id : assignments[t.owner], due_date: offsetDate(start, t.due_offset), status: 'Not started', read_at: null, acknowledged_at: null, submitted_at: null, completed_at: null, completed_by: null, review_note: '', file_id: null, help_open: false, last_reminded: null })) };
    this.state.plans.push(p);
    for (const id of new Set([p.employee_id, ...p.tasks.map(t => t.assigned_to)])) this.notify(id, p, id === p.employee_id ? 'Your getting-started checklist is ready' : 'New onboarding tasks assigned');
    this.audit('Assign onboarding checklist', p.id); return this.view(p, true);
  }
  private view(p: OnboardingPlan, manage = false): OnboardingPlanView {
    const employee = this.users.find(u => u.id === p.employee_id);
    const tasks = p.tasks.filter(t => manage || t.assigned_to === this.actor.id), ids = new Set(tasks.map(t => t.id));
    const peopleIds = new Set([p.assignments.hr, ...tasks.map(t => t.assigned_to)]);
    const files = this.state.files.filter(f => f.plan_id === p.id && ids.has(f.task_id)).map(({ data, ...f }) => ({ ...f, mime_type: f.mime_type || data?.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream', url: `/api/onboarding/files/${f.id}` }));
    return structuredClone({ ...p, tasks, assignments: manage ? p.assignments : { hr: p.assignments.hr, manager: '', it: '' },
      employee_name: employee?.full_name || 'Former employee', department: employee?.department || '', country: employee?.country || '', timezone: employee?.timezone || 'UTC',
      hr_contact: this.person(p.assignments.hr), people: [...peopleIds].map(id => this.person(id)).filter(p => p !== null),
      messages: this.state.messages.filter(m => m.plan_id === p.id && (manage || ids.has(m.task_id))), files, scope: manage ? 'manage' : p.employee_id === this.actor.id ? 'mine' : 'assigned' });
  }
  list(manage = false) {
    if (manage) this.admin();
    return this.state.plans.filter(p => manage || p.employee_id === this.actor.id || p.tasks.some(t => t.assigned_to === this.actor.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).map(p => this.view(p, manage));
  }
  get(id: string, manage = false) { return this.view(this.plan(id, manage), manage); }
  summary() {
    const plans = this.list(), active = plans.filter(p => p.status === 'Active');
    const tasks = active.flatMap(p => p.tasks.map(t => ({ ...t, today: getTodayDateString(p.timezone) })));
    return { available: plans.length > 0, active: active.length, incomplete: tasks.filter(t => !taskDone(t)).length,
      overdue: tasks.filter(t => !taskDone(t) && t.status !== 'Needs review' && t.due_date < t.today).length, needs_review: tasks.filter(t => t.status === 'Needs review').length };
  }
  update(id: string, value: unknown) {
    this.admin(); const p = this.plan(id, true), v = object(value); this.revision(p, v.expected_revision);
    if (p.status !== 'Active') fail('Only active onboarding plans can be updated.');
    const start = onboardingDate(v.start_date), assignments = this.assignments(v.assignments, p.employee_id, p.tasks);
    const welcome = text(v.welcome, 'Welcome message', 2000), name = text(v.name, 'Checklist name', 120);
    const changedOwners = new Set<string>();
    const nextTasks = structuredClone(p.tasks);
    for (const t of nextTasks) if (!taskDone(t)) {
      t.due_date = offsetDate(start, t.due_offset);
      const nextOwner = t.owner === 'employee' ? p.employee_id : assignments[t.owner];
      if (t.assigned_to !== nextOwner) {
        // Existing submissions and private conversations remain with their original owner.
        if (t.file_id || t.read_at || t.submitted_at || this.state.messages.some(m => m.plan_id === p.id && m.task_id === t.id)) fail('A task with a submission or conversation cannot be reassigned. Keep its owner or waive it and start a replacement plan.');
        t.assigned_to = nextOwner; changedOwners.add(nextOwner);
      }
    }
    p.tasks = nextTasks; p.start_date = start; p.assignments = assignments; p.welcome = welcome; p.name = name; p.revision++; p.updated_at = new Date().toISOString();
    for (const owner of changedOwners) this.notify(owner, p, 'Onboarding tasks assigned to you');
    this.audit('Update onboarding schedule and contacts', id); return this.view(p, true);
  }
  planAction(id: string, action: string, value: unknown) {
    this.admin(); const p = this.plan(id, true), v = object(value); this.revision(p, v.expected_revision); this.reviewAccess(p);
    if (action === 'complete') {
      if (p.status !== 'Active' || p.tasks.some(t => t.required && !taskDone(t))) fail('Complete or waive every required task before finishing onboarding.');
      p.status = 'Completed'; p.completed_at = new Date().toISOString(); p.completed_by = this.actor.id;
      this.notify(p.employee_id, p, 'Your onboarding is complete');
    } else if (action === 'cancel') {
      if (p.status !== 'Active') fail('Only active plans can be cancelled.'); text(v.note, 'Cancellation reason', 1000);
      p.status = 'Cancelled';
    } else if (action === 'reopen') {
      if (p.status !== 'Completed' || this.state.plans.some(other => other.id !== p.id && other.employee_id === p.employee_id && other.status === 'Active')) fail('This plan cannot be reopened while another is active.');
      p.status = 'Active'; p.completed_at = null; p.completed_by = null;
    } else fail('Unknown onboarding action.');
    if (v.note) this.state.messages.push({ id: crypto.randomUUID(), plan_id: p.id, task_id: '', author_id: this.actor.id, author_name: this.actor.full_name, text: text(v.note, 'Note', 1000), created_at: new Date().toISOString() });
    p.revision++; p.updated_at = new Date().toISOString(); this.audit(`Onboarding ${action}`, p.id); return this.view(p, true);
  }
  taskAction(id: string, taskId: string, action: string, value: unknown, manage = false) {
    const p = this.plan(id, manage), v = object(value); this.revision(p, v.expected_revision);
    if (p.status !== 'Active') fail('This onboarding plan is closed.');
    const t = p.tasks.find(t => t.id === taskId); if (!t || (!manage && t.assigned_to !== this.actor.id)) fail('Task not available.', 404);
    const task = t!, now = new Date().toISOString(), owns = task.assigned_to === this.actor.id;
    const review = ['approve', 'return', 'waive', 'remind', 'reply'].includes(action);
    if (review) { if (!manage) fail('Open this task in Administration to review it.', 403); this.reviewAccess(p); }
    else if (!owns) fail('Only the assigned person can submit or acknowledge this task.', 403);
    if (taskDone(task) && !['help', 'reply'].includes(action)) fail('This task is already finished.');
    if (action === 'read') { if (task.kind !== 'acknowledgment') fail('This task does not require acknowledgment.'); task.read_at ||= now; }
    else if (action === 'start') { if (task.status !== 'Not started') fail('This task has already started.'); task.status = 'In progress'; }
    else if (action === 'submit' || action === 'acknowledge') {
      if (task.status === 'Needs review') fail('This task is already waiting for HR review.');
      if (task.kind === 'acknowledgment') { if (action !== 'acknowledge' || !task.read_at || v.acknowledged !== true) fail('Read the instructions and explicitly acknowledge them first.'); task.acknowledged_at = now; }
      else if (action !== 'submit') fail('This task does not require acknowledgment.');
      if (task.kind === 'document') {
        const name = text(v.file_name, 'File name', 180); let data: string;
        try { decodeUpload(v.file_data); data = v.file_data; } catch (e) { fail((e as Error).message); }
        const file: OnboardingFile = { id: crypto.randomUUID(), plan_id: p.id, task_id: task.id, name, data: data!, mime_type: decodeUpload(data!).mime, uploaded_at: now, uploaded_by: this.actor.id };
        this.state.files.push(file); task.file_id = file.id;
      }
      task.submitted_at = now; task.review_note = ''; task.help_open = false;
      task.status = task.requires_review ? 'Needs review' : 'Completed';
      if (task.status === 'Completed') { task.completed_at = now; task.completed_by = this.actor.id; }
      else this.notify(p.assignments.hr, p, 'An onboarding task needs your review', task.id, true);
    } else if (action === 'approve') {
      if (task.status !== 'Needs review') fail('This task is not awaiting review.');
      if (owns) fail('Another HR administrator must review your submitted task.', 403);
      task.status = 'Completed'; task.completed_at = now; task.completed_by = this.actor.id; task.review_note = text(v.note ?? '', 'Review note', 1000, true);
      this.notify(task.assigned_to, p, 'Your onboarding task was approved', task.id);
    } else if (action === 'return') {
      if (task.status !== 'Needs review') fail('This task is not awaiting review.');
      if (owns) fail('Another HR administrator must review your submitted task.', 403);
      task.review_note = text(v.note, 'Changes needed', 1000); task.status = 'In progress';
      this.notify(task.assigned_to, p, 'An onboarding task needs changes', task.id);
    } else if (action === 'waive') {
      task.review_note = text(v.note, 'Waiver reason', 1000); task.status = 'Waived'; task.completed_at = now; task.completed_by = this.actor.id;
      this.notify(task.assigned_to, p, 'An onboarding task was waived by HR', task.id);
    } else if (action === 'remind') {
      const today = getTodayDateString(this.users.find(u => u.id === p.employee_id)?.timezone);
      if (task.last_reminded === today) fail('A reminder has already been sent for this task today.');
      this.notify(task.assigned_to, p, 'Onboarding reminder', task.id); task.last_reminded = today;
    } else if (action === 'help' || action === 'reply') {
      const message = text(v.message, 'Message', 2000);
      if (this.state.messages.filter(m => m.plan_id === p.id && m.task_id === task.id).length >= 100) fail('This conversation has reached its limit. Contact HR directly.');
      this.state.messages.push({ id: crypto.randomUUID(), plan_id: p.id, task_id: task.id, author_id: this.actor.id, author_name: this.actor.full_name, text: message, created_at: now });
      task.help_open = action === 'help';
      this.notify(action === 'help' ? p.assignments.hr : task.assigned_to, p, action === 'help' ? 'An employee needs onboarding help' : 'HR replied to your onboarding question', task.id, action === 'help');
    } else fail('Unknown task action.');
    p.revision++; p.updated_at = now; this.audit(`Onboarding task: ${action}`, p.id); return this.view(p, manage);
  }
  file(id: string) {
    const f = this.state.files.find(f => f.id === id); if (!f) fail('File not available.', 404);
    const p = this.state.plans.find(p => p.id === f!.plan_id), task = p?.tasks.find(t => t.id === f!.task_id);
    if (!p || !task || !f!.data || (this.actor.role !== 'admin' && task.assigned_to !== this.actor.id)) fail('File not available.', 404);
    return structuredClone(f!);
  }
  reminders() {
    // In-app reminders are evaluated on authenticated activity, once per task/day.
    for (const p of this.state.plans.filter(p => p.status === 'Active')) {
      const today = getTodayDateString(this.users.find(u => u.id === p.employee_id)?.timezone);
      for (const t of p.tasks) if (t.assigned_to === this.actor.id && !taskDone(t) && t.status !== 'Needs review' && t.due_date <= today && t.last_reminded !== today) {
        this.notify(this.actor.id, p, t.due_date < today ? 'An onboarding task is overdue' : 'An onboarding task is due today', t.id); t.last_reminded = today;
      }
    }
  }
  canSeeNotification(n: NotificationItem) {
    if (!n.onboarding_id) return true;
    const p = this.state.plans.find(p => p.id === n.onboarding_id); if (!p || p.status === 'Cancelled') return false;
    if (n.link_tab === 'administration/onboarding') return this.actor.role === 'admin';
    return n.onboarding_task_id ? p.tasks.some(t => t.id === n.onboarding_task_id && t.assigned_to === this.actor.id) : p.employee_id === this.actor.id || p.tasks.some(t => t.assigned_to === this.actor.id);
  }
}
