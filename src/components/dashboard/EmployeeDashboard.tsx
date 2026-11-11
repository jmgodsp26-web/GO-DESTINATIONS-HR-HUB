import { EASTERN_TIME_ZONE, easternDate } from '../../utils/easternTime';
import { TeamCelebrations } from './TeamCelebrations';
import React, { useCallback, useEffect, useState } from 'react';
import { OnboardingWidget } from '../onboarding/OnboardingWidget';
import { CalendarDays, Plus, Briefcase, History, Plane, HeartPulse, CalendarCheck, ArrowRight, FolderOpen, ShieldCheck, Bell, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSections } from '../../hooks/useSections';
import { DataRegion } from '../common/LoadFeedback';
import { PageHeading, StatCard, SunMark } from '../common/WorkspaceUI';
import { JourneySky } from './JourneySky';
import { greetingFor, heroTip, nextTimeOff, ticketParts, formatLongDate } from '../../utils/brandDisplay';
import { AnnouncementWidget } from '../announcements/AnnouncementsView';
import { DocumentActions } from '../documents/DocumentActions';
import { LeaveRequestModal } from '../leave/LeaveRequestModal';
import { HolidayShiftRequestModal } from '../holidays/HolidayShiftRequestModal';
import { employeeCalendar } from '../../utils/employeeCalendar';
import { getUpcomingHolidays, formatHolidayDate } from '../../utils/countryUtils';
import { downloadIcsFile } from '../../utils/calendar';
import { api } from '../../services/api';
import type { LeaveBalance, LeaveRequest, Holiday, EmployeeDocument, HolidayShiftRequest } from '../../types';

