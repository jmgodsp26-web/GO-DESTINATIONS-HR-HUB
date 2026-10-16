import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, ClipboardList, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigation } from '../../context/NavigationContext';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { Dialog } from '../common/Dialog';
import { LoadError, RefreshStatus } from '../common/LoadFeedback';
import { PageHeading } from '../common/WorkspaceUI';
import { canReviewRequest, reviewBatch } from '../../utils/reviewQueue';
import { api } from '../../services/api';
import { LEAVE_TYPE_MASTER_DATA, isPaidLeaveType, type LeaveRequest, type UserProfile, type LeaveBalance } from '../../types';

type Employee = UserProfile & { leave_balances: LeaveBalance[] };
type Decision = 'Approved' | 'Rejected';
export const AdminLeaveRequests: React.FC = () => {
  const { user } = useAuth(), { showToast } = useToast(), { params, navigate } = useNavigation();
  const linkedId = params.get('request');
  const [requests, setRequests] = useState<LeaveRequest[]>([]), [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const [status, setStatus] = useViewPreference('approvals:status', 'Pending');
  const [employee, setEmployee] = useViewPreference('approvals:employee', '');
  const [type, setType] = useViewPreference('approvals:type', 'All');
  const [date, setDate] = useViewPreference('approvals:date', '');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<LeaveRequest | null>(null), [note, setNote] = useState('');
  const [decision, setDecision] = useState<Decision>('Approved'), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const [batch, setBatch] = useState<{ action: Decision; items: LeaveRequest[] } | null>(null);
  const [results, setResults] = useState<Awaited<ReturnType<typeof reviewBatch>> | null>(null);
  const canClose = useUnsavedChanges(Boolean(detail && note.trim()), busy);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [r,e] = await Promise.all([api.getLeaveRequests(),api.getAllEmployees()]); setRequests(r);setEmployees(e);setLoaded(true);setSelected(old=>old.filter(id=>r.some(item=>item.id===id&&canReviewRequest(item,user?.id)))); }
    catch(e){setError((e as Error).message);}
    finally{setLoading(false);}
  }, [user?.id]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{setSelected([]);},[status,employee,type,date]);
  useEffect(()=>{
    if (!linkedId) { setDetail(null); setNote(''); return; }
    if (!loaded) return;
    const item=requests.find(r=>r.id===linkedId);
    if(item && detail?.id!==item.id){setDetail(item);setNote('');setDecision('Approved');setActionError('');}
    else if(!item) setError('This leave request is no longer available.');
  },[loaded,linkedId,requests]);
  const visible=requests.filter(r=>(status==='All'||r.status===status)&&(!employee||r.employee_id===employee)&&(type==='All'||r.leave_type===type)&&(!date||(r.start_date<=date&&r.end_date>=date))).sort((a,b)=>Number(b.status==='Pending')-Number(a.status==='Pending')||a.submitted_at.localeCompare(b.submitted_at));
  const eligible=visible.filter(r=>canReviewRequest(r,user?.id));
  const allSelected=eligible.length>0&&eligible.every(r=>selected.includes(r.id));
  function closeDetail(){if(navigate('administration/leave-requests')){setDetail(null);setNote('');}}
  function open(item:LeaveRequest){navigate(`administration/leave-requests?request=${encodeURIComponent(item.id)}`);}
  async function review(){
    if(!detail||!canReviewRequest(detail,user?.id))return;
    setBusy(true);setActionError('');
    try{await api.reviewLeaveRequest(detail.id,decision,note.trim()||undefined);setDetail(null);setNote('');showToast({type:'success',title:`Request ${decision.toLowerCase()}`,message:`${detail.employee_name}'s request has been updated.`});await load();}
    catch(e){setActionError((e as Error).message);}
    finally{setBusy(false);}
  }
  async function processBatch(){
    if(!batch)return;setBusy(true);setResults(null);
    const outcome=await reviewBatch(batch.items.map(r=>r.id),id=>api.reviewLeaveRequest(id,batch.action,`Batch ${batch.action.toLowerCase()} by HR administrator`));
    setResults(outcome);setSelected(outcome.filter(r=>!r.success).map(r=>r.id));await load();setBusy(false);
  }
  const person=detail?employees.find(e=>e.id===detail.employee_id):undefined;
  const balance=person?.leave_balances.find(b=>b.leave_type===detail?.leave_type);
  const overlaps=detail?requests.filter(r=>r.id!==detail.id&&r.employee_id!==detail.employee_id&&r.status==='Approved'&&r.employee_department===detail.employee_department&&r.start_date<=detail.end_date&&r.end_date>=detail.start_date):[];
  return <div className="space-y-6">
    <div className="go-page-header"><PageHeading eyebrow="Time off" title="Leave approvals" description="Review the oldest pending requests first. Open a request to check the details." badge={loaded?<span className="go-heading-badge">{requests.filter(r=>r.status==='Pending').length} pending</span>:undefined}/><button type="button" className="go-button go-button-secondary" onClick={load} disabled={loading||busy}><RefreshCw size={16}/>Refresh</button></div>
    {error&&<LoadError message={loaded?'Could not refresh. The information below may be out of date.':error} onRetry={load}/>}<RefreshStatus active={loading&&loaded}/>
    <fieldset disabled={busy} className="go-surface p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="go-workflow-label">Status<select value={status} onChange={e=>setStatus(e.target.value)} className="go-filter-input"><option>Pending</option><option>All</option><option>Approved</option><option>Rejected</option><option>Cancelled</option></select></label><label className="go-workflow-label">Employee<select value={employee} onChange={e=>setEmployee(e.target.value)} className="go-filter-input"><option value="">Everyone</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label><label className="go-workflow-label">Leave type<select value={type} onChange={e=>setType(e.target.value)} className="go-filter-input"><option>All</option>{LEAVE_TYPE_MASTER_DATA.map(t=><option key={t.name}>{t.name}</option>)}<option>Holiday Shift Credit</option></select></label><label className="go-workflow-label">On this date<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="go-filter-input"/></label><button type="button" className="go-button go-button-secondary" onClick={()=>{setStatus('Pending');setEmployee('');setType('All');setDate('');}}>Reset to pending</button></fieldset>
    {!loaded ? (!error&&<p className="go-refresh-status" role="status">Loading leave requests…</p>) : <section className="go-task-panel"><header className="flex justify-between items-center gap-4 flex-wrap"><div><h2>{status==='Pending'?'Pending requests':'Leave requests'}</h2><p className="text-sm text-slate-500">{visible.length} shown · oldest pending first</p></div>{eligible.length>0&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} disabled={busy} onChange={()=>setSelected(allSelected?[]:eligible.map(r=>r.id))}/>Select reviewable requests</label>}</header>
      {selected.length>0&&<div className="go-batch-bar"><strong>{selected.length} selected</strong><button type="button" className="go-button go-button-primary" disabled={busy} onClick={()=>{setResults(null);setBatch({action:'Approved',items:requests.filter(r=>selected.includes(r.id)&&canReviewRequest(r,user?.id))});}}>Approve selected</button><button type="button" className="go-button go-button-secondary" disabled={busy} onClick={()=>{setResults(null);setBatch({action:'Rejected',items:requests.filter(r=>selected.includes(r.id)&&canReviewRequest(r,user?.id))});}}>Reject selected</button><button type="button" disabled={busy} onClick={()=>setSelected([])}>Clear</button></div>}
      <div>{visible.length?visible.map(r=><article key={r.id} className="go-approval-row"><div className="flex gap-3 items-start">{canReviewRequest(r,user?.id)?<input className="mt-1.5" type="checkbox" aria-label={`Select ${r.employee_name}'s ${r.leave_type} request`} disabled={busy} checked={selected.includes(r.id)} onChange={()=>setSelected(old=>old.includes(r.id)?old.filter(id=>id!==r.id):[...old,r.id])}/>:<ClipboardList size={20} className="text-slate-400 mt-1"/>}<div><button type="button" className="font-bold text-left" onClick={()=>open(r)}>{r.employee_name}</button><p className="text-sm text-slate-500">{r.employee_department} · {r.leave_type}</p><p className="text-sm mt-1">{r.start_date} → {r.end_date} · <strong>{r.total_days} day(s)</strong>{r.is_half_day?` · ${r.half_day_period} half day`:''}</p><p className="text-sm text-slate-500">Submitted {new Date(r.submitted_at).toLocaleDateString()}{r.attachment_name?' · Attachment available':''}</p></div></div><div className="flex flex-col items-end gap-2"><span className={`go-request-status is-${r.status.toLowerCase()}`}>{r.status}</span>{r.employee_id===user?.id&&r.status==='Pending'&&<small className="text-slate-500">Another admin must review your request</small>}<button type="button" className="go-button go-button-secondary" onClick={()=>open(r)}>{canReviewRequest(r,user?.id)?'Review request':'View details'}<ArrowRight size={16}/></button></div></article>):<p className="text-sm text-slate-600 py-6">No requests match these filters. Try another status or employee.</p>}</div>
    </section>}
    {detail&&<Dialog title="Review leave request" onClose={closeDetail} busy={busy}><div className="go-dialog-body space-y-5"><div><h3 className="text-xl font-bold">{detail.employee_name}</h3><p>{detail.employee_department} · {detail.leave_type} · {detail.status}</p></div><dl className="go-detail-grid"><div><dt>Dates</dt><dd>{detail.start_date} → {detail.end_date}</dd></div><div><dt>Requested duration</dt><dd>{detail.total_days} day(s){detail.is_half_day?` · ${detail.half_day_period} half day`:''}</dd></div><div><dt>Current balance for this leave type</dt><dd>{!isPaidLeaveType(detail.leave_type)?'Unpaid · no paid balance deducted':balance?`${balance.allocated_days-balance.used_days} day(s)`:'No allowance assigned'}</dd></div><div><dt>Submitted</dt><dd>{new Date(detail.submitted_at).toLocaleString()}</dd></div></dl><section><h4 className="font-bold">Reason</h4><p className="whitespace-pre-wrap break-words">{detail.reason}</p></section>{detail.attachment_name&&<section><h4 className="font-bold">Supporting document</h4>{detail.attachment_url?.startsWith('/api/leave-attachments/')?<a className="underline" href={detail.attachment_url} target="_blank" rel="noopener noreferrer">Open {detail.attachment_name}</a>:<p>Original file unavailable · Contact the employee</p>}</section>}
      <section className="go-live-audience"><h4 className="font-bold">Approved absences in this department</h4>{overlaps.length?<ul>{overlaps.map(r=><li key={r.id}>{r.employee_name} · {r.start_date} → {r.end_date}{r.is_half_day?` · ${r.half_day_period} half day`:''}</li>)}</ul>:<p>No other approved leave overlaps these dates.</p>}<p className="text-sm mt-2">This shows approved leave, not live attendance or a guarantee of staffing. The server rechecks the request when you confirm.</p></section>
      {detail.admin_note&&<p><strong>Previous HR note:</strong> {detail.admin_note}</p>}
      {canReviewRequest(detail,user?.id)?<><fieldset disabled={busy}><legend className="font-bold mb-2">Decision</legend><div className="go-read-filter">{(['Approved','Rejected'] as const).map(d=><button key={d} type="button" aria-pressed={decision===d} onClick={()=>setDecision(d)}>{d==='Approved'?'Approve':'Reject'}</button>)}</div><label className="block mt-4 go-workflow-label">Note to the employee (optional)<textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} className="go-filter-input" placeholder="Add any context the employee needs."/></label></fieldset>{actionError&&<p role="alert" className="go-field-error">{actionError}</p>}</>:<p className="go-live-audience">{detail.employee_id===user?.id&&detail.status==='Pending'?'Another admin must review your own leave request.':'This request has already been processed.'}</p>}</div><footer className="flex justify-end gap-3"><button type="button" className="go-button" onClick={closeDetail} disabled={busy}>Close</button>{canReviewRequest(detail,user?.id)&&<button type="button" className="go-button go-button-primary" disabled={busy||loading||Boolean(error)} onClick={review}>{busy?'Saving…':decision==='Approved'?'Confirm approval':'Confirm rejection'}</button>}</footer></Dialog>}
    {batch&&<Dialog title={results?'Batch results':`${batch.action==='Approved'?'Approve':'Reject'} ${batch.items.length} requests?`} busy={busy} onClose={()=>{if(!busy)setBatch(null);}}><div className="go-dialog-body"><p>{results?`${results.filter(r=>r.success).length} succeeded · ${results.filter(r=>!r.success).length} failed`:`Review the selected requests below. Each request is checked separately when you confirm.`}</p><ul className="mt-4">{batch.items.map(r=>{const result=results?.find(item=>item.id===r.id);return <li className="go-task-row" key={r.id}><div><strong>{r.employee_name}</strong><small>{r.leave_type} · {r.start_date} → {r.end_date}</small>{result&&<p role={result.success?'status':'alert'} className={result.success?'text-green-800 text-sm':'go-field-error'}>{result.success?`✓ ${batch.action}`:result.error}</p>}</div></li>;})}</ul>{results?.some(r=>!r.success)&&<p className="go-live-audience mt-4">Successful changes are saved. Failed requests remain selected if they still need review. Open each failed request before retrying.</p>}</div><footer className="flex justify-end gap-3"><button type="button" className="go-button" disabled={busy} onClick={()=>setBatch(null)}>{results?'Done':'Cancel'}</button>{!results&&<button type="button" className="go-button go-button-primary" disabled={busy||!batch.items.length} onClick={processBatch}>{busy?'Processing…':`Confirm ${batch.action==='Approved'?'approval':'rejection'}`}</button>}</footer></Dialog>}
  </div>;
};
