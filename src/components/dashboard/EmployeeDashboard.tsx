import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LeaveBalance, LeaveRequest, Holiday, EmployeeDocument, HolidayShiftRequest } from '../../types';
import { api } from '../../services/api';
import { downloadIcsFile } from '../../utils/calendar';
import { LeaveRequestModal } from '../leave/LeaveRequestModal';
import { HolidayShiftRequestModal } from '../holidays/HolidayShiftRequestModal';
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  History,
  ArrowRight,
  FolderOpen,
  FileText,
  Download,
  Lock,
  Plane,
  HeartPulse,
  Briefcase,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight,
  Sun,
  ShieldCheck,
  Globe,
  CalendarX2,
} from 'lucide-react';
import {
  getCountryFlag,
  DEFAULT_COUNTRY,
  getTodayDateString,
  getUpcomingHolidays,
  formatHolidayDate,
} from '../../utils/countryUtils';

interface EmployeeDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onNavigateTab }) => {
  const { user, unreadCount } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [recentRequests, setRecentRequests] = useState<LeaveRequest[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
  const [myHolidayShifts, setMyHolidayShifts] = useState<HolidayShiftRequest[]>([]);
  const [myDocuments, setMyDocuments] = useState<EmployeeDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const todayStr = getTodayDateString(user?.timezone);
      const [balRes, reqRes, holRes, shiftRes, docRes] = await Promise.all([
        api.getLeaveBalances(),
        api.getLeaveRequests({ scope: 'mine' }),
        api.getHolidays({
          country: user?.country,
          upcoming_only: true,
          year: '2026',
          is_active: true,
          reference_date: todayStr,
        }),
        api.getHolidayShifts({ employee_id: user?.id }).catch(() => []),
        api.getMyDocuments().catch(() => []),
      ]);
      setBalances(balRes);
      setRecentRequests(reqRes);
      setMyHolidayShifts(shiftRes || []);
      setMyDocuments(docRes || []);

      // Filter upcoming holidays (strictly 2026 calendar year and strictly future dates holiday.date > todayStr)
      // Only applicable to user's country or Company-wide/Global
      const userLoc = { country: user?.country, region: user?.region };
      const futureHols = getUpcomingHolidays(holRes, {
        referenceDateStr: todayStr,
        strictFutureOnly: true,
        year: 2026,
        userLocation: userLoc,
      });
      setUpcomingHolidays(futureHols.slice(0, 4));
    } catch (err: any) {
      if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
        console.error('Failed to load employee dashboard data:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.country, user?.region, user?.timezone]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (!user) return null;

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user.full_name.split(' ')[0] || user.full_name;

  // Leave calculations with official master data types
  const vacationBalance = balances.find((b) => b.leave_type === 'Vacation Leave');
  const sickBalance = balances.find((b) => b.leave_type === 'Sick Leave');
  const emergencyBalance = balances.find((b) => b.leave_type === 'Emergency Leave');
  const medicalBalance = balances.find((b) => b.leave_type === 'Medical Leave');
  const unpaidBalance = balances.find((b) => b.leave_type === 'Unpaid Leave');

  const vacAllocated = vacationBalance?.allocated_days ?? 15;
  const vacUsed = vacationBalance?.used_days ?? 0;
  const vacRemaining = Math.max(0, vacAllocated - vacUsed);
  const vacPercent = vacAllocated > 0 ? Math.min(100, Math.round((vacUsed / vacAllocated) * 100)) : 0;

  const sickAllocated = sickBalance?.allocated_days ?? 10;
  const sickUsed = sickBalance?.used_days ?? 0;
  const sickRemaining = Math.max(0, sickAllocated - sickUsed);
  const sickPercent = sickAllocated > 0 ? Math.min(100, Math.round((sickUsed / sickAllocated) * 100)) : 0;

  // Paid balances sum (Unpaid Leave does not count towards or deduct from paid allowance)
  const paidBalances = balances.filter((b) => b.leave_type !== 'Unpaid Leave');
  const totalAllocatedAll = paidBalances.reduce((acc, curr) => acc + curr.allocated_days, 0);
  const totalUsedAll = paidBalances.reduce((acc, curr) => acc + curr.used_days, 0);
  const totalRemainingAll = Math.max(0, totalAllocatedAll - totalUsedAll);
  const pendingRequests = recentRequests.filter((r) => r.status === 'Pending');
  const pendingCount = pendingRequests.length;

  // Next upcoming holiday & employee shift status
  const nextHoliday = upcomingHolidays[0];
  const nextHolidayShift = nextHoliday
    ? myHolidayShifts.find((s) => s.holiday_id === nextHoliday.id)
    : null;

  const handleDownloadDoc = (doc: EmployeeDocument) => {
    if (doc.file_data) {
      const link = document.createElement('a');
      link.href = doc.file_data;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const content = `GO Destinations HR Hub - Document Record\n\nDocument: ${doc.name}\nCategory: ${doc.category}\nFile Size: ${doc.file_size}\nUploaded: ${new Date(doc.uploaded_at).toLocaleString()}\n`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name.endsWith('.txt') ? doc.name : `${doc.name}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Welcome */}
        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-5 bg-slate-200 rounded w-48" />
              <div className="h-3 bg-slate-200 rounded w-64" />
            </div>
          </div>
          <div className="h-10 bg-slate-200 rounded-xl w-36" />
        </div>

        {/* Skeleton Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs animate-pulse space-y-3">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="h-7 bg-slate-200 rounded w-16" />
              <div className="h-2 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="go-dashboard go-employee-workspace go-personal-home space-y-6 animate-in fade-in duration-200">
      <div className="go-page-intro">
        <div><span className="go-eyebrow">YOUR EVERYDAY HR, IN ONE PLACE</span><h1>My Workspace</h1><p>Your time off, documents, and upcoming schedule.</p></div>
        <span className="go-context-tag"><CalendarDays className="w-4 h-4" />{new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: user.timezone || undefined }).format(new Date())}</span>
      </div>
      {/* Personal welcome and existing quick actions */}
      <div className="go-welcome relative overflow-hidden go-surface bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="relative shrink-0">
              {user.avatar_url && user.avatar_url.trim() ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-slate-200/90 shadow-xs ring-2 ring-slate-100"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#3A5D83] text-white flex items-center justify-center font-bold text-lg border border-slate-200/90 shadow-xs ring-2 ring-slate-100">
                  {user.full_name
                    ? user.full_name
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                    : 'GD'}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="go-personal-greeting text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {getGreeting()}, {firstName}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                  Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Welcome back. Everything you need to plan your next day off.
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-2 font-normal">
                <span className="font-semibold text-slate-700">{user.job_title}</span>
                <span className="text-slate-300">•</span>
                <span>{user.department}</span>
                <span className="text-slate-300">•</span>
                <span className="tabular-nums font-mono text-[12px] text-slate-400">ID: {user.employee_id}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions (Visually Distinct Touch-Friendly Buttons) */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <button
              type="button"
              id="dashboard-request-leave-btn"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#3A5D83] hover:bg-[#182E3F] active:bg-[#182E3F] text-white rounded-xl font-semibold text-xs transition-all shadow-xs min-h-[44px]"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Request Leave</span>
            </button>

            <button
              type="button"
              id="dashboard-holiday-shift-btn"
              onClick={() => setIsShiftModalOpen(true)}
              className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-[#3A5D83] border border-[#3A5D83]/30 rounded-xl font-semibold text-xs transition-all shadow-2xs min-h-[44px]"
            >
              <Briefcase className="w-4 h-4 shrink-0 text-[#3A5D83]" />
              <span>Holiday Shift</span>
            </button>

            <button
              type="button"
              id="dashboard-my-requests-btn"
              onClick={() => onNavigateTab('leave')}
              className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl font-semibold text-xs transition-all shadow-2xs min-h-[44px]"
            >
              <History className="w-4 h-4 shrink-0 text-slate-500" />
              <span>My Requests</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Rich Leave Balances (4 Refined Information Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Your leave balances
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('leave')}
            className="text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] transition-colors flex items-center space-x-1"
          >
            <span>See all balances</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: Total Balance Available */}
          <div className="go-surface bg-white rounded-2xl border border-indigo-100/90 bg-gradient-to-b from-indigo-50/30 to-white p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 tracking-wide">Total Balance</span>
                <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <CalendarCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-950 tabular-nums">
                  {totalRemainingAll}
                </span>
                <span className="text-xs font-semibold text-indigo-600">days available</span>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-indigo-100/70 text-[12px] text-indigo-700/80 flex items-center justify-between">
              <span>Combined balance</span>
              <span className="font-mono text-[12px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-700 font-semibold">
                {balances.length} Types
              </span>
            </div>
          </div>

          {/* Card 2: Vacation Leave */}
          <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Vacation Leave</span>
                <span className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-lg">
                  <Plane className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {vacRemaining}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ {vacAllocated}d left</span>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100">
              <div className="flex items-center justify-between text-[12px] text-slate-500 mb-1.5">
                <span>{vacUsed} days taken</span>
                <span className="font-semibold text-slate-700">{vacPercent}% used</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${vacPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Sick Leave */}
          <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Sick Leave</span>
                <span className="p-1.5 bg-sky-50 text-sky-700 border border-sky-200/70 rounded-lg">
                  <HeartPulse className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {sickRemaining}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ {sickAllocated}d left</span>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100">
              <div className="flex items-center justify-between text-[12px] text-slate-500 mb-1.5">
                <span>{sickUsed} days taken</span>
                <span className="font-semibold text-slate-700">{sickPercent}% used</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${sickPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Pending Queue */}
          <button
            type="button"
            aria-label={`${pendingCount} leave requests awaiting review. View my requests`}
            onClick={() => onNavigateTab('leave')}
            className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
              pendingCount > 0
                ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Awaiting review</span>
                <span
                  className={`p-1.5 rounded-lg border ${
                    pendingCount > 0
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200/80'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {pendingCount}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {pendingCount === 1 ? 'request' : 'requests'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 text-[12px]">
              {pendingCount > 0 ? (
                <span className="text-amber-800 font-semibold flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Awaiting HR approval</span>
                </span>
              ) : (
                <span className="text-slate-400">No requests awaiting review</span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 3. Upcoming Holiday & Shift Status Highlight */}
      {nextHoliday && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            {(() => {
              const { monthShort, day } = formatHolidayDate(nextHoliday.date);
              return (
                <div className="w-12 h-12 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-700 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                  <span className="text-[12px] font-bold uppercase tracking-wider leading-none">
                    {monthShort}
                  </span>
                  <span className="text-base font-extrabold leading-none mt-1 tabular-nums text-slate-900">
                    {day}
                  </span>
                </div>
              );
            })()}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {nextHoliday.name}
                </h3>
                {nextHoliday.scope === 'Company-wide' ? (
                  <span className="inline-flex items-center space-x-1 text-[12px] px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <span>🌐</span>
                    <span>Company-wide</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 text-[12px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <span>{getCountryFlag(nextHoliday.country || DEFAULT_COUNTRY)}</span>
                    <span>{nextHoliday.country || DEFAULT_COUNTRY}</span>
                    {nextHoliday.region && nextHoliday.region !== 'All' && (
                      <span className="text-slate-500">({nextHoliday.region})</span>
                    )}
                  </span>
                )}
                {nextHolidayShift?.status === 'Approved' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    🟢 Shift Roster Approved
                  </span>
                ) : nextHolidayShift?.status === 'Pending' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    🟡 Volunteer Request Pending
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {nextHoliday.description || 'GO Destinations corporate holiday closure'}.
                {nextHolidayShift?.status === 'Approved' && (
                  <strong className="text-emerald-700 ml-1 font-semibold">
                    +1 Compensatory Leave Day will be credited to your Vacation Leave balance.
                  </strong>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            {!nextHolidayShift && (
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(true)}
                className="px-3.5 py-2 bg-[#3A5D83] hover:bg-[#182E3F] text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs flex items-center space-x-1.5 min-h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Volunteer for Shift</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('holidays')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold transition-colors shadow-2xs min-h-[38px]"
            >
              View Calendar
            </button>
          </div>
        </div>
      )}

      {/* 4. Two-Column Layout: Recent Leave Activity & Upcoming Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Left 2 Cols: Recent Leave Requests */}
        <div className="lg:col-span-2 go-surface bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent requests
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your recent requests and feedback from HR
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('leave')}
              className="text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] transition-colors flex items-center space-x-1"
            >
              <span>View all requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden sm:block overflow-x-auto">
            {recentRequests.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                <CalendarCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No leave requests submitted yet</p>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  Click &ldquo;Request Leave&rdquo; above to apply for vacation, sick, emergency, or medical time off.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-medium border-b border-slate-200/70">
                  <tr>
                    <th className="px-4 py-3">Leave Type</th>
                    <th className="px-4 py-3">Date Range</th>
                    <th className="px-4 py-3 text-right">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentRequests.slice(0, 5).map((req) => {
                    const statusBadgeClass =
                      req.status === 'Approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : req.status === 'Rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : req.status === 'Cancelled' ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200/80';

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {req.leave_type}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 tabular-nums">
                          {req.start_date === req.end_date
                            ? req.start_date
                            : `${req.start_date} → ${req.end_date}`}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-800 tabular-nums">
                          {req.is_half_day ? (
                            <span className="inline-flex items-center space-x-1 font-bold text-amber-900 bg-amber-100/90 border border-amber-200 px-1.5 py-0.5 rounded text-[12px]">
                              <span>0.5d</span>
                              <span className="text-[12px] uppercase font-bold text-amber-700">
                                {req.half_day_period === 'morning' ? 'AM' : 'PM'}
                              </span>
                            </span>
                          ) : (
                            <span>{req.total_days}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium border ${statusBadgeClass}`}
                            >
                              {req.status === 'Approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              {req.status === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                              {req.status === 'Pending' && <Clock className="w-3 h-3 mr-1" />}
                              {req.status}
                            </span>
                            {req.status === 'Approved' && (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadIcsFile({
                                    title: `Out of Office - ${req.leave_type}`,
                                    startDate: req.start_date,
                                    endDate: req.end_date,
                                    description: req.reason,
                                    isHalfDay: req.is_half_day,
                                    halfDayPeriod: req.half_day_period,
                                    employeeName: user.full_name,
                                  })
                                }
                                title="Export to Calendar (.ics)"
                                className="p-1 text-slate-400 hover:text-[#3A5D83] hover:bg-slate-100 rounded-md transition-colors"
                              >
                                <Calendar className="w-3.5 h-3.5 text-[#3A5D83]" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate text-[12px]" title={req.admin_note || req.reason}>
                          {req.admin_note || req.reason || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Responsive Cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {recentRequests.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <CalendarCheck className="w-7 h-7 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No leave requests yet</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Click &ldquo;Request Leave&rdquo; above to apply.</p>
              </div>
            ) : (
              recentRequests.slice(0, 5).map((req) => {
                const statusBadgeClass =
                  req.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : req.status === 'Rejected'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200';

                return (
                  <div key={req.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{req.leave_type}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold border ${statusBadgeClass}`}>
                          {req.status === 'Approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {req.status === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                          {req.status === 'Pending' && <Clock className="w-3 h-3 mr-1" />}
                          {req.status}
                        </span>
                        {req.status === 'Approved' && (
                          <button
                            type="button"
                            onClick={() =>
                              downloadIcsFile({
                                title: `Out of Office - ${req.leave_type}`,
                                startDate: req.start_date,
                                endDate: req.end_date,
                                description: req.reason,
                                isHalfDay: req.is_half_day,
                                halfDayPeriod: req.half_day_period,
                                employeeName: user.full_name,
                              })
                            }
                            title="Export to Calendar (.ics)"
                            className="p-1 text-slate-400 hover:text-[#3A5D83] bg-slate-50 border border-slate-200 rounded-md transition-colors"
                          >
                            <Calendar className="w-3 h-3 text-[#3A5D83]" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="tabular-nums">
                        {req.start_date === req.end_date ? req.start_date : `${req.start_date} → ${req.end_date}`}
                      </span>
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {req.is_half_day ? '0.5 day' : `${req.total_days} ${req.total_days === 1 ? 'day' : 'days'}`}
                      </span>
                    </div>

                    {req.admin_note && <p className="go-hr-feedback"><strong>HR feedback:</strong> {req.admin_note}</p>}
                    {req.reason && (
                      <p className="text-[12px] text-slate-500 italic truncate">&ldquo;{req.reason}&rdquo;</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Upcoming Company Holidays Timeline */}
        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Upcoming Holidays — 2026
                  </h3>
                </div>
                <div className="flex items-center space-x-1 text-[12px] text-slate-500 mt-0.5">
                  <span>{getCountryFlag(user.country || DEFAULT_COUNTRY)}</span>
                  <span>{user.country || DEFAULT_COUNTRY} Calendar (2026)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('holidays')}
                className="text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] transition-colors"
              >
                All Holidays
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {upcomingHolidays.length === 0 ? (
                <div className="text-center py-7 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                  <CalendarX2 className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No More Upcoming Holidays</p>
                  <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                    There are no upcoming holidays remaining for 2026.
                  </p>
                </div>
              ) : (
                upcomingHolidays.map((holiday) => {
                  const { monthShort, day, weekday } = formatHolidayDate(holiday.date);

                  return (
                    <div
                      key={holiday.id}
                      className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <div className="bg-white border border-slate-200 rounded-lg p-1.5 text-center w-12 shrink-0 shadow-2xs">
                        <span className="block text-[12px] font-bold text-indigo-600 uppercase leading-none">
                          {monthShort}
                        </span>
                        <span className="block text-sm font-bold text-slate-900 leading-tight mt-0.5 tabular-nums">
                          {day}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <p className="text-xs font-semibold text-slate-900 truncate">{holiday.name}</p>
                          <span className="text-[12px] text-slate-400">({weekday})</span>
                        </div>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          {holiday.scope === 'Company-wide' ? (
                            <span className="text-[12px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-medium">
                              🌐 Company-wide
                            </span>
                          ) : (
                            <span className="text-[12px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                              {getCountryFlag(holiday.country || DEFAULT_COUNTRY)} {holiday.country || DEFAULT_COUNTRY}
                              {holiday.region && holiday.region !== 'All' ? ` (${holiday.region})` : ''}
                            </span>
                          )}
                        </div>
                        {holiday.description && (
                          <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-1">
                            {holiday.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[12px] text-slate-400 text-center">
            {user.country ? `${user.country} & Global Closures` : 'GO Destinations official closure calendar'}
          </div>
        </div>
      </div>

      {/* 5. Documents */}
      <div className="go-surface bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Employment Documents
                </h3>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  <Lock className="w-2.5 h-2.5 mr-1" /> My records
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Your contracts, ID documents, and reviews
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('documents')}
            className="text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] transition-colors flex items-center space-x-1"
          >
            <span>All Documents ({myDocuments.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {myDocuments.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
              <FileText className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-700">No documents on file yet</p>
              <p className="text-[12px] text-slate-400 mt-0.5">
                HR will add your documents here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {myDocuments.slice(0, 3).map((doc) => {
                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-all flex flex-col justify-between shadow-2xs"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="px-2 py-0.5 rounded text-[12px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {doc.category}
                          </span>
                          <span className="text-[12px] text-slate-400 font-mono">{doc.file_size}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-900 truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                        <p className="text-[12px] text-slate-400 mt-0.5 tabular-nums">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[12px] text-slate-400 truncate max-w-[120px]">
                        By {doc.uploaded_by_name || 'HR Admin'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(doc)}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Leave Request Modal */}
      <div className="go-workspace-links" aria-label="Your HR shortcuts">
        <button type="button" onClick={() => onNavigateTab('notifications')}><span className="go-shortcut-icon"><Clock className="w-5 h-5" /></span><span><strong>Stay up to date</strong><small>{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'View your latest HR updates'}</small></span><ArrowUpRight className="w-4 h-4" /></button>
        <button type="button" onClick={() => onNavigateTab('documents')}><span className="go-shortcut-icon"><FolderOpen className="w-5 h-5" /></span><span><strong>My documents</strong><small>Find and download your employment records</small></span><ArrowUpRight className="w-4 h-4" /></button>
        <button type="button" onClick={() => onNavigateTab('profile')}><span className="go-shortcut-icon"><ShieldCheck className="w-5 h-5" /></span><span><strong>My profile</strong><small>Review your personal and work details</small></span><ArrowUpRight className="w-4 h-4" /></button>
      </div>

      <LeaveRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadDashboardData();
        }}
        balances={balances}
      />

      {/* Holiday Shift Request Modal */}
      {isShiftModalOpen && (
        <HolidayShiftRequestModal
          holidays={upcomingHolidays}
          onClose={() => setIsShiftModalOpen(false)}
          onSuccess={() => {
            setIsShiftModalOpen(false);
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
};
