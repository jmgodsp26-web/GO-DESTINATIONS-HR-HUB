import React, { useState } from 'react';
import { ExternalLink, CheckCircle2, Upload, MessageCircle } from 'lucide-react';
import type { OnboardingPlanView } from '../../types/onboarding';
import { ownerLabels, taskDone } from '../../utils/onboarding';
import { readUpload } from '../../utils/files';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { Dialog } from '../common/Dialog';
import { DocumentActions } from '../documents/DocumentActions';

export function OnboardingTaskDialog({ plan, taskId, manage, onClose, onChange }: { plan: OnboardingPlanView; taskId: string; manage: boolean; onClose: () => void; onChange: (p: OnboardingPlanView) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [file, setFile] = useState<File | null>(null), [note, setNote] = useState(''), [message, setMessage] = useState(''), [ack, setAck] = useState(false);
  useUnsavedChanges(Boolean(file || note || message || ack), busy);
  const task = plan.tasks.find(t => t.id === taskId);
  if (!task) return null;
  const owns = user?.id === task.assigned_to, canReview = manage && user?.id !== plan.employee_id && !owns;
  const open = plan.status === 'Active', done = taskDone(task);
  const conversation = plan.messages.filter(m => m.task_id === taskId);
  const uploads = plan.files.filter(f => f.task_id === taskId).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  async function act(action: string) {
    setBusy(true); setError(''); setSuccess('');
    try {
      const data: Record<string, unknown> = { note, message, acknowledged: ack };
      if (action === 'submit' && task!.kind === 'document') { if (!file) throw new Error('Choose a document to submit.'); data.file_data = await readUpload(file); data.file_name = file.name; }
      const next = await api.onboardingTaskAction(plan, taskId, action, data, manage);
      if (['submit', 'acknowledge'].includes(action)) { setFile(null); setAck(false); }
      if (['approve', 'return', 'waive'].includes(action)) setNote('');
      if (['help', 'reply'].includes(action)) setMessage('');
      onChange(next);
      setSuccess(action === 'read' ? 'Instructions opened. Acknowledge them when you are ready.' : action === 'submit' || action === 'acknowledge' ? (task!.requires_review ? 'Submitted. HR will review your task.' : 'Task completed.') : action === 'remind' ? 'In-app reminder sent.' : action === 'help' ? 'Your question was sent to HR.' : action === 'reply' ? 'Your reply was sent.' : 'Task updated.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function refresh() { setBusy(true); try { onChange(await api.getOnboardingPlan(plan.id, manage)); setError(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Dialog title={task.title} busy={busy} onClose={onClose} className="onb-dialog">
    <div className="go-dialog-body">
      <div className="onb-inline onb-meta"><span className={`onb-status onb-status-${task.status.toLowerCase().replaceAll(' ', '-')}`}>{task.status}</span><span>{task.stage}</span><span>Due {formatOnboardingDate(task.due_date)}</span><span>{task.required ? 'Required' : 'Optional'}</span></div>
      <p className="onb-hint">Assigned to {plan.people.find(p => p.id === task.assigned_to)?.name || ownerLabels[task.owner]} · {plan.employee_name}</p>
      {error && <div className="onb-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={refresh}>Refresh task</button></div>}
      {success && <div className="onb-success" role="status"><CheckCircle2 size={18} /><p>{success}</p></div>}
      <section className="onb-instructions"><h3>What to do</h3><p>{task.instructions}</p>{task.resource_url && <a href={task.resource_url} target="_blank" rel="noopener noreferrer" className="onb-resource">Open resource <ExternalLink size={16} /></a>}</section>
      {task.review_note && <div className="onb-review-note"><strong>{task.status === 'Waived' ? 'Waiver reason' : 'HR feedback'}</strong><p>{task.review_note}</p></div>}
      {uploads.length > 0 && <section className="onb-uploads"><h3>Submitted documents</h3>{uploads.map((f, index) => <div key={f.id} className="onb-upload-row"><div><strong>{f.name}</strong><small>{index === 0 ? 'Latest submission' : 'Earlier submission'} · {new Date(f.uploaded_at).toLocaleDateString()}</small></div><DocumentActions doc={{ id: f.id, employee_id: plan.employee_id, name: f.name, category: 'Other', file_size: '', uploaded_at: f.uploaded_at, uploaded_by_name: '', file_url: f.url, mime_type: f.mime_type, file_available: true }} /></div>)}</section>}
      {task.read_at && <p className="onb-hint">Instructions opened: {new Date(task.read_at).toLocaleString()}</p>}
      {task.acknowledged_at && <p className="onb-hint">Acknowledged: {new Date(task.acknowledged_at).toLocaleString()}</p>}
      {task.completed_at && <p className="onb-hint">{task.status} on {new Date(task.completed_at).toLocaleString()}</p>}
      {open && owns && !done && task.status !== 'Needs review' && <section className="onb-task-action">
        {task.status === 'Not started' && <button type="button" className="go-button go-button-secondary" disabled={busy} onClick={() => act('start')}>Start task</button>}
        {task.kind === 'document' && <label className="onb-file-picker"><Upload size={20} /><span>{file?.name || 'Choose a document'}</span><input type="file" disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt" onChange={e => setFile(e.target.files?.[0] || null)} /><small>PDF, image, Word, Excel, or text · up to 450 KB. HR must review the file.</small></label>}
        {task.kind === 'acknowledgment' && <>{!task.read_at && <button type="button" className="go-button go-button-secondary" disabled={busy} onClick={() => act('read')}>I have opened the instructions</button>}<label className="onb-check"><input type="checkbox" disabled={busy || !task.read_at} checked={ack} onChange={e => setAck(e.target.checked)} />I have read and acknowledge these instructions.</label><p className="onb-hint">This records your acknowledgment; it is not an electronic signature.</p></>}
        <button type="button" className="go-button go-button-primary" disabled={busy || (task.kind === 'document' && !file) || (task.kind === 'acknowledgment' && (!ack || !task.read_at))} onClick={() => act(task.kind === 'acknowledgment' ? 'acknowledge' : 'submit')}>{busy ? 'Saving…' : task.kind === 'acknowledgment' ? 'Acknowledge' : task.requires_review ? 'Submit for HR review' : 'Mark complete'}</button>
      </section>}
      {open && canReview && !done && <section className="onb-review-actions"><h3>HR review</h3><label>Review note<textarea rows={3} maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} placeholder="Explain changes needed or why this task is being waived." /></label><div className="onb-inline">{task.status === 'Needs review' && <><button type="button" className="go-button go-button-primary" disabled={busy} onClick={() => act('approve')}>Approve completion</button><button type="button" className="go-button go-button-secondary" disabled={busy || !note.trim()} onClick={() => act('return')}>Request changes</button></>}<button type="button" className="go-button go-button-secondary" disabled={busy || !note.trim()} onClick={() => { if (window.confirm('Waive this task? Your reason will be recorded and this task will no longer block onboarding.')) void act('waive'); }}>Waive task</button><button type="button" className="go-button go-button-quiet" disabled={busy || task.status === 'Needs review'} onClick={() => act('remind')}>Send reminder</button></div></section>}
      {manage && (user?.id === plan.employee_id || owns && task.status === 'Needs review') && <p className="onb-hint">Another HR administrator must review your own onboarding or submitted task.</p>}
      <section className="onb-conversation"><h3><MessageCircle size={18} />Questions and help</h3>{conversation.length === 0 && <p className="onb-hint">Questions here are visible to the task owner and HR administrators.</p>}{conversation.map(m => <article key={m.id}><header><strong>{m.author_name}</strong><time>{new Date(m.created_at).toLocaleString()}</time></header><p>{m.text}</p></article>)}
        {open && (owns || canReview) && <><label>{owns ? 'Need help with this task?' : 'Reply to the task owner'}<textarea rows={3} maxLength={2000} value={message} disabled={busy} onChange={e => setMessage(e.target.value)} placeholder="Write your question or response. Do not include passwords." /></label><button type="button" className="go-button go-button-secondary" disabled={busy || !message.trim()} onClick={() => act(owns ? 'help' : 'reply')}>{owns ? 'Ask HR' : 'Send reply'}</button></>}
      </section>
    </div><footer className="onb-inline"><button type="button" className="go-button go-button-secondary" disabled={busy} onClick={onClose}>Close</button></footer>
  </Dialog>;
}
export function formatOnboardingDate(date: string) { return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
