import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Clock3, Plus, RefreshCw, Settings2, Sparkles, FileText, MessageCircle, CalendarDays } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useNavigation } from '../../context/NavigationContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { getTodayDateString } from '../../utils/countryUtils';
import { onboardingProgress, taskDone, ownerLabels } from '../../utils/onboarding';
import { ONBOARDING_STAGES, type OnboardingPlanView, type OnboardingTemplate } from '../../types/onboarding';
import { PageHeading } from '../common/WorkspaceUI';
import { Dialog } from '../common/Dialog';
import { OnboardingEditor } from './OnboardingEditor';
import { OnboardingTaskDialog, formatOnboardingDate } from './OnboardingTaskDialog';

export function OnboardingView() {
  const { user } = useAuth(), { isAdministration: manage } = useWorkspace(), { params, navigate } = useNavigation(), { refresh: refreshSummary } = useOnboarding();
  const [plans, setPlans] = useState<OnboardingPlanView[]>([]), [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'plans' | 'templates'>('plans');
  const [filter, setFilter] = useViewPreference<string>(`onboarding:${manage}:filter`, 'Active');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ mode: 'template' | 'assign' | 'schedule'; template?: OnboardingTemplate; plan?: OnboardingPlanView }>();
  const [action, setAction] = useState<'complete' | 'cancel' | 'reopen'>();
  const planId = params.get('id'), taskId = params.get('task'), employeeId = params.get('employee');
  const selected = plans.find(p => p.id === planId);
  const base = manage ? 'administration/onboarding' : 'personal/onboarding';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [p, t] = await Promise.all([api.getOnboardingPlans(manage), manage ? api.getOnboardingTemplates() : Promise.resolve([])]); setPlans(p); setTemplates(t); setLoaded(true); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [manage]);
  useEffect(() => { void load(); }, [load]);
  function changed(p: OnboardingPlanView) { setPlans(old => old.map(row => row.id === p.id ? p : row)); refreshSummary(); }
  function saved() { setEditor(undefined); setNotice('Onboarding changes saved.'); void load(); refreshSummary(); }
  const active = plans.filter(p => p.status === 'Active');
  const needsReview = (p: OnboardingPlanView) => p.tasks.some(t => t.status === 'Needs review' || t.help_open);
  const overdue = (p: OnboardingPlanView) => p.tasks.some(t => !taskDone(t) && t.status !== 'Needs review' && t.due_date < getTodayDateString(p.timezone));
  const filtered = plans.filter(p => {
    if (employeeId && p.employee_id !== employeeId) return false;
    if (!`${p.employee_name} ${p.department} ${p.name}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'All') return true;
    if (filter === 'Needs review') return p.status === 'Active' && needsReview(p);
    if (filter === 'Overdue') return p.status === 'Active' && overdue(p);
    if (filter === 'Starting soon') {
      const today = getTodayDateString(p.timezone);
      const end = new Date(`${today}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 14);
      return p.status === 'Active' && p.start_date >= today && p.start_date <= end.toISOString().slice(0, 10);
    }
    return p.status === filter;
  });
  return <div className="onb-page">
    {selected ? <>
      <button type="button" className="go-button go-button-quiet" onClick={() => navigate(base)}><ArrowLeft size={16} />{manage ? 'All onboarding plans' : 'My checklists'}</button>
      <div className="go-page-header"><PageHeading eyebrow={manage ? 'Onboarding' : selected.scope === 'mine' ? 'Getting started' : 'Assigned to you'} title={selected.scope === 'mine' && !manage ? `Welcome, ${selected.employee_name.split(' ')[0]}` : selected.employee_name} description={`${selected.department || 'Employee'} · Starts ${formatOnboardingDate(selected.start_date)}`} />{manage && selected.status === 'Active' && <button type="button" className="go-button go-button-secondary" onClick={() => setEditor({ mode: 'schedule', plan: selected })}><Settings2 size={16} />Schedule & contacts</button>}</div>
      {error && <ErrorMessage message={error} onRetry={load} />}
      <div className="onb-detail-layout"><div>
        <section className="onb-welcome"><span className="onb-eyebrow">{selected.name}</span><h2>{selected.status === 'Completed' ? 'Onboarding completed' : selected.status === 'Cancelled' ? 'This plan is cancelled' : selected.scope === 'assigned' ? 'Help make their first days a great start.' : 'A clear path to your first days.'}</h2><p>{selected.welcome}</p><Progress tasks={selected.tasks} /></section>
        {manage && selected.status === 'Active' && selected.tasks.some(t => t.help_open) && <div className="onb-attention"><MessageCircle size={18} />An employee has asked for help. Open the task marked “Needs help” to reply.</div>}
        {!manage && <p className="onb-hint">You see only tasks assigned to you. HR tracks the full onboarding plan.</p>}
        {selected.tasks.length === 0 && <div className="onb-empty"><CheckCircle2 /><h2>No tasks assigned to you</h2><p>Your HR contact is preparing the next steps.</p></div>}
        {ONBOARDING_STAGES.map((stage, index) => { const tasks = selected.tasks.filter(t => t.stage === stage); if (!tasks.length) return null; return <section className="onb-stage" key={stage}><header><span className="onb-stage-number">{index + 1}</span><h2>{stage}</h2><small>{tasks.filter(taskDone).length} of {tasks.length} finished</small></header>{tasks.map(t => <button type="button" key={t.id} className={`onb-task-row ${taskDone(t) ? 'is-done' : ''}`} onClick={() => navigate(`${base}?id=${selected.id}&task=${t.id}`)}><span className="onb-task-icon">{taskDone(t) ? <CheckCircle2 size={21} /> : t.kind === 'document' ? <FileText size={20} /> : <ClipboardList size={20} />}</span><span className="onb-task-copy"><strong>{t.title}</strong><small>{manage ? `${selected.people.find(p => p.id === t.assigned_to)?.name || ownerLabels[t.owner]} · ` : ''}Due {formatOnboardingDate(t.due_date)} · {t.required ? 'Required' : 'Optional'}</small>{t.help_open && <em>Needs help</em>}{!taskDone(t) && t.status !== 'Needs review' && selected.status === 'Active' && t.due_date < getTodayDateString(selected.timezone) && <em>Overdue</em>}</span><span className={`onb-status onb-status-${t.status.toLowerCase().replaceAll(' ', '-')}`}>{t.status}</span><ArrowRight size={17} /></button>)}</section>; })}
      </div><aside className="onb-support"><section><h2>Your HR contact</h2>{selected.hr_contact ? <><strong>{selected.hr_contact.name}</strong><a href={`mailto:${selected.hr_contact.email}`}>{selected.hr_contact.email}</a><p>Open a task and use “Ask HR” when you need help with that step.</p></> : <p>The assigned HR contact is unavailable. Contact an active HR administrator.</p>}</section><section><h2>Important details</h2><dl><div><dt>Start date</dt><dd>{formatOnboardingDate(selected.start_date)}</dd></div><div><dt>Plan status</dt><dd>{selected.status}</dd></div><div><dt>Time zone</dt><dd>{selected.timezone}</dd></div></dl></section><section><h2>Useful pages</h2><button type="button" onClick={() => navigate('personal/profile')}>My profile <ArrowRight size={15} /></button><button type="button" onClick={() => navigate('personal/documents')}>My documents <ArrowRight size={15} /></button><button type="button" onClick={() => navigate('personal/announcements')}>Company updates <ArrowRight size={15} /></button></section>
        {manage && <section><h2>HR controls</h2>{selected.employee_id === user?.id ? <p>Another HR administrator must finish or cancel your onboarding.</p> : <>{selected.status === 'Active' && <><button type="button" className="go-button go-button-primary" disabled={selected.tasks.some(t => t.required && !taskDone(t))} onClick={() => setAction('complete')}>Finish onboarding</button><p>Every required task must be complete or waived.</p><button type="button" className="go-button go-button-quiet onb-danger" onClick={() => setAction('cancel')}>Cancel onboarding</button></>}{selected.status === 'Completed' && <button type="button" className="go-button go-button-secondary" onClick={() => setAction('reopen')}>Reopen plan</button>}</>}</section>}
      </aside></div>
      {taskId && selected.tasks.some(t => t.id === taskId) && <OnboardingTaskDialog key={taskId} plan={selected} taskId={taskId} manage={manage} onClose={() => navigate(`${base}?id=${selected.id}`)} onChange={changed} />}
      {taskId && !selected.tasks.some(t => t.id === taskId) && <ErrorMessage message="This task is not assigned to you or is no longer available." onRetry={() => navigate(`${base}?id=${selected.id}`)} />}
      {action && <PlanAction plan={selected} action={action} onClose={() => setAction(undefined)} onChange={p => { changed(p); setAction(undefined); }} />}
    </> : <>
      <div className="go-page-header"><PageHeading eyebrow={manage ? 'People & onboarding' : 'My workspace'} title={manage ? 'A great start, together.' : 'Getting started'} description={manage ? 'Prepare each new hire, follow progress, and keep the next step clear.' : 'Your welcome checklist and the onboarding tasks assigned to you.'} /><div className="onb-inline"><button type="button" className="go-button go-button-secondary" disabled={loading} onClick={load}><RefreshCw size={16} />Refresh</button>{manage && <button type="button" className="go-button go-button-primary" disabled={!loaded || Boolean(error) || !templates.some(t => t.active)} onClick={() => setEditor({ mode: 'assign' })}><Plus size={16} />Start onboarding</button>}</div></div>
      {notice && <div className="onb-success" role="status"><CheckCircle2 size={18} />{notice}</div>}
      {error && <ErrorMessage message={error} onRetry={load} />}
      {loading && <p role="status" className="go-refresh-status">{loaded ? 'Refreshing onboarding…' : 'Loading onboarding…'}</p>}
      {planId && loaded && !error && <ErrorMessage message="This onboarding plan is not available to your account." onRetry={() => navigate(base)} />}
      {loaded && <>
        <div className="onb-summary"><button type="button" onClick={() => { setFilter('Active'); setTab('plans'); }}><ClipboardList size={20} /><span><strong>{active.length}</strong><small>In progress</small></span></button><button type="button" onClick={() => { setFilter('Needs review'); setTab('plans'); }}><MessageCircle size={20} /><span><strong>{active.filter(needsReview).length}</strong><small>Need review or help</small></span></button><button type="button" onClick={() => { setFilter('Overdue'); setTab('plans'); }}><Clock3 size={20} /><span><strong>{active.filter(overdue).length}</strong><small>Have overdue tasks</small></span></button></div>
        {manage && <div className="onb-tabs" role="group" aria-label="Onboarding views"><button type="button" aria-pressed={tab === 'plans'} onClick={() => setTab('plans')}>Employee plans</button><button type="button" aria-pressed={tab === 'templates'} onClick={() => setTab('templates')}>Checklist templates</button></div>}
        {tab === 'templates' && manage ? <section className="onb-template-panel"><div className="onb-section-heading"><div><h2>Reusable checklists</h2><p>Prepare once, then tailor a copy for each new hire.</p></div><button type="button" className="go-button go-button-primary" onClick={() => setEditor({ mode: 'template' })}><Plus size={16} />Create template</button></div><div className="onb-template-grid">{templates.map(t => <article key={t.id}><span className="onb-status">{t.active ? `Version ${t.revision}` : 'Archived'}</span><h3>{t.name}</h3><p>{t.description}</p><small>{t.tasks.length} tasks · {t.tasks.filter(t => t.required).length} required</small><div className="onb-inline"><button type="button" className="go-button go-button-secondary" onClick={() => setEditor({ mode: 'template', template: t })}>{t.active ? 'Edit template' : 'View / edit'}</button>{t.active && <button type="button" className="go-button go-button-quiet" disabled={loading} onClick={async () => { if (!window.confirm('Archive this template? Existing employee checklists are kept.')) return; setLoading(true); try { await api.archiveOnboardingTemplate(t); await load(); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }}>Archive</button>}</div></article>)}</div>{!templates.length && <div className="onb-empty"><Sparkles size={32} /><h2>Your first checklist starts here</h2><p>Create a template using the included general employee checklist. Add your own document and policy requirements before assigning it.</p><button type="button" className="go-button go-button-primary" onClick={() => setEditor({ mode: 'template' })}>Set up general onboarding</button></div>}</section> : <>
          <div className="onb-toolbar"><label>Find a checklist<input type="search" placeholder="Employee, department, or checklist" value={query} onChange={e => setQuery(e.target.value)} /></label><label>Show<select value={filter} onChange={e => setFilter(e.target.value)}>{['Active', 'Starting soon', 'Needs review', 'Overdue', 'Completed', 'Cancelled', 'All'].map(f => <option key={f}>{f}</option>)}</select></label>{employeeId && <button type="button" className="go-button go-button-secondary" onClick={() => navigate(base)}>Clear employee filter</button>}</div>
          {!filtered.length ? <div className="onb-empty"><ClipboardList size={32} /><h2>{plans.length ? 'No checklists match these filters' : manage ? 'Ready for your next new hire' : 'You’re all set for now'}</h2><p>{plans.length ? 'Try another filter or search.' : manage ? 'Create a reusable template, then choose an employee and assign their checklist.' : 'An assigned onboarding checklist will appear here when HR prepares it.'}</p>{manage && !templates.some(t => t.active) && <button type="button" className="go-button go-button-primary" onClick={() => setEditor({ mode: 'template' })}>Create your first template</button>}</div> : <div className="onb-plan-list">{filtered.map(p => <button type="button" key={p.id} onClick={() => navigate(`${base}?id=${p.id}`)} className="onb-plan-card"><div className="onb-person"><span className="onb-avatar">{p.employee_name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span><div><strong>{p.employee_name}</strong><small>{p.department || 'Employee'} · {p.scope === 'assigned' ? 'Tasks assigned to you' : p.name}</small></div></div><div className="onb-plan-date"><CalendarDays size={16} /><span>Starts {formatOnboardingDate(p.start_date)}</span></div><Progress tasks={p.tasks} /><span className="onb-status">{p.status}</span><ArrowRight size={18} /></button>)}</div>}
        </>}
      </>}
    </>}
    {editor && <OnboardingEditor {...editor} templates={templates} employeeId={employeeId || undefined} onClose={() => setEditor(undefined)} onSaved={saved} />}
  </div>;
}
function Progress({ tasks }: { tasks: OnboardingPlanView['tasks'] }) { const progress = onboardingProgress(tasks); return <div className="onb-progress"><div><span>{progress.completed} of {progress.total} required tasks finished</span><strong>{progress.percent}%</strong></div><progress value={progress.total ? progress.completed : 1} max={progress.total || 1} aria-label="Required onboarding tasks finished" />{progress.total === 0 && <small>No required tasks assigned.</small>}</div>; }
function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="onb-error" role="alert"><p>{message}</p><button type="button" onClick={onRetry}>Refresh / try again</button></div>; }
function PlanAction({ plan, action, onClose, onChange }: { plan: OnboardingPlanView; action: string; onClose: () => void; onChange: (p: OnboardingPlanView) => void }) {
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''); const canLeave = useUnsavedChanges(Boolean(note), busy);
  const title = action === 'complete' ? 'Finish onboarding?' : action === 'cancel' ? 'Cancel this onboarding plan?' : 'Reopen onboarding?';
  return <Dialog title={title} busy={busy} onClose={() => { if (canLeave()) onClose(); }} className="onb-dialog"><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { onChange(await api.onboardingPlanAction(plan, action, note)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><div className="go-dialog-body"><p>{action === 'complete' ? 'This closes the checklist and notifies the employee. Any unfinished optional tasks will also become read-only.' : action === 'cancel' ? 'Tasks and submissions will be retained for HR records, but no further work or reminders will be allowed.' : 'This lets assigned employees continue working on unfinished tasks.'}</p>{error && <div className="onb-error" role="alert">{error}</div>}<label className="onb-field">{action === 'cancel' ? 'Reason for cancellation' : 'Note (optional)'}<textarea required={action === 'cancel'} maxLength={1000} rows={3} value={note} onChange={e => setNote(e.target.value)} disabled={busy} /></label></div><footer className="onb-inline"><button type="button" className="go-button go-button-secondary" disabled={busy} onClick={() => { if (canLeave()) onClose(); }}>Go back</button><button type="submit" className="go-button go-button-primary" disabled={busy}>{busy ? 'Saving…' : action === 'complete' ? 'Finish onboarding' : action === 'cancel' ? 'Cancel plan' : 'Reopen plan'}</button></footer></form></Dialog>;
}
