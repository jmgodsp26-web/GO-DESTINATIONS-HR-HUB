import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LeaveRequest, Holiday, UserProfile, LeaveBalance, HolidayStaffingCoverage } from '../../types';
import { api } from '../../services/api';
import { CelebrationsWidget } from './CelebrationsWidget';
import { HolidayStaffingCoverageWidget } from './HolidayStaffingCoverage';
import { HolidayShiftRequestModal } from '../holidays/HolidayShiftRequestModal';
import { getTodayDateString, formatHolidayDate } from '../../utils/countryUtils';
import {
  Users,
  ClipboardList,
  UserCheck,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Paperclip,
  Check,
  X,
  Shield,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScheduleShiftOpen, setIsScheduleShiftOpen] = useState(false);

  // Review modal state
  const [reviewingRequest, setReviewingRequest] = useState<LeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [adminNote, setAdminNote] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const todayStr = getTodayDateString(user?.timezone);
      const [empRes, reqRes, holRes, covRes] = await Promise.all([
        api.getAllEmployees(),
        api.getLeaveRequests(),
        api.getHolidays(),
        api.getAllHolidayCoverage({ upcoming_only: true, reference_date: todayStr }).catch(() => []),
      ]);
      setEmployees(empRes);
      setRequests(reqRes);
      setHolidays(holRes);
      setHolidayCoverages(covRes);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.timezone]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  // Use dynamic local calendar date (YYYY-MM-DD)
  const todayStr = getTodayDateString(user?.timezone);

  // Calculated metrics
  const totalEmployeesCount = employees.length;
  const pendingRequests = requests.filter((r) => r.status === 'Pending');
  const approvedRequests = requests.filter((r) => r.status === 'Approved');

  // Currently on leave (approved requests covering today)
  const currentlyOnLeave = approvedRequests.filter(
    (r) => r.start_date <= todayStr && r.end_date >= todayStr
  );

  // Department distribution calculation
  const deptMap: Record<string, { total: number; onLeave: number }> = {};
  employees.forEach((emp) => {
    const dept = emp.department || 'Technology';
    if (!deptMap[dept]) deptMap[dept] = { total: 0, onLeave: 0 };
    deptMap[dept].total += 1;
  });
  currentlyOnLeave.forEach((req) => {
    const dept = req.employee_department || 'Technology';
    if (deptMap[dept]) {
      deptMap[dept].onLeave += 1;
    }
  });

  // Upcoming holidays (strict: strictly 2026 future dates holiday.date > todayStr)
  const upcomingHolidays = holidays
    .filter((h) => h.is_active !== false && h.date > todayStr && h.date.startsWith('2026'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const openReviewModal = (req: LeaveRequest, action: 'Approved' | 'Rejected') => {
    setReviewingRequest(req);
    setReviewAction(action);
    setAdminNote('');
    setReviewError(null);
  };

  const handleConfirmReview = async () => {
    if (!reviewingRequest) return;
    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      await api.reviewLeaveRequest(reviewingRequest.id, reviewAction, adminNote.trim() || undefined);
      showToast({
        type: reviewAction === 'Approved' ? 'success' : 'info',
        title: `Leave ${reviewAction}`,
        message: `${reviewingRequest.employee_name}'s request was ${reviewAction.toLowerCase()} successfully.`,
      });
      setReviewingRequest(null);
      await loadData();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to update leave request.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs animate-pulse flex justify-between">
          <div className="space-y-2">
            <div className="h-5 bg-slate-200 rounded w-48" />
            <div className="h-3 bg-slate-200 rounded w-72" />
          </div>
          <div className="h-9 bg-slate-200 rounded-xl w-40" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs animate-pulse space-y-3">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="h-7 bg-slate-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Operational Command Center Hero */}
      <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80 uppercase tracking-wide">
                Admin Command Center
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">Headquarters Operations</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">
              Welcome back, {user.full_name.split(' ')[0]}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Manage company headcount, review employee leave submissions, and oversee holiday coverage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <button
              type="button"
              onClick={() => onNavigateTab('employees')}
              className="px-3.5 py-2.5 text-xs font-semibold bg-white text-slate-700 border border-slate-200/90 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all shadow-2xs min-h-[42px]"
            >
              Headcount Directory
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('leave-requests')}
              className="px-4 py-2.5 text-xs font-semibold bg-[#3A5D83] hover:bg-[#2F4D6D] active:bg-[#253E58] text-white rounded-xl transition-all shadow-xs min-h-[42px] flex items-center space-x-1.5"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Review Requests ({pendingRequests.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Metric Summary Cards - 4 Columns */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Employees */}
        <div
          id="stat-card-workforce"
          onClick={() => onNavigateTab('employees')}
          className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-indigo-300 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Headcount</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200/70 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{totalEmployeesCount}</span>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Active directory staff</span>
            </p>
          </div>
        </div>

        {/* Employees Currently on Leave */}
        <div
          id="stat-card-on-leave"
          onClick={() => onNavigateTab('calendar')}
          className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-emerald-300 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Out Today</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{currentlyOnLeave.length}</span>
            <p className="text-[11px] text-slate-400 mt-1">
              {currentlyOnLeave.length === 1 ? '1 team member absent' : `${currentlyOnLeave.length} away today`}
            </p>
          </div>
        </div>

        {/* Pending Leave Requests */}
        <div
          id="stat-card-pending-requests"
          onClick={() => onNavigateTab('leave-requests')}
          className={`rounded-2xl border p-4 sm:p-5 shadow-xs cursor-pointer transition-all flex flex-col justify-between ${
            pendingRequests.length > 0
              ? 'border-amber-300 ring-1 ring-amber-200/80 bg-amber-50/25 hover:bg-amber-50/40'
              : 'bg-white border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Pending Review</span>
            <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
              <ClipboardList className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{pendingRequests.length}</span>
              {pendingRequests.length > 0 && (
                <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                  Action Required
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {pendingRequests.length === 1 ? '1 submission waiting' : `${pendingRequests.length} submissions waiting`}
            </p>
          </div>
        </div>

        {/* Holiday Coverage Target */}
        <div
          id="stat-card-pc-coverage"
          onClick={() => onNavigateTab('holidays')}
          className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-sky-300 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Holiday Coverage</span>
            <span className="p-1.5 bg-sky-50 text-sky-700 border border-sky-200/70 rounded-lg">
              <Shield className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {holidayCoverages.length > 0
                ? `${holidayCoverages[0].pcs_working_count}/${holidayCoverages[0].pcs_required}`
                : '2/2'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {upcomingHolidays[0] ? `${upcomingHolidays[0].name}` : 'Staffing target'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Upcoming Holidays & Staff Coverage Section */}
      <HolidayStaffingCoverageWidget
        coverageList={holidayCoverages}
        allEmployees={employees}
        onRefresh={loadData}
        onOpenScheduleShift={() => setIsScheduleShiftOpen(true)}
      />

      {/* 4. Quick Approval Queue */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Pending Leave Queue
              </h2>
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                  {pendingRequests.length} pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and approve or reject submissions with instant balance verification.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('leave-requests')}
            className="text-xs font-semibold text-[#3A5D83] hover:text-[#2F4D6D] transition-colors flex items-center space-x-1"
          >
            <span>All Requests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingRequests.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-800">All submissions reviewed</p>
              <p className="text-slate-400 text-[11px] mt-0.5">There are no pending leave requests awaiting approval.</p>
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
                      <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-[11px]">
                        {req.leave_type}
                      </span>
                      <span className="text-slate-600 font-medium tabular-nums">
                        {req.start_date === req.end_date ? req.start_date : `${req.start_date} → ${req.end_date}`}
                      </span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-md text-[11px] tabular-nums">
                        {req.is_half_day ? '0.5 day' : `${req.total_days} ${req.total_days === 1 ? 'day' : 'days'}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 italic">
                      &ldquo;{req.reason}&rdquo;
                    </p>
                    {req.attachment_name && (
                      <div className="flex items-center space-x-1 text-[11px] text-indigo-600 mt-1">
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
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openReviewModal(req, 'Rejected')}
                    className="px-3.5 py-2 bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 active:bg-rose-100 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 min-h-[36px]"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. Department Absence Heatmap & Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Department Workforce &amp; Absence Distribution
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Live Staffing Health</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Object.entries(deptMap).map(([dept, data]) => {
            const presenceRate = data.total > 0 ? Math.round(((data.total - data.onLeave) / data.total) * 100) : 100;
            return (
              <div
                key={dept}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{dept}</span>
                    <span className="text-[10px] font-semibold text-slate-500">{data.total} Staff</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-slate-700">{presenceRate}% Present</span>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {data.onLeave > 0 ? `${data.onLeave} out` : 'Full capacity'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      data.onLeave > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${presenceRate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Celebrations & Milestones Widget */}
      <CelebrationsWidget employees={employees} onNavigateTab={onNavigateTab} />

      {/* 7. Two Column Layout: Currently on Leave & Upcoming Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Currently on Leave list */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Employees Out Today
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="space-y-2.5">
            {currentlyOnLeave.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                All employees are scheduled at work today.
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
                      <p className="text-[11px] text-slate-500">{item.employee_department} • {item.leave_type}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-semibold text-emerald-800 tabular-nums">
                      Until {item.end_date}
                    </span>
                    <span className="block text-[10px] text-emerald-600">
                      {item.total_days} {item.total_days === 1 ? 'day' : 'days'} duration
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Company Holidays list */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
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
                      <span className="block text-[9px] font-bold text-indigo-600 uppercase leading-none">
                        {monthShort}
                      </span>
                      <span className="block text-xs font-bold text-slate-900 leading-tight mt-0.5 tabular-nums">
                        {day}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{holiday.name}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{holiday.description || 'Company wide closure'}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium tabular-nums">{holiday.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Review Action Modal */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-sm font-bold text-slate-900">
                {reviewAction === 'Approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </h3>
              <button
                type="button"
                onClick={() => setReviewingRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reviewError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{reviewError}</span>
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-900 text-sm">{reviewingRequest.employee_name}</p>
                <p className="text-slate-600">
                  Requesting <strong>{reviewingRequest.total_days} days</strong> of {reviewingRequest.leave_type} ({reviewingRequest.start_date} to {reviewingRequest.end_date})
                </p>
                <p className="text-slate-500 italic mt-1 bg-white p-2.5 rounded-lg border border-slate-200">
                  &ldquo;{reviewingRequest.reason}&rdquo;
                </p>
              </div>

              {reviewAction === 'Approved' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  <p className="font-semibold">Confirming Approval</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    Upon approval, {reviewingRequest.total_days} day(s) will automatically be deducted from {reviewingRequest.employee_name}&rsquo;s {reviewingRequest.leave_type} balance.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                  <p className="font-semibold">Confirming Rejection</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    No leave days will be deducted. You can provide an explanation note below for the employee.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="admin-note-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  {reviewAction === 'Approved' ? 'Optional Approval Note' : 'Optional Rejection Reason'}
                </label>
                <textarea
                  id="admin-note-input"
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={
                    reviewAction === 'Approved'
                      ? 'e.g. Approved. Have a wonderful break!'
                      : 'e.g. Coverage constraints for this project milestone.'
                  }
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setReviewingRequest(null)}
                disabled={isSubmittingReview}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="submit-review-action-btn"
                onClick={handleConfirmReview}
                disabled={isSubmittingReview}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors shadow-2xs ${
                  reviewAction === 'Approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingReview
                  ? 'Processing...'
                  : reviewAction === 'Approved'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Shift Request Modal */}
      {isScheduleShiftOpen && (
        <HolidayShiftRequestModal
          holidays={holidays}
          onClose={() => setIsScheduleShiftOpen(false)}
          onSuccess={() => {
            setIsScheduleShiftOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
