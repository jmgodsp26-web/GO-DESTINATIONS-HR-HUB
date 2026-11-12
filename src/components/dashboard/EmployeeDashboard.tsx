import { EASTERN_TIME_ZONE, easternDate } from '../../utils/easternTime';
import { TeamCelebrations } from './TeamCelebrations';
import React, { useCallback, useEffect, useState } from 'react';
import { OnboardingWidget } from '../onboarding/OnboardingWidget';
import { CalendarDays, Plus, Briefcase, History, Plane, HeartPulse, CalendarCheck, ArrowRight, FolderOpen, ShieldCheck, Bell, RefreshCw, Coffee, Hourglass, TreePalm, Ticket, FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSections } from '../../hooks/useSections';
import { DataRegion } from '../common/LoadFeedback';
import { BalanceCard, DateTile, MoonMark, PageHeading, Reveal, SectionCard, StatusPill, SunMark } from '../common/WorkspaceUI';
import { JourneySky } from './JourneySky';
import { balanceCardFigures, balanceSummary, countdownLabel, formatLeaveSpan, formatLongDate, formatMediumDate, greetingFor, heroTip, isNightHour, leaveTypeList, nextTimeOff, ticketParts } from '../../utils/brandDisplay';
import { prefersReducedMotion } from '../../utils/confetti';
import { AnnouncementNote } from '../announcements/AnnouncementsView';
import { DocumentActions } from '../documents/DocumentActions';
import { LeaveRequestModal } from '../leave/LeaveRequestModal';
import { HolidayShiftRequestModal } from '../holidays/HolidayShiftRequestModal';
import { employeeCalendar } from '../../utils/employeeCalendar';
import { getUpcomingHolidays } from '../../utils/countryUtils';
import { downloadIcsFile } from '../../utils/calendar';
import { api } from '../../services/api';
import type { LeaveBalance, LeaveRequest, Holiday, EmployeeDocument, HolidayShiftRequest } from '../../types';