export const EmployeeDashboard: React.FC<{ onNavigateTab: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { user, unreadCount } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]), [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]), [shifts, setShifts] = useState<HolidayShiftRequest[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false), [shiftOpen, setShiftOpen] = useState(false);
  const [shiftHoliday, setShiftHoliday] = useState<string>();
  const { sections, run } = useSections();
  const load = useCallback(() => {
    const today = easternDate();
    const dashboard = api.getPersonalDashboard();
    void run('balances', () => dashboard.then(data => data.balances), setBalances);
    void run('requests', () => dashboard.then(data => data.requests), setRequests);
    void run('holidays', () => dashboard.then(data => data.holidays), data => setHolidays(getUpcomingHolidays(data, { referenceDateStr: today, strictFutureOnly: false, userLocation: employeeCalendar(user) })));
    void run('shifts', () => dashboard.then(data => data.shifts), setShifts);
    void run('documents', () => dashboard.then(() => api.getMyDocuments()), setDocuments);
  }, [run, user?.id, user?.country, user?.holiday_calendar, user?.holiday_region, user?.timezone]);
  useEffect(load, [load]);
  if (!user) return null;
  const today = easternDate(), name = user.full_name.split(' ')[0];
  const pending = requests.filter(r => r.status === 'Pending');
  const nextLeave = requests.filter(r => r.status === 'Approved' && r.end_date >= today).sort((a,b) => a.start_date.localeCompare(b.start_date))[0];
  const paid = balances.filter(b => b.leave_type !== 'Unpaid Leave');
  const trip = nextTimeOff(requests, today);
  const vacation = balances.find(b => b.leave_type === 'Vacation Leave');
  const share = (list: LeaveBalance[]) => { const total = list.reduce((n,b)=>n+b.allocated_days,0); return total > 0 ? list.reduce((n,b)=>n+Math.max(0,b.allocated_days-b.used_days),0) / total : 0; };
  const otherPaid = paid.filter(b=>!['Vacation Leave','Sick Leave'].includes(b.leave_type));
  const tip = sections.balances?.ready && sections.requests?.ready ? heroTip({ vacation, next: trip }) : 'Loading your time off…';
  const leaveLink = (r: LeaveRequest) => onNavigateTab(`personal/leave?request=${encodeURIComponent(r.id)}`);
  return <div className="go-dashboard go-employee-workspace go-personal-home space-y-6">
    <div className="go-page-header"><PageHeading eyebrow="My workspace" title={`${greetingFor(new Date().getHours())}, ${name}!`} description="Your next steps, time off, and what’s happening around the office." badge={<SunMark />} /><button className="go-button go-button-secondary" type="button" onClick={()=>{api.invalidateReadCache();load();}} disabled={Object.values(sections).some(s => s.loading)}><RefreshCw size={16} />Refresh</button></div>
    <section className="go-personal-banner go-hero" aria-label="Your profile and quick actions">
      <JourneySky today={today} trip={trip ? { start: trip.request.start_date, end: trip.request.end_date, current: trip.current } : null} />
      <div className="go-hero-body">
      <div className="go-personal-identity">{user.avatar_url?.trim() ? <img src={user.avatar_url} alt="" className="go-personal-avatar" /> : <span className="go-personal-avatar" aria-hidden="true">{user.full_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>}<div><strong>{user.full_name}</strong><p>{[user.job_title,user.department].filter(Boolean).join(' · ')}</p></div></div>
      <p className="go-hero-tip"><Plane size={16} aria-hidden="true" />{tip}</p>
      <div className="go-personal-actions"><button id="dashboard-request-leave-btn" type="button" disabled={!sections.balances?.ready || Boolean(sections.balances?.error)} onClick={()=>setLeaveOpen(true)} className="go-button go-button-accent"><Plus size={16} />Request leave</button><button type="button" disabled={!sections.holidays?.ready || Boolean(sections.holidays?.error)} onClick={()=>{setShiftHoliday(undefined);setShiftOpen(true);}} className="go-button go-button-inverse"><Briefcase size={16} />Holiday shift</button><button type="button" onClick={()=>onNavigateTab('leave')} className="go-button go-button-inverse"><History size={16} />My requests</button></div>
      </div>
    </section>
    <TeamCelebrations />
    <OnboardingWidget onNavigate={onNavigateTab} />
    <DataRegion state={sections.balances} label="leave balances" onRetry={()=>void run('balances',api.getLeaveBalances,setBalances)}>
      <section aria-label="Your leave balances"><div className="flex justify-between items-center mb-3"><h2 className="go-workflow-label">Your leave balances</h2><button type="button" className="go-button go-button-quiet" onClick={()=>onNavigateTab('leave')}>See all balances <ArrowRight size={15}/></button></div>
        <div className="go-stat-grid">{(['Vacation Leave','Sick Leave'] as const).map((type,i)=>{const balance=balances.find(b=>b.leave_type===type);return <StatCard key={type} label={type} value={balance ? Math.max(0,balance.allocated_days-balance.used_days) : '—'} unit={balance ? 'days remaining' : 'Not assigned'} detail={balance ? `${balance.used_days} used of ${balance.allocated_days} allocated` : 'Ask HR to check your allowance'} icon={i ? HeartPulse : Plane} tone={i ? undefined : 'orange'} ring={balance ? share([balance]) : null} onClick={()=>onNavigateTab('leave')}/>;})}<StatCard label="Other paid leave" value={otherPaid.reduce((n,b)=>n+Math.max(0,b.allocated_days-b.used_days),0)} unit="days remaining" detail="View balances by leave type" icon={Briefcase} ring={share(otherPaid)} onClick={()=>onNavigateTab('leave')}/><StatCard label="Combined balance" value={paid.reduce((n,b)=>n+Math.max(0,b.allocated_days-b.used_days),0)} unit="paid days remaining" detail="Each leave type has its own allowance" icon={CalendarCheck} tone="navy" ring={share(paid)}/></div>
      </section>
    </DataRegion>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="go-task-panel"><header><h2>Waiting on HR</h2><p className="text-sm text-slate-500">Submitted requests and their next step</p></header><div><DataRegion state={sections.requests} label="your requests" onRetry={()=>void run('requests',()=>api.getLeaveRequests({scope:'mine'}),setRequests)}>{pending.length ? pending.map(r=><div className="go-task-row" key={r.id}><div><strong>{r.leave_type}</strong><small>{r.start_date} → {r.end_date} · {r.total_days} day(s)</small><small>Awaiting HR review</small></div><button type="button" className="go-button go-button-secondary" onClick={()=>leaveLink(r)}>View request <ArrowRight size={15}/></button></div>) : <p className="text-sm text-slate-600">No leave requests are awaiting review.</p>}</DataRegion><DataRegion state={sections.shifts} label="holiday shift requests" onRetry={()=>void run('shifts',()=>api.getHolidayShifts({employee_id:user.id}),setShifts)}>{shifts.filter(s=>s.status==='Pending').map(s=><div className="go-task-row" key={s.id}><div><strong>Holiday shift request</strong><small>{holidays.find(h=>h.id===s.holiday_id)?.name || 'Holiday shift'} · Awaiting HR review</small></div><button type="button" className="go-button go-button-secondary" onClick={()=>onNavigateTab('holidays')}>View shifts</button></div>)}</DataRegion></div></section>
      <section className="go-task-panel"><header><h2>Your next time off</h2><p className="text-sm text-slate-500">Approved leave and your holiday calendar</p></header><div><DataRegion state={sections.requests} label="approved leave" onRetry={()=>void run('requests',()=>api.getLeaveRequests({scope:'mine'}),setRequests)}>{nextLeave ? <div className="go-task-row"><div><strong>{nextLeave.start_date<=today ? 'Currently on approved leave' : 'Next approved leave'}</strong><small>{nextLeave.start_date} → {nextLeave.end_date} · {nextLeave.leave_type}</small></div><button type="button" className="go-button go-button-secondary" onClick={()=>leaveLink(nextLeave)}>View details</button></div> : <p className="text-sm text-slate-600">No upcoming approved leave.</p>}</DataRegion><DataRegion state={sections.holidays} label="upcoming holidays" onRetry={()=>load()}>{holidays[0] ? <div className="go-task-row"><div><strong>{holidays[0].name}</strong><small>{holidays[0].date} · {employeeCalendar(user).country} calendar</small></div><button type="button" className="go-button go-button-secondary" onClick={()=>onNavigateTab('calendar')}>Open calendar</button></div> : <p className="text-sm text-slate-600">No upcoming holidays are listed for your calendar.</p>}</DataRegion></div></section>
    </div>
    <AnnouncementWidget onViewAll={()=>onNavigateTab('personal/announcements')} />
    <section className="go-task-panel"><header className="flex justify-between items-center"><h2>Recent leave requests</h2><button type="button" onClick={()=>onNavigateTab('leave')}>View all <ArrowRight className="inline" size={15}/></button></header><div><DataRegion state={sections.requests} label="recent requests" onRetry={()=>void run('requests',()=>api.getLeaveRequests({scope:'mine'}),setRequests)}>{requests.length ? [...requests].sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at)).slice(0,5).map(r=><div key={r.id} className="go-task-row"><div><strong>{r.leave_type}</strong><small>{r.start_date} → {r.end_date} · {r.total_days} day(s)</small><small>{r.admin_note ? `HR: ${r.admin_note}` : `Submitted ${new Date(r.submitted_at).toLocaleDateString('en-US', { timeZone: EASTERN_TIME_ZONE })}`}</small></div><button type="button" className="go-button go-button-secondary" onClick={()=>leaveLink(r)}>{r.status} <ArrowRight size={15}/></button></div>) : <p className="text-sm text-slate-600">Your leave requests will appear here once submitted.</p>}</DataRegion></div></section>
    <section className="go-task-panel"><header><h2>Upcoming holidays</h2><p className="text-sm text-slate-500">{employeeCalendar(user).country} holiday calendar</p></header><div><DataRegion state={sections.holidays} label="your holiday calendar" onRetry={()=>load()}>{holidays.length > 0 && <ul className="go-ticket-list">{holidays.slice(0,4).map(h=>{const stub=ticketParts(h.date), shift=shifts.find(s=>s.holiday_id===h.id), shiftsReady=sections.shifts?.ready && !sections.shifts.error;return <li className="go-ticket" key={h.id}><div className="go-ticket-stub" aria-hidden="true"><small>{stub.month}</small><b>{stub.day}</b><span>{stub.weekday}</span></div><div className="go-ticket-body"><strong>{h.name}</strong><small>{formatLongDate(h.date)}, {h.date.slice(0,4)}</small><span className={`go-ticket-tag${shiftsReady && !shift ? '' : ' is-attention'}`}>{shiftsReady ? (shift?.status ? `Shift: ${shift.status}` : 'No holiday shift requested') : 'Shift status unavailable until loaded'}</span><div className="go-ticket-actions"><button type="button" className="go-button go-button-secondary" onClick={()=>{setShiftHoliday(h.id);setShiftOpen(true);}}>View shift options</button><button type="button" className="go-button go-button-quiet" onClick={()=>downloadIcsFile({title:h.name,startDate:h.date,endDate:h.date,description:h.description||'Company holiday'})}><CalendarDays size={16}/>Add to calendar</button></div></div><Plane className="go-ticket-plane" aria-hidden="true"/></li>;})}</ul>}{!holidays.length && <p className="text-sm text-slate-600">No upcoming holidays are listed. HR can update the company calendar.</p>}</DataRegion></div></section>
    <section className="go-task-panel"><header className="flex justify-between items-center"><h2>My documents</h2><button type="button" onClick={()=>onNavigateTab('documents')}>View all <ArrowRight className="inline" size={15}/></button></header><div><DataRegion state={sections.documents} label="documents" onRetry={()=>void run('documents',api.getMyDocuments,setDocuments)}>{documents.slice(0,3).map(doc=><div key={doc.id} className="go-task-row"><div><strong>{doc.name}</strong><small>{doc.category} · Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-US', { timeZone: EASTERN_TIME_ZONE })}</small></div><DocumentActions doc={doc}/></div>)}{!documents.length && <p className="text-sm text-slate-600">HR has not uploaded any documents for you yet.</p>}</DataRegion></div></section>
    <div className="go-workspace-links"><button type="button" onClick={()=>onNavigateTab('notifications')}><Bell size={20}/><span><strong>Notifications</strong><small>{unreadCount} unread updates</small></span><ArrowRight size={16}/></button><button type="button" onClick={()=>onNavigateTab('profile')}><ShieldCheck size={20}/><span><strong>My profile</strong><small>Review your contact and work details</small></span><ArrowRight size={16}/></button><button type="button" onClick={()=>onNavigateTab('documents')}><FolderOpen size={20}/><span><strong>My documents</strong><small>Contracts and employment records</small></span><ArrowRight size={16}/></button></div>
    <LeaveRequestModal isOpen={leaveOpen} onClose={()=>setLeaveOpen(false)} onSuccess={load} balances={balances}/>
    {shiftOpen && <HolidayShiftRequestModal holidays={holidays} initialHolidayId={shiftHoliday} onClose={()=>setShiftOpen(false)} onSuccess={()=>{setShiftOpen(false);load();}}/>}
  </div>;
};
