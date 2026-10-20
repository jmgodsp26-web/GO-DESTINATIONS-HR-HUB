import { useSections } from '../../hooks/useSections';
import { DataRegion } from '../common/LoadFeedback';
import { AnnouncementWidget } from '../announcements/AnnouncementsView';
import { PageHeading, StatCard } from '../common/WorkspaceUI';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LeaveRequest, Holiday, UserProfile, LeaveBalance, HolidayStaffingCoverage } from '../../types';
import { api } from '../../services/api';
import { CelebrationsWidget } from './CelebrationsWidget';
import { HolidayStaffingCoverageWidget } from './HolidayStaffingCoverage';
import { getTodayDateString, formatHolidayDate } from '../../utils/countryUtils';
import {
  Users,
  ClipboardList,
  UserCheck,
  CalendarDays,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Paperclip,
  Check,
  X,
  Shield,
  Building2,
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

  const loadData = useCallback(() => {
    void run('employees', api.getAllEmployees, setEmployees);
    void run('requests', () => api.getLeaveRequests(), setRequests);
    void run('holidays', () => api.getHolidays(), setHolidays);
    void run('coverage', () => api.getAllHolidayCoverage({ upcoming_only: true, reference_date: getTodayDateString(user?.timezone) }), setHolidayCoverages);
  }, [run, user?.timezone]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  // Use dynamic local calendar date (YYYY-MM-DD)
  const todayStr = getTodayDateString(user?.timezone);

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


  return (
    <div className="go-dashboard go-admin-workspace space-y-6 animate-in fade-in duration-200">
      <div className="go-page-header">
        <PageHeading eyebrow="Administration" title="Team overview"
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
          detail="View the company calendar" icon={UserCheck} tone="green" onClick={() => onNavigateTab('calendar')} />
        <StatCard id="stat-card-pending-requests" label="Awaiting review" value={sections.requests?.ready ? pendingRequests.length : '—'}
          detail={!sections.requests?.ready ? 'Loading requests…' : pendingRequests.length ? 'Leave requests need review' : 'No leave requests waiting'}
          icon={ClipboardList} tone="orange" onClick={() => onNavigateTab('administration/leave-requests')} />
        <StatCard id="stat-card-pc-coverage" label="Holiday coverage"
          value={holidayCoverages.length ? `${holidayCoverages[0].pcs_working_count}/${holidayCoverages[0].pcs_required}` : '—'}
          detail={holidayCoverages.length ? (holidayCoverages[0]?.holiday.name || 'Scheduled / required PCs') : 'No upcoming coverage available'}
          icon={Shield} tone="navy" onClick={() => onNavigateTab('holidays')} />
      </div>



      <DataRegion state={sections.requests} label="pending requests" onRetry={loadData}>
{/* 4. Quick Approval Queue */}
      <div className="go-review-queue go-surface bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Needs your review
              </h2>
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[12px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                  {pendingRequests.length} pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review leave requests and check available balances.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('administration/leave-requests')}
            className="text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] transition-colors flex items-center space-x-1"
          >
            <span>All Requests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingRequests.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-800">No requests waiting for review</p>
              <p className="text-slate-400 text-[12px] mt-0.5">There are no pending leave requests awaiting approval.</p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-start space-x-3.5">
                  {req.employee_avatar && req.employee_avatar.trim() ? (
                    <img
                      src={req.employee_avatar}
                      alt={req.employee_name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shrink-0">
                      {req.employee_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'HR'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{req.employee_name}</span>
                      <span className="text-xs text-slate-400">({req.employee_department})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs mt-1">
                      <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-[12px]">
                        {req.leave_type}
                      </span>
                      <span className="text-slate-600 font-medium tabular-nums">
                        {req.start_date === req.end_date ? req.start_date : `${req.start_date} → ${req.end_date}`}
                      </span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-md text-[12px] tabular-nums">
                        {req.is_half_day ? '0.5 day' : `${req.total_days} ${req.total_days === 1 ? 'day' : 'days'}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 italic">
                      &ldquo;{req.reason}&rdquo;
                    </p>
                    {req.attachment_name && (
                      <div className="flex items-center space-x-1 text-[12px] text-indigo-600 mt-1">
                        <Paperclip className="w-3 h-3" />
                        <span>Attached: {req.attachment_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Approve / Reject Actions */}
                <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => openReviewModal(req, 'Approved')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs flex items-center space-x-1.5 min-h-[36px]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Review request</span>
                  </button>

                </div>
              </div>
            ))
          )}
        </div>
      </div>

      </DataRegion>
      <DataRegion state={sections.coverage} label="holiday coverage" onRetry={loadData}>
{/* 3. Upcoming Holidays & Shifts Section */}
      <DataRegion state={sections.employees} label="employees for the holiday roster" onRetry={loadData}><HolidayStaffingCoverageWidget
        coverageList={holidayCoverages}
        allEmployees={employees}
        onRefresh={loadData}
        onOpenScheduleShift={(holidayId) => {
          setAssignShiftForm({
            employee_id: employees[0]?.id || '',
            holiday_id: holidayId || upcomingHolidays[0]?.id || holidays[0]?.id || '',
            working_hours: '9:00 AM – 5:00 PM',
            status: 'Approved',
            admin_note: '',
          });
          setIsScheduleShiftOpen(true);
        }}
      /></DataRegion>

      </DataRegion>
      <DataRegion state={sections.employees} label="team information" onRetry={loadData}>
<DataRegion state={sections.requests} label="department leave" onRetry={loadData}>
      <section className="go-surface bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs" aria-label="Leave by department">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-slate-100 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">Leave by Department</h3>
            </div>
            <p className="mt-2 text-xs text-slate-500">Shows approved leave covering today.</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">{formatHolidayDate(todayStr).formatted}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {Object.entries(deptMap).sort(([nameA, a], [nameB, b]) => b.onLeave - a.onLeave || nameA.localeCompare(nameB)).map(([dept, data]) => {
            const departmentLeaves = currentlyOnLeave.filter(request => (employees.find(emp => emp.id === request.employee_id)?.department || 'Unassigned department') === dept);
            return (
              <div key={dept} className={`p-4 rounded-xl border min-w-0 ${data.onLeave ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200/80 bg-slate-50/50'}`}>
                <h4 className="text-sm font-bold text-slate-900 break-words">{dept}</h4>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed"><strong className="tabular-nums">{data.onLeave} of {data.total}</strong> {data.total === 1 ? 'employee' : 'employees'} on leave today</p>
                {departmentLeaves.length > 0 && <ul className="mt-3 space-y-2 border-t border-amber-200/60 pt-3">
                  {departmentLeaves.map(request => {
                    const name = employees.find(emp => emp.id === request.employee_id)?.full_name || request.employee_name;
                    return <li key={request.id}><button type="button" className="w-full text-left flex items-center justify-between gap-2 rounded-lg py-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" aria-label={`View leave details for ${name}`} onClick={() => onNavigateTab(`administration/leave-requests?request=${encodeURIComponent(request.id)}`)}><span className="break-words">{name}</span><ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" /></button></li>;
                  })}
                </ul>}
              </div>
            );
          })}
        </div>
        {!Object.keys(deptMap).length && <p className="text-sm text-slate-500 py-4">No active employees to display.</p>}
      </section>

      </DataRegion></DataRegion>
      {/* 6. Celebrations & Milestones Widget */}
      <DataRegion state={sections.employees} label="team milestones" onRetry={loadData}><CelebrationsWidget employees={employees} onNavigateTab={onNavigateTab} /></DataRegion>
      <AnnouncementWidget onViewAll={() => onNavigateTab('personal/announcements')} />

      {/* 7. Two Column Layout: Currently on Leave & Upcoming Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
<DataRegion state={!sections.employees?.ready || sections.employees?.error ? sections.employees : sections.requests} label="approved leave" onRetry={loadData}>
        {/* Currently on Leave list */}
        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Employees on Leave Today
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              {formatHolidayDate(todayStr).formatted}
            </span>
          </div>

          <div className="space-y-2.5">
            {currentlyOnLeave.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No employees have approved leave today.
              </p>
            ) : (
              currentlyOnLeave.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100"
                >
                  <div className="flex items-center space-x-3">
                    {item.employee_avatar && item.employee_avatar.trim() ? (
                      <img
                        src={item.employee_avatar}
                        alt={item.employee_name}
                        className="w-8 h-8 rounded-full object-cover border border-emerald-200 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-200 shrink-0">
                        {item.employee_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'HR'}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.employee_name}</p>
                      <p className="text-[12px] text-slate-500">{item.employee_department} • {item.leave_type}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-semibold text-emerald-800 tabular-nums">
                      Until {item.end_date}
                    </span>
                    <span className="block text-[12px] text-emerald-600">
                      {item.total_days} {item.total_days === 1 ? 'day' : 'days'} duration
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

</DataRegion>
<DataRegion state={sections.holidays} label="upcoming holidays" onRetry={loadData}>
        {/* Company Holidays list */}
        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Upcoming Holidays
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('holidays')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
            >
              Manage Holidays
            </button>
          </div>

          <div className="space-y-2.5">
            {upcomingHolidays.map((holiday) => {
              const { monthShort, day } = formatHolidayDate(holiday.date);

              return (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-white border border-slate-200 rounded-lg p-1.5 text-center w-11 shadow-2xs">
                      <span className="block text-[12px] font-bold text-indigo-600 uppercase leading-none">
                        {monthShort}
                      </span>
                      <span className="block text-xs font-bold text-slate-900 leading-tight mt-0.5 tabular-nums">
                        {day}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{holiday.name}</p>
                      <p className="text-[12px] text-slate-500 line-clamp-1">{holiday.description || 'Company wide closure'}</p>
                    </div>
                  </div>
                  <span className="text-[12px] text-slate-400 font-medium tabular-nums">{holiday.date}</span>
                </div>
              );
            })}
          </div>
        </div>
</DataRegion>
      </div>

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