/** The sky drifts slightly with the pointer. Mouse only, and never for reduced-motion users. */
function heroParallax(event: React.PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--hero-x', ((event.clientX - box.left) / box.width * 2 - 1).toFixed(3));
  event.currentTarget.style.setProperty('--hero-y', ((event.clientY - box.top) / box.height * 2 - 1).toFixed(3));
}

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

  const today = easternDate(), name = user.full_name.split(' ')[0], hour = new Date().getHours();
  const calendar = employeeCalendar(user).country;
  const pending = requests.filter(r => r.status === 'Pending');
  const pendingShifts = shifts.filter(s => s.status === 'Pending');
  const trip = nextTimeOff(requests, today);
  const paid = balances.filter(b => b.leave_type !== 'Unpaid Leave');
  const vacation = balances.find(b => b.leave_type === 'Vacation Leave');
  const sick = balances.find(b => b.leave_type === 'Sick Leave');
  const otherPaid = paid.filter(b => !['Vacation Leave', 'Sick Leave'].includes(b.leave_type));
  const other = balanceSummary(otherPaid), combined = balanceSummary(paid);
  const tip = sections.balances?.ready && sections.requests?.ready ? heroTip({ vacation, next: trip }) : 'Loading your time off…';
  const leaveLink = (r: LeaveRequest) => onNavigateTab(`personal/leave?request=${encodeURIComponent(r.id)}`);
  const retryRequests = () => void run('requests', () => api.getLeaveRequests({ scope: 'mine' }), setRequests);
  const single = balanceCardFigures;
  const requestRow = (r: LeaveRequest, note?: string) => (
    <li key={r.id}>
      <button type="button" className="go-row" onClick={() => leaveLink(r)}>
        <DateTile date={r.start_date} />
        <span className="go-row-copy"><strong>{r.leave_type}</strong><small>{formatLeaveSpan(r)}</small>{note && <small>{note}</small>}</span>
        <StatusPill status={r.status} />
        <ChevronRight size={18} className="go-row-chevron" aria-hidden="true" />
      </button>
    </li>
  );

  return <div className="go-dashboard go-employee-workspace go-personal-home go-home">
    <div className="go-page-header">
      <PageHeading icon={Coffee} eyebrow="My workspace" title={`${greetingFor(hour)}, ${name}!`} description="Your next steps, time off, and what’s happening around the office." badge={isNightHour(hour) ? <MoonMark /> : <SunMark />} />
      <button className="go-button go-button-secondary" type="button" onClick={() => { api.invalidateReadCache(); load(); }} disabled={Object.values(sections).some(s => s.loading)}><RefreshCw size={16} />Refresh</button>
    </div>

    <section className="go-personal-banner go-hero" aria-label="Your profile and quick actions" onPointerMove={heroParallax}>
      <JourneySky today={today} trip={trip ? { start: trip.request.start_date, end: trip.request.end_date, current: trip.current } : null} />
      <div className="go-hero-body">
        <div className="go-personal-identity">
          {user.avatar_url?.trim() ? <img src={user.avatar_url} alt="" className="go-personal-avatar" /> : <span className="go-personal-avatar" aria-hidden="true">{user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>}
          <div><strong>{user.full_name}</strong><p>{[user.job_title, user.department].filter(Boolean).join(' · ')}</p></div>
        </div>
        <p className="go-hero-tip"><Plane size={16} aria-hidden="true" />{tip}</p>
        <div className="go-personal-actions">
          <button id="dashboard-request-leave-btn" type="button" disabled={!sections.balances?.ready || Boolean(sections.balances?.error)} onClick={() => setLeaveOpen(true)} className="go-button go-button-accent"><Plus size={16} />Request leave</button>
          <button type="button" disabled={!sections.holidays?.ready || Boolean(sections.holidays?.error)} onClick={() => { setShiftHoliday(undefined); setShiftOpen(true); }} className="go-button go-button-inverse"><Briefcase size={16} />Holiday shift</button>
          <button type="button" onClick={() => onNavigateTab('leave')} className="go-button go-button-inverse"><History size={16} />My requests</button>
        </div>
      </div>
    </section>

    <OnboardingWidget onNavigate={onNavigateTab} />

    <div className="go-home-duo">
      <TeamCelebrations />
      <AnnouncementNote onViewAll={() => onNavigateTab('personal/announcements')} />
    </div>

    <section aria-label="Your leave balances" className="go-balance-zone">
      <div className="go-section-head"><h2>Your leave balances</h2><button type="button" className="go-button go-button-quiet" onClick={() => onNavigateTab('leave')}>See all balances <ArrowRight size={15} /></button></div>
      {!sections.balances?.ready && !sections.balances?.error && <div className="go-balance-grid" role="status" aria-label="Loading leave balances">{[0, 1, 2, 3].map(i => <div key={i} className="go-balance-card go-skeleton" />)}</div>}
      {(sections.balances?.ready || sections.balances?.error) && <DataRegion state={sections.balances} label="leave balances" onRetry={() => void run('balances', api.getLeaveBalances, setBalances)}>
        <div className="go-balance-grid">
          <BalanceCard label="Vacation Leave" icon={Plane} {...single(vacation)} onClick={() => onNavigateTab('leave')} />
          <BalanceCard label="Sick Leave" icon={HeartPulse} {...single(sick)} onClick={() => onNavigateTab('leave')} />
          <BalanceCard label="Other paid leave" icon={Briefcase} remaining={other.remaining} unit="days left" fraction={other.fraction} caption={leaveTypeList(otherPaid) || 'No other paid leave'} onClick={() => onNavigateTab('leave')} />
          <BalanceCard label="Combined balance" icon={CalendarCheck} remaining={combined.remaining} unit="paid days left" fraction={combined.fraction} caption="Across all paid leave" inverse />
        </div>
      </DataRegion>}
    </section>

    <Reveal className="go-home-pair">
      <SectionCard icon={Hourglass} title="Waiting on HR" description="Submitted requests and their next step">
        <DataRegion state={sections.requests} label="your requests" onRetry={retryRequests}>
          {pending.length > 0 && <ul className="go-row-list">{pending.map(r => requestRow(r, 'Awaiting HR review'))}</ul>}
        </DataRegion>
        <DataRegion state={sections.shifts} label="holiday shift requests" onRetry={() => void run('shifts', () => api.getHolidayShifts({ employee_id: user.id }), setShifts)}>
          {pendingShifts.length > 0 && <ul className="go-row-list">{pendingShifts.map(s => {
            const holiday = holidays.find(h => h.id === s.holiday_id);
            return <li key={s.id}><button type="button" className="go-row" onClick={() => onNavigateTab('holidays')}>
              <DateTile date={holiday?.date || s.holiday_date} />
              <span className="go-row-copy"><strong>Holiday shift request</strong><small>{holiday?.name || s.holiday_name || 'Holiday shift'}</small><small>Awaiting HR review</small></span>
              <StatusPill status="Pending" /><ChevronRight size={18} className="go-row-chevron" aria-hidden="true" />
            </button></li>;
          })}</ul>}
          {sections.requests?.ready && !pending.length && !pendingShifts.length && <p className="go-card-empty">Nothing is waiting on HR. New requests will appear here.</p>}
        </DataRegion>
      </SectionCard>

      <SectionCard icon={TreePalm} tone="blue" title="Your next time off" description="Approved leave and your holiday calendar">
        <DataRegion state={sections.requests} label="approved leave" onRetry={retryRequests}>
          {trip ? <ul className="go-row-list"><li><button type="button" className="go-row" onClick={() => leaveLink(trip.request)}>
            <DateTile date={trip.request.start_date} />
            <span className="go-row-copy"><strong>{trip.current ? 'Currently on approved leave' : 'Next approved leave'}</strong><small>{trip.request.leave_type} · {formatLeaveSpan(trip.request)}</small>{!trip.current && <small>{countdownLabel(today, trip.request.start_date)}</small>}</span>
            <StatusPill status="Approved" /><ChevronRight size={18} className="go-row-chevron" aria-hidden="true" />
          </button></li></ul> : <p className="go-card-empty">No upcoming approved leave.</p>}
        </DataRegion>
        <DataRegion state={sections.holidays} label="upcoming holidays" onRetry={() => load()}>
          {holidays[0] ? <ul className="go-row-list"><li><button type="button" className="go-row" onClick={() => onNavigateTab('calendar')}>
            <DateTile date={holidays[0].date} />
            <span className="go-row-copy"><strong>{holidays[0].name}</strong><small>{formatLongDate(holidays[0].date)} · {calendar} calendar</small></span>
            <span className="go-row-link">Open calendar</span><ChevronRight size={18} className="go-row-chevron" aria-hidden="true" />
          </button></li></ul> : <p className="go-card-empty">No upcoming holidays are listed for your calendar.</p>}
        </DataRegion>
      </SectionCard>
    </Reveal>

    <Reveal>
      <SectionCard icon={Ticket} title="Upcoming holidays" description={`${calendar} holiday calendar`} actions={<button type="button" className="go-button go-button-quiet" onClick={() => onNavigateTab('holidays')}>All holidays <ArrowRight size={15} /></button>}>
        <DataRegion state={sections.holidays} label="your holiday calendar" onRetry={() => load()}>
          {holidays.length > 0 && <ul className="go-ticket-list">{holidays.slice(0, 4).map(h => {
            const stub = ticketParts(h.date), shift = shifts.find(s => s.holiday_id === h.id), shiftsReady = sections.shifts?.ready && !sections.shifts.error;
            return <li className="go-ticket" key={h.id}>
              <div className="go-ticket-stub" aria-hidden="true"><small>{stub.month}</small><b>{stub.day}</b><span>{stub.weekday}</span></div>
              <div className="go-ticket-body">
                <strong>{h.name}</strong>
                <small>{formatMediumDate(h.date)}</small>
                <span className={`go-ticket-tag${shiftsReady && !shift ? '' : ' is-attention'}`}>{shiftsReady ? (shift?.status ? `Shift: ${shift.status}` : 'No holiday shift requested') : 'Shift status unavailable until loaded'}</span>
                <div className="go-ticket-actions">
                  <button type="button" className="go-button go-button-secondary" onClick={() => { setShiftHoliday(h.id); setShiftOpen(true); }}>Shift options</button>
                  <button type="button" className="go-icon-button" aria-label={`Add ${h.name} to calendar`} title="Add to calendar" onClick={() => downloadIcsFile({ title: h.name, startDate: h.date, endDate: h.date, description: h.description || 'Company holiday' })}><CalendarDays size={17} aria-hidden="true" /></button>
                </div>
              </div>
              <Plane className="go-ticket-plane" aria-hidden="true" />
            </li>;
          })}</ul>}
          {!holidays.length && <p className="go-card-empty">No upcoming holidays are listed. HR can update the company calendar.</p>}
        </DataRegion>
      </SectionCard>
    </Reveal>

    <Reveal className="go-home-pair is-wide-left">
      <SectionCard icon={History} tone="blue" title="Recent leave requests" actions={<button type="button" className="go-button go-button-quiet" onClick={() => onNavigateTab('leave')}>View all <ArrowRight size={15} /></button>}>
        <DataRegion state={sections.requests} label="recent requests" onRetry={retryRequests}>
          {requests.length
            ? <ul className="go-row-list">{[...requests].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)).slice(0, 5).map(r => requestRow(r, r.admin_note ? `HR: ${r.admin_note}` : `Submitted ${new Date(r.submitted_at).toLocaleDateString('en-US', { timeZone: EASTERN_TIME_ZONE })}`))}</ul>
            : <p className="go-card-empty">Your leave requests will appear here once submitted.</p>}
        </DataRegion>
      </SectionCard>

      <SectionCard icon={FolderOpen} title="My documents" actions={<button type="button" className="go-button go-button-quiet" onClick={() => onNavigateTab('documents')}>View all <ArrowRight size={15} /></button>}>
        <DataRegion state={sections.documents} label="documents" onRetry={() => void run('documents', api.getMyDocuments, setDocuments)}>
          {documents.length > 0 && <ul className="go-row-list">{documents.slice(0, 3).map(doc => <li key={doc.id} className="go-row is-static">
            <span className="go-row-icon" aria-hidden="true"><FileText size={18} /></span>
            <span className="go-row-copy"><strong>{doc.name}</strong><small>{doc.category} · Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-US', { timeZone: EASTERN_TIME_ZONE })}</small></span>
            <DocumentActions doc={doc} />
          </li>)}</ul>}
          {!documents.length && <p className="go-card-empty">HR has not uploaded any documents for you yet.</p>}
        </DataRegion>
      </SectionCard>
    </Reveal>

    <Reveal className="go-workspace-links">
      <button type="button" onClick={() => onNavigateTab('notifications')}><Bell size={20} /><span><strong>Notifications</strong><small>{unreadCount} unread {unreadCount === 1 ? 'update' : 'updates'}</small></span><ArrowRight size={16} /></button>
      <button type="button" onClick={() => onNavigateTab('profile')}><ShieldCheck size={20} /><span><strong>My profile</strong><small>Review your contact and work details</small></span><ArrowRight size={16} /></button>
      <button type="button" onClick={() => onNavigateTab('documents')}><FolderOpen size={20} /><span><strong>My documents</strong><small>Contracts and employment records</small></span><ArrowRight size={16} /></button>
    </Reveal>

    <LeaveRequestModal isOpen={leaveOpen} onClose={() => setLeaveOpen(false)} onSuccess={load} balances={balances} />
    {shiftOpen && <HolidayShiftRequestModal holidays={holidays} initialHolidayId={shiftHoliday} onClose={() => setShiftOpen(false)} onSuccess={() => { setShiftOpen(false); load(); }} />}
  </div>;
};
