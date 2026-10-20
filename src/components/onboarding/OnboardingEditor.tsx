import React, { useEffect, useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { GENERAL_ONBOARDING, ownerLabels } from '../../utils/onboarding';
import { ONBOARDING_STAGES, ONBOARDING_OWNERS, type OnboardingTemplate, type OnboardingTemplateInput, type OnboardingTaskSpec, type OnboardingPlanView } from '../../types/onboarding';
import type { UserProfile } from '../../types';

export function TaskFields({ tasks, onChange }: { tasks: OnboardingTaskSpec[]; onChange: (tasks: OnboardingTaskSpec[]) => void }) {
  const update = (id: string, change: Partial<OnboardingTaskSpec>) => onChange(tasks.map(t => t.id === id ? { ...t, ...change } : t));
  function move(index: number, offset: number) { const next = [...tasks]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); }
  return <section className="onb-task-editor"><div className="onb-section-heading"><div><h3>Checklist tasks</h3><p>Due dates are calendar days relative to the start date. Day 0 is the first day.</p></div><span>{tasks.length}/30</span></div>
    {tasks.map((t, i) => <details key={t.id} className="onb-edit-task" open={!t.title}>
      <summary><span>{i + 1}. {t.title || 'New task'}</span><small>{ownerLabels[t.owner]} · {t.stage}</small></summary>
      <div className="onb-fields"><label className="onb-full">Task title<input required maxLength={160} value={t.title} onChange={e => update(t.id, { title: e.target.value })} /></label>
        <label className="onb-full">Instructions<textarea required maxLength={3000} rows={3} value={t.instructions} onChange={e => update(t.id, { instructions: e.target.value })} /></label>
        <label>Stage<select value={t.stage} onChange={e => update(t.id, { stage: e.target.value as OnboardingTaskSpec['stage'] })}>{ONBOARDING_STAGES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Responsible person<select value={t.owner} onChange={e => update(t.id, { owner: e.target.value as OnboardingTaskSpec['owner'] })}>{ONBOARDING_OWNERS.map(o => <option value={o} key={o}>{ownerLabels[o]}</option>)}</select></label>
        <label>Task type<select value={t.kind} onChange={e => update(t.id, { kind: e.target.value as OnboardingTaskSpec['kind'], requires_review: e.target.value === 'document' || t.requires_review })}><option value="task">Complete a task</option><option value="acknowledgment">Read and acknowledge</option><option value="document">Submit a document</option></select></label>
        <label>Days from start date<input type="number" required min={-60} max={365} value={t.due_offset} onChange={e => update(t.id, { due_offset: Number(e.target.value) })} /><small>Use -1 for the day before, 7 for a week after.</small></label>
        <label className="onb-full">Resource link (optional)<input type="url" placeholder="https://…" maxLength={1500} value={t.resource_url} onChange={e => update(t.id, { resource_url: e.target.value })} /><small>Use an approved company resource. This is not an electronic-signature request.</small></label>
        <label className="onb-check"><input type="checkbox" checked={t.required} onChange={e => update(t.id, { required: e.target.checked })} />Required to finish onboarding</label>
        <label className="onb-check"><input type="checkbox" checked={t.kind === 'document' || t.requires_review} disabled={t.kind === 'document'} onChange={e => update(t.id, { requires_review: e.target.checked })} />HR must review completion</label>
        <div className="onb-inline onb-full"><button type="button" className="go-button go-button-secondary" disabled={i === 0} aria-label={`Move task ${i + 1} up`} onClick={() => move(i, -1)}><ArrowUp size={15} />Up</button><button type="button" className="go-button go-button-secondary" disabled={i === tasks.length - 1} aria-label={`Move task ${i + 1} down`} onClick={() => move(i, 1)}><ArrowDown size={15} />Down</button><button type="button" className="go-button go-button-quiet onb-danger" onClick={() => onChange(tasks.filter(task => task.id !== t.id))}><Trash2 size={15} />Remove task</button></div>
      </div>
    </details>)}
    <button type="button" className="go-button go-button-secondary" disabled={tasks.length >= 30} onClick={() => onChange([...tasks, { id: crypto.randomUUID(), title: '', instructions: '', stage: 'First day', owner: 'employee', kind: 'task', due_offset: 0, required: true, requires_review: false, resource_url: '' }])}><Plus size={16} />Add task</button>
  </section>;
}

export function OnboardingEditor({ mode, template, templates, plan, employeeId, onClose, onSaved }: {
  mode: 'template' | 'assign' | 'schedule'; template?: OnboardingTemplate; templates: OnboardingTemplate[]; plan?: OnboardingPlanView; employeeId?: string; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const firstTemplate = templates.find(t => t.active);
  const [form, setForm] = useState<OnboardingTemplateInput>(() => structuredClone(template || (mode === 'assign' ? firstTemplate : undefined) || GENERAL_ONBOARDING));
  const [selectedTemplate, setSelectedTemplate] = useState(firstTemplate?.id || '');
  const [employee, setEmployee] = useState(plan?.employee_id || employeeId || '');
  const [start, setStart] = useState(plan?.start_date || '');
  const [assignments, setAssignments] = useState(plan?.assignments || { hr: user?.id || '', manager: '', it: '' });
  const [employees, setEmployees] = useState<UserProfile[]>([]), [loadError, setLoadError] = useState(''), [loaded, setLoaded] = useState(mode === 'template');
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const canLeave = useUnsavedChanges(dirty, busy);
  const close = () => { if (canLeave()) onClose(); };
  async function loadEmployees() { setLoadError(''); try { setEmployees(await api.getAllEmployees()); setLoaded(true); } catch (e) { setLoadError((e as Error).message); } }
  useEffect(() => { if (mode !== 'template') void loadEmployees(); if (plan) setForm({ name: plan.name, welcome: plan.welcome, tasks: plan.tasks, description: '' }); }, []);
  function change(next: Partial<OnboardingTemplateInput>) { setForm(f => ({ ...f, ...next })); setDirty(true); }
  function selectEmployee(id: string) { setEmployee(id); const emp = employees.find(e => e.id === id); if (emp) setStart(emp.hire_date || emp.date_joined || ''); setDirty(true); }
  useEffect(() => { if (mode === 'assign' && employee && !start && loaded) { const emp = employees.find(e => e.id === employee); if (emp) setStart(emp.hire_date || emp.date_joined || ''); } }, [loaded]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'template') await api.saveOnboardingTemplate(form, template);
      else if (mode === 'schedule') await api.updateOnboarding(plan!, { name: form.name, welcome: form.welcome, start_date: start, assignments });
      else { const t = templates.find(t => t.id === selectedTemplate); if (!t) throw new Error('Choose an active template.'); await api.assignOnboarding({ ...form, employee_id: employee, start_date: start, assignments, template_id: t.id, template_revision: t.revision }); }
      setDirty(false); onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const activeEmployees = employees.filter(e => e.status === 'active');
  return <Dialog title={mode === 'template' ? template ? 'Edit onboarding template' : 'Create onboarding template' : mode === 'schedule' ? 'Schedule and contacts' : 'Start onboarding'} onClose={close} busy={busy} className="onb-dialog onb-editor-dialog">
    <form onSubmit={save} onInvalidCapture={e => { const section = (e.target as HTMLElement).closest('details'); if (section) section.open = true; }}><div className="go-dialog-body">
      {loadError && <div className="onb-error" role="alert">{loadError}<button type="button" onClick={loadEmployees}>Try again</button></div>}
      {error && <div className="onb-error" role="alert">{error}</div>}
      <fieldset disabled={busy || !loaded} className="onb-fields">
        {mode === 'assign' && <><label>Employee<select required value={employee} onChange={e => selectEmployee(e.target.value)}><option value="">Choose employee</option>{activeEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name} · {e.department}</option>)}</select></label><label>Checklist template<select required value={selectedTemplate} onChange={e => { if (dirty && !window.confirm('Replace the checklist fields with this template? Your employee and contacts will be kept.')) return; const t = templates.find(t => t.id === e.target.value); setSelectedTemplate(e.target.value); if (t) setForm(structuredClone(t)); setDirty(true); }}><option value="">Choose template</option>{templates.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></>}
        <label className="onb-full">Checklist name<input required maxLength={120} value={form.name} onChange={e => change({ name: e.target.value })} /></label>
        {mode === 'template' && <label className="onb-full">Description<textarea rows={2} maxLength={800} value={form.description} onChange={e => change({ description: e.target.value })} /></label>}
        <label className="onb-full">Welcome message<textarea required rows={3} maxLength={2000} value={form.welcome} onChange={e => change({ welcome: e.target.value })} /></label>
        {mode !== 'template' && <><label>Onboarding start date<input required type="date" value={start} min="2000-01-01" max="2099-12-31" onChange={e => { setStart(e.target.value); setDirty(true); }} /><small>This schedules checklist tasks; it does not change the employee profile.</small></label>{(['hr', 'manager', 'it'] as const).map(role => <label key={role}>{ownerLabels[role]} contact{role !== 'hr' && !form.tasks.some(t => t.owner === role) ? ' (optional)' : ''}<select required={role === 'hr' || form.tasks.some(t => t.owner === role)} value={assignments[role]} onChange={e => { setAssignments(a => ({ ...a, [role]: e.target.value })); setDirty(true); }}><option value="">Choose {ownerLabels[role]}</option>{activeEmployees.filter(e => e.id !== employee && (role !== 'hr' || e.role === 'admin')).map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label>)}</>}
        {mode !== 'schedule' && <div className="onb-full"><TaskFields tasks={form.tasks} onChange={tasks => change({ tasks })} /></div>}
      </fieldset>
      <p className="onb-hint">{mode === 'template' ? 'Template edits apply to future assignments. Existing employee checklists keep their original instructions.' : mode === 'assign' ? 'Review the tasks before assigning. Only the new hire and assigned staff receive in-app notifications. No email will be sent.' : 'Unfinished task dates move with the start date. Completed tasks retain their original dates. Submitted tasks and conversations keep their original owner.'}</p>
    </div><footer className="onb-inline"><button type="button" className="go-button go-button-secondary" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="go-button go-button-primary" disabled={busy || !loaded || (mode === 'assign' && !selectedTemplate)}>{busy ? 'Saving…' : mode === 'assign' ? 'Assign checklist' : 'Save changes'}</button></footer></form>
  </Dialog>;
}
