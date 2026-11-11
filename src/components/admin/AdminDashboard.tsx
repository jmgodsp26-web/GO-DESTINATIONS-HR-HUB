import { easternDate } from '../../utils/easternTime';
import { useSections } from '../../hooks/useSections';
import { DataRegion } from '../common/LoadFeedback';
import { AnnouncementNote } from '../announcements/AnnouncementsView';
import { PageHeading, Reveal, SectionCard, StatCard } from '../common/WorkspaceUI';
import { GoBuddyArt } from '../common/GoBuddy';
import { HolidayDetailModal } from './HolidayDetailModal';
import { useViewPreference } from '../../hooks/useViewPreference';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LeaveRequest, Holiday, UserProfile, LeaveBalance, HolidayStaffingCoverage } from '../../types';
import { api } from '../../services/api';
import { CelebrationsWidget } from './CelebrationsWidget';
import { HolidayStaffingCoverageWidget } from './HolidayStaffingCoverage';
import { AnimatePresence } from 'motion/react';
import { QuickReviewItem } from './QuickReview';
import { canReviewRequest } from '../../utils/reviewQueue';
import { coverageLabel, formatLongDate, formatShortDate, ticketParts } from '../../utils/brandDisplay';
import {
  Users,
  ClipboardList,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  X,
  Shield,
  Plane,
  Plus,
  Sparkles,
  Ticket,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<(UserProfile & { leave_balances: LeaveBalance[]; is_pc?: boolean })[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayCoverages, setHolidayCoverages] = useState<HolidayStaffingCoverage[]>([]);
  const { sections, run } = useSections();
  const isLoading = !sections.employees?.ready || !sections.requests?.ready;
  const [isScheduleShiftOpen, setIsScheduleShiftOpen] = useState(false);
  const [assignShiftForm, setAssignShiftForm] = useState({
    employee_id: '',
    holiday_id: '',
    working_hours: '9:00 AM – 5:00 PM',
    status: 'Approved' as 'Approved' | 'Pending',
    admin_note: '',
  });
  const [isAssigningShift, setIsAssigningShift] = useState(false);
  const [plannerOpen, setPlannerOpen] = useViewPreference<boolean>('dashboard:coverage-planner', false);
  const [teamHolidayId, setTeamHolidayId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    const dashboard = api.getAdministrationDashboard();
    void run('employees', () => dashboard.then(data => data.employees), setEmployees);
    void run('requests', () => dashboard.then(data => data.requests), setRequests);
    void run('holidays', () => dashboard.then(data => data.holidays), setHolidays);
    // Show the useful summary before calculating the larger staffing view.
    void run('coverage', () => dashboard.then(() => api.getAllHolidayCoverage({ upcoming_only: true, reference_date: easternDate() })), setHolidayCoverages);
  }, [run, user?.timezone]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  // Use dynamic local calendar date (YYYY-MM-DD)
  const todayStr = easternDate();

  // Calculated metrics
  const totalEmployeesCount = employees.filter(e=>e.status==='active').length;
  const pendingRequests = requests.filter((r) => r.status === 'Pending').sort((a,b)=>a.submitted_at.localeCompare(b.submitted_at));
  const approvedRequests = requests.filter((r) => r.status === 'Approved');

  // Currently on leave (approved requests covering today)
  const currentlyOnLeave = approvedRequests.filter(
    (r) => r.start_date <= todayStr && r.end_date >= todayStr && employees.some(e=>e.id===r.employee_id&&e.status==='active')
  ).filter((r,index,all)=>all.findIndex(item=>item.employee_id===r.employee_id)===index);

  // Department distribution calculation
  const deptMap: Record<string, { total: number; onLeave: number }> = {};
  employees.filter(e=>e.status==='active').forEach((emp) => {
    const dept = emp.department || 'Unassigned department';
    if (!deptMap[dept]) deptMap[dept] = { total: 0, onLeave: 0 };
    deptMap[dept].total += 1;
  });
  currentlyOnLeave.forEach((req) => {
    const dept = employees.find(emp => emp.id === req.employee_id)?.department || 'Unassigned department';
    if (deptMap[dept]) {
      deptMap[dept].onLeave += 1;
    }
  });

  // Upcoming active holidays, including today and future years.
  const upcomingHolidays = holidays
    .filter((h) => h.is_active !== false && h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const openReviewModal = (req: LeaveRequest, action: 'Approved' | 'Rejected') => {
    onNavigateTab(`administration/leave-requests?request=${encodeURIComponent(req.id)}`);
  };

  const handleAssignShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignShiftForm.employee_id || !assignShiftForm.holiday_id) {
      showToast({
        type: 'error',
        title: 'Incomplete Details',
        message: 'Please select both an employee and a holiday.',
      });
      return;
    }
    setIsAssigningShift(true);
    try {
      await api.assignHolidayShift({
        employee_id: assignShiftForm.employee_id,
        holiday_id: assignShiftForm.holiday_id,
        working_hours: assignShiftForm.working_hours,
        status: assignShiftForm.status,
        admin_note: assignShiftForm.admin_note || 'Scheduled by Administrator',
      });
      const emp = employees.find((e) => e.id === assignShiftForm.employee_id);
      showToast({
        type: 'success',
        title: 'Shift Assigned',
        message: `Holiday shift assigned to ${emp?.full_name || 'employee'} successfully.`,
      });
      setIsScheduleShiftOpen(false);
      setAssignShiftForm({
        employee_id: '',
        holiday_id: '',
        working_hours: '9:00 AM – 5:00 PM',
        status: 'Approved',
        admin_note: '',
      });
      await loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Assignment Failed',
        message: err.message || 'Failed to assign holiday shift.',
      });
    } finally {
      setIsAssigningShift(false);
    }
  };


  const refresh = () => { api.invalidateReadCache(); loadData(); };
  const openScheduleShift = (holidayId?: string) => {
    setAssignShiftForm({
      employee_id: employees[0]?.id || '',
      holiday_id: holidayId || upcomingHolidays[0]?.id || holidays[0]?.id || '',
      working_hours: '9:00 AM – 5:00 PM',
      status: 'Approved',
      admin_note: '',
    });
    setIsScheduleShiftOpen(true);
  };
  const nextCoverage = [...holidayCoverages]
    .filter(item => item?.holiday && item.holiday.is_active !== false && item.holiday.date >= todayStr)
    .sort((x, y) => x.holiday.date.localeCompare(y.holiday.date));
  const teamCoverage = holidayCoverages.find(item => item.holiday?.id === teamHolidayId);
  const departments = Object.entries(deptMap).sort(([nameA, x], [nameB, y]) => y.onLeave - x.onLeave || nameA.localeCompare(nameB));
  const initials = (name?: string) => name?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'HR';

  return (
    <div className="go-dashboard go-admin-workspace go-home">
      <div className="go-page-header">
        <PageHeading icon={Sparkles} eyebrow="Administration" title="Team overview"
          description={`Welcome back, ${user.full_name.split(' ')[0]}. Here’s what’s happening across your team.`} />
        <div className="go-page-actions">
          <button type="button" onClick={() => onNavigateTab('administration/onboarding')} className="go-button go-button-secondary"><ClipboardList size={16} /> Onboarding</button>
          <button type="button" onClick={() => onNavigateTab('employees')} className="go-button go-button-secondary">
            <Users size={16} /> View employees
          </button>
          <button type="button" onClick={() => onNavigateTab('administration/leave-requests')} className="go-button go-button-primary">
            <ClipboardList size={16} /> Review requests <span className="go-button-count">{pendingRequests.length}</span>
          </button>
        </div>
      </div>

      <div className="go-stat-grid" aria-label="Team summary">
        <StatCard id="stat-card-workforce" label="Employees" value={sections.employees?.ready ? totalEmployeesCount : '—'}
          detail="Active team members" icon={Users} onClick={() => onNavigateTab('employees')} />
        <StatCard id="stat-card-on-leave" label="Out today" value={sections.requests?.ready && sections.employees?.ready ? currentlyOnLeave.length : '—'}
          detail={sections.requests?.ready && sections.employees?.ready && !currentlyOnLeave.length ? 'Everyone’s in today' : 'View the company calendar'} icon={UserCheck} onClick={() => onNavigateTab('calendar')} />
        <StatCard id="stat-card-pending-requests" label="Awaiting review" value={sections.requests?.ready ? pendingRequests.length : '—'}
          detail={!sections.requests?.ready ? 'Loading requests…' : pendingRequests.length ? 'Leave requests need review' : 'No leave requests waiting'}
          icon={ClipboardList} tone="orange" onClick={() => onNavigateTab('administration/leave-requests')} />
        <StatCard id="stat-card-pc-coverage" label="Holiday coverage"
          value={nextCoverage.length ? `${nextCoverage[0].pcs_working_count}/${nextCoverage[0].pcs_required}` : '—'}
          detail={nextCoverage.length ? `${nextCoverage[0].holiday.name}, ${formatShortDate(nextCoverage[0].holiday.date)}` : 'No upcoming coverage available'}
          icon={Shield} tone="navy" onClick={() => onNavigateTab('holidays')} />
      </div>

      <DataRegion state={sections.requests} label="pending requests" onRetry={refresh}>
      <section className="go-review-queue go-surface" aria-label="Needs your review">
        <header className="go-review-head">
          <div>
            <h2>Needs your review {pendingRequests.length > 0 && <span className="go-chip is-pending">{pendingRequests.length} pending</span>}</h2>
            <p>Review leave requests and check available balances.</p>
          </div>
          <button type="button" onClick={() => onNavigateTab('administration/leave-requests')} className="go-button go-button-quiet">
            All requests <ArrowRight size={15} aria-hidden="true" />
          </button>
        </header>
        {pendingRequests.length === 0 ? (
          <div className="go-review-empty">
            <CheckCircle2 aria-hidden="true" />
            <p><strong>All caught up</strong><span>There are no pending leave requests awaiting approval.</span></p>
          </div>
        ) : (
          <ul className="go-review-list">
            <AnimatePresence initial={false}>
              {pendingRequests.map((req) => (
                <QuickReviewItem key={req.id} request={req} approved={approvedRequests} canReview={canReviewRequest(req, user.id)}
                  balance={employees.find(e => e.id === req.employee_id)?.leave_balances.find(b => b.leave_type === req.leave_type || (req.leave_type === 'Vacation Leave' && (b.leave_type as string) === 'Annual Leave'))}
                  onOpenFull={() => openReviewModal(req, 'Approved')}
                  onReviewed={refresh} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
      </DataRegion>

      <SectionCard icon={Ticket} tone="blue" title="Upcoming holidays" description="See who is working and which dates still need cover." label="Upcoming holidays and coverage"
        actions={<>
          <button type="button" className="go-button go-button-quiet" onClick={() => onNavigateTab('holidays')}>All holidays <ArrowRight size={15} aria-hidden="true" /></button>
          <button type="button" className="go-button go-button-secondary" aria-expanded={plannerOpen} aria-controls="coverage-planner" onClick={() => setPlannerOpen(!plannerOpen)}><SlidersHorizontal size={16} aria-hidden="true" />{plannerOpen ? 'Hide planner' : 'Coverage planner'}</button>
          <button type="button" className="go-button go-button-navy" onClick={() => openScheduleShift()}><Plus size={16} aria-hidden="true" />Add shift</button>
        </>}>
        <DataRegion state={sections.coverage} label="holiday coverage" onRetry={refresh}>
          {nextCoverage.length ? <ul className="go-ticket-list is-three">
            {nextCoverage.slice(0, 3).map(item => {
              const stub = ticketParts(item.holiday.date), cover = coverageLabel(item);
              const companyWide = item.holiday.scope === 'Company-wide' || ['company-wide', 'global', 'all'].includes((item.holiday.country || '').toLowerCase());
              return (
                <li key={item.holiday.id}>
                  <button type="button" className="go-ticket is-button" aria-label={`View team for ${item.holiday.name}, ${formatLongDate(item.holiday.date)}. ${cover.text}.`} onClick={() => setTeamHolidayId(item.holiday.id)}>
                    <span className="go-ticket-stub" aria-hidden="true"><small>{stub.month}</small><b>{stub.day}</b><span>{stub.weekday}</span></span>
                    <span className="go-ticket-body">
                      <strong>{item.holiday.name}</strong>
                      <small>{companyWide ? 'Company-wide' : item.holiday.country}{item.holiday.holiday_type && !(companyWide && item.holiday.holiday_type === 'Company Holiday') ? ` · ${item.holiday.holiday_type}` : ''}</small>
                      <span className="go-ticket-foot"><span className={`go-ticket-tag${cover.attention ? ' is-attention' : ''}`}>{cover.text}</span><em className="go-ticket-hint">View team<ArrowRight size={13} aria-hidden="true" /></em></span>
                    </span>
                    <Plane className="go-ticket-plane" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul> : <p className="go-card-empty">No upcoming holidays are scheduled. Add them in Holidays &amp; Shifts.</p>}
          {nextCoverage.length > 3 && <p className="go-card-more">{nextCoverage.length - 3} more upcoming {nextCoverage.length - 3 === 1 ? 'holiday' : 'holidays'} in the coverage planner.</p>}
        </DataRegion>
        {plannerOpen && <div id="coverage-planner" className="go-planner">
          <DataRegion state={sections.coverage} label="the coverage planner" onRetry={refresh}>
            <DataRegion state={sections.employees} label="employees for the holiday roster" onRetry={refresh}>
              <HolidayStaffingCoverageWidget coverageList={holidayCoverages} allEmployees={employees} onRefresh={refresh} onOpenScheduleShift={openScheduleShift} />
            </DataRegion>
          </DataRegion>
        </div>}
      </SectionCard>

      <Reveal className="go-home-duo">
        <SectionCard icon={UserCheck} title="Out today" description={formatLongDate(todayStr)} label="Out today and leave by department"
          actions={<button type="button" className="go-button go-button-quiet" onClick={() => onNavigateTab('calendar')}>Company calendar <ArrowRight size={15} aria-hidden="true" /></button>}>
          <DataRegion state={!sections.employees?.ready || sections.employees?.error ? sections.employees : sections.requests} label="approved leave" onRetry={refresh}>
            <div className="go-out">
              {currentlyOnLeave.length ? <ul className="go-row-list">
                {currentlyOnLeave.map(item => {
                  const person = employees.find(emp => emp.id === item.employee_id);
                  const name = person?.full_name || item.employee_name;
                  return <li key={item.id}>
                    <button type="button" className="go-row" aria-label={`View leave details for ${name}`} onClick={() => onNavigateTab(`administration/leave-requests?request=${encodeURIComponent(item.id)}`)}>
                      {item.employee_avatar?.trim() ? <img src={item.employee_avatar} alt="" className="go-row-avatar" /> : <span className="go-row-avatar" aria-hidden="true">{initials(name)}</span>}
                      <span className="go-row-copy"><strong>{name}</strong><small>{[person?.department || item.employee_department, item.leave_type].filter(Boolean).join(' · ')}</small></span>
                      <span className="go-row-link">Until {formatShortDate(item.end_date)}</span>
                      <ChevronRight size={18} className="go-row-chevron" aria-hidden="true" />
                    </button>
                  </li>;
                })}
              </ul> : <div className="go-out-empty"><GoBuddyArt /><p><strong>Everyone’s in today</strong><span>No approved leave covers today.</span></p></div>}
              <ul className="go-dept-list" aria-label="Leave by department">
                {departments.map(([dept, data]) => (
                  <li key={dept} className={data.onLeave ? 'has-leave' : undefined}>
                    <span className="go-dept-name">{dept}</span>
                    <span className="go-dept-bar" aria-hidden="true"><span style={{ width: `${data.total ? Math.round(data.onLeave / data.total * 100) : 0}%` }} /></span>
                    <strong className="tabular-nums">{data.onLeave} of {data.total} out</strong>
                  </li>
                ))}
                {!departments.length && <li className="go-card-empty">No active employees to display.</li>}
              </ul>
            </div>
          </DataRegion>
        </SectionCard>
        <AnnouncementNote onViewAll={() => onNavigateTab('personal/announcements')} />
      </Reveal>

      <Reveal>
        <DataRegion state={sections.employees} label="team milestones" onRetry={refresh}><CelebrationsWidget employees={employees} onNavigateTab={onNavigateTab} /></DataRegion>
      </Reveal>

      {teamCoverage && sections.employees?.ready && (
        <HolidayDetailModal coverage={teamCoverage} allEmployees={employees} onClose={() => setTeamHolidayId(null)} onRefresh={refresh} />
      )}

      {/* Admin Assign Holiday Shift Modal */}
      {isScheduleShiftOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="go-surface bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Assign Holiday Shift
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose an employee to work a holiday shift.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleShiftOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAssignShiftSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Employee *
                </label>
                <select
                  value={assignShiftForm.employee_id}
                  onChange={(e) => setAssignShiftForm({ ...assignShiftForm, employee_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  <option value="" disabled>-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id}) • {emp.department} {emp.role === 'admin' ? '[Admin]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Holiday *
                </label>
                <select
                  value={assignShiftForm.holiday_id}
                  onChange={(e) => setAssignShiftForm({ ...assignShiftForm, holiday_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  <option value="" disabled>-- Select Holiday --</option>
                  {holidays
                    .filter((h) => h.is_active !== false)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.date}) • {h.country || 'Company-wide'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Working Hours
                  </label>
                  <input
                    type="text"
                    value={assignShiftForm.working_hours}
                    onChange={(e) => setAssignShiftForm({ ...assignShiftForm, working_hours: e.target.value })}
                    placeholder="e.g. 9:00 AM – 5:00 PM"
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coverage Status
                  </label>
                  <select
                    value={assignShiftForm.status}
                    onChange={(e) => setAssignShiftForm({ ...assignShiftForm, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Approved">Approved (Rostered)</option>
                    <option value="Pending">Pending Review</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={assignShiftForm.admin_note}
                  onChange={(e) => setAssignShiftForm({ ...assignShiftForm, admin_note: e.target.value })}
                  placeholder="e.g. Scheduled for emergency client coverage"
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleShiftOpen(false)}
                  disabled={isAssigningShift}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigningShift}
                  className="px-4 py-2 text-xs font-semibold bg-[#3A5D83] hover:bg-[#182E3F] text-white rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{isAssigningShift ? 'Assigning...' : 'Assign Staff Shift'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
