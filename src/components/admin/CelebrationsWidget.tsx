import React, { useState, useMemo } from 'react';
import { UserProfile, LeaveBalance } from '../../types';
import {
  Cake,
  Award,
  Sparkles,
  Mail,
  Calendar,
  Gift,
  PartyPopper,
  Clock,
  ChevronRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';

export interface CelebrationsWidgetProps {
  employees: (UserProfile & { leave_balances?: LeaveBalance[] })[];
  onNavigateTab?: (tab: string) => void;
  className?: string;
}

export type CelebrationType = 'birthday' | 'anniversary';

export interface CelebrationItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string;
  employeeAvatar: string;
  employeeJobTitle: string;
  type: CelebrationType;
  rawDate: string; // The original full date e.g. "1994-08-26" or "2023-08-28"
  nextOccurrenceDate: Date;
  nextOccurrenceStr: string; // "Aug 26"
  daysUntil: number; // 0 = today, 1 = tomorrow, etc.
  yearsCount?: number; // e.g. 2 for 2nd work anniversary or age for birthday
  milestoneTitle: string; // e.g. "3rd Work Anniversary", "Birthday (Turning 32)"
}

export const CelebrationsWidget: React.FC<CelebrationsWidgetProps> = ({
  employees,
  onNavigateTab,
  className = '',
}) => {
  const [filterType, setFilterType] = useState<'all' | 'birthday' | 'anniversary'>('all');
  const [daysRange, setDaysRange] = useState<number>(30); // 30, 60, 90, 365
  const [wishedEmployees, setWishedEmployees] = useState<Record<string, boolean>>({});

  // Compute upcoming celebration items
  const celebrations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    const items: CelebrationItem[] = [];

    employees.forEach((emp) => {
      // 1. Check Birthday
      const dobStr = emp.date_of_birth || emp.birthday;
      if (dobStr && dobStr.includes('-')) {
        const parts = dobStr.split('-');
        if (parts.length >= 3) {
          const birthYear = parseInt(parts[0], 10);
          const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
          const birthDay = parseInt(parts[2], 10);

          if (!isNaN(birthMonth) && !isNaN(birthDay)) {
            // Next occurrence this year
            let nextDob = new Date(currentYear, birthMonth, birthDay);
            nextDob.setHours(0, 0, 0, 0);

            // If it already passed this year, the next one is next year
            if (nextDob.getTime() < today.getTime()) {
              nextDob = new Date(currentYear + 1, birthMonth, birthDay);
            }

            const diffTime = nextDob.getTime() - today.getTime();
            const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));
            const calculatedAge = !isNaN(birthYear) ? nextDob.getFullYear() - birthYear : undefined;

            items.push({
              id: `${emp.id}-birthday`,
              employeeId: emp.id,
              employeeName: emp.full_name,
              employeeEmail: emp.email,
              employeeDepartment: emp.department,
              employeeAvatar: emp.avatar_url || '',
              employeeJobTitle: emp.job_title,
              type: 'birthday',
              rawDate: dobStr,
              nextOccurrenceDate: nextDob,
              nextOccurrenceStr: nextDob.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
              daysUntil,
              yearsCount: calculatedAge,
              milestoneTitle: calculatedAge
                ? `Birthday (Turning ${calculatedAge})`
                : 'Birthday Celebration',
            });
          }
        }
      }

      // 2. Check Work Anniversary
      const hireStr = emp.hire_date || emp.date_joined;
      if (hireStr && hireStr.includes('-')) {
        const parts = hireStr.split('-');
        if (parts.length >= 3) {
          const hireYear = parseInt(parts[0], 10);
          const hireMonth = parseInt(parts[1], 10) - 1; // 0-indexed
          const hireDay = parseInt(parts[2], 10);

          if (!isNaN(hireMonth) && !isNaN(hireDay) && !isNaN(hireYear)) {
            let nextHire = new Date(currentYear, hireMonth, hireDay);
            nextHire.setHours(0, 0, 0, 0);

            if (nextHire.getTime() < today.getTime()) {
              nextHire = new Date(currentYear + 1, hireMonth, hireDay);
            }

            const diffTime = nextHire.getTime() - today.getTime();
            const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));
            const completedYears = nextHire.getFullYear() - hireYear;

            // Only show anniversaries of at least 1 year (or future 1st anniversary)
            if (completedYears > 0) {
              const suffix =
                completedYears === 1
                  ? 'st'
                  : completedYears === 2
                  ? 'nd'
                  : completedYears === 3
                  ? 'rd'
                  : 'th';

              items.push({
                id: `${emp.id}-anniversary`,
                employeeId: emp.id,
                employeeName: emp.full_name,
                employeeEmail: emp.email,
                employeeDepartment: emp.department,
                employeeAvatar: emp.avatar_url || '',
                employeeJobTitle: emp.job_title,
                type: 'anniversary',
                rawDate: hireStr,
                nextOccurrenceDate: nextHire,
                nextOccurrenceStr: nextHire.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }),
                daysUntil,
                yearsCount: completedYears,
                milestoneTitle: `${completedYears}${suffix} Work Anniversary`,
              });
            }
          }
        }
      }
    });

    // Sort chronologically by days until next occurrence
    return items.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);

  // Filtered by type and days range
  const filteredCelebrations = useMemo(() => {
    return celebrations.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      return item.daysUntil <= daysRange;
    });
  }, [celebrations, filterType, daysRange]);

  // Today's celebrations
  const todayCelebrations = useMemo(() => {
    return celebrations.filter((item) => item.daysUntil === 0);
  }, [celebrations]);

  // Monthly stats
  const thisMonthStats = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const birthdaysThisMonth = celebrations.filter(
      (c) =>
        c.type === 'birthday' &&
        c.nextOccurrenceDate.getMonth() === currentMonth &&
        c.nextOccurrenceDate.getFullYear() === currentYear
    ).length;

    const anniversariesThisMonth = celebrations.filter(
      (c) =>
        c.type === 'anniversary' &&
        c.nextOccurrenceDate.getMonth() === currentMonth &&
        c.nextOccurrenceDate.getFullYear() === currentYear
    ).length;

    return { birthdaysThisMonth, anniversariesThisMonth };
  }, [celebrations]);

  const handleSendWish = (item: CelebrationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setWishedEmployees((prev) => ({ ...prev, [item.id]: true }));

    const subject =
      item.type === 'birthday'
        ? `Happy Birthday, ${item.employeeName.split(' ')[0]}! 🎂🎉`
        : `Happy ${item.milestoneTitle}, ${item.employeeName.split(' ')[0]}! 🏆🎖️`;

    const body =
      item.type === 'birthday'
        ? `Hi ${item.employeeName.split(' ')[0]},\n\nWishing you a wonderful birthday filled with joy and celebration! Thank you for everything you contribute to our team.\n\nBest regards,\nHR Team`
        : `Hi ${item.employeeName.split(' ')[0]},\n\nCongratulations on celebrating your ${item.milestoneTitle} with us! Thank you for your continued dedication, leadership, and impact on our team.\n\nBest regards,\nHR Team`;

    window.location.href = `mailto:${encodeURIComponent(item.employeeEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div
      id="admin-celebrations-widget"
      className={`bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1 bg-amber-100 text-amber-800 rounded-md">
              <PartyPopper className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              Upcoming Birthdays & Work Anniversaries
            </h2>
            {todayCelebrations.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                {todayCelebrations.length} Today! 🎉
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track employee milestones, recognize longevity, and share celebratory wishes across the team.
          </p>
        </div>

        {/* Quick Month Metrics */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-100 text-pink-700 font-medium flex items-center space-x-1 shadow-2xs">
            <Cake className="w-3.5 h-3.5 text-pink-500" />
            <span>{thisMonthStats.birthdaysThisMonth} Birthdays this mo.</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium flex items-center space-x-1 shadow-2xs">
            <Award className="w-3.5 h-3.5 text-indigo-500" />
            <span>{thisMonthStats.anniversariesThisMonth} Anniversaries</span>
          </span>
        </div>
      </div>

      {/* 2. Today's Highlight Spotlight Banner (if any celebration is today) */}
      {todayCelebrations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-indigo-500/10 border-b border-amber-200/60 p-4">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
            <span>Today's Milestone Spotlight</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {todayCelebrations.map((item) => (
              <div
                key={item.id}
                className="bg-white/95 backdrop-blur-xs border border-amber-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="relative shrink-0">
                    {item.employeeAvatar && item.employeeAvatar.trim() ? (
                      <img
                        src={item.employeeAvatar}
                        alt={item.employeeName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shadow-2xs"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs border-2 border-amber-400 shadow-2xs">
                        {item.employeeName?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'GO'}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 text-base">
                      {item.type === 'birthday' ? '🎂' : '🏆'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-900 text-xs truncate">
                        {item.employeeName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                        TODAY!
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-indigo-700 mt-0.5 truncate">
                      {item.milestoneTitle}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {item.employeeDepartment} • {item.employeeJobTitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id={`wish-btn-${item.id}`}
                  onClick={(e) => handleSendWish(item, e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-2xs flex items-center space-x-1.5 ${
                    wishedEmployees[item.id]
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white'
                  }`}
                >
                  {wishedEmployees[item.id] ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Wished!</span>
                    </>
                  ) : (
                    <>
                      <Gift className="w-3.5 h-3.5" />
                      <span>Send Wishes</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Controls & Filter Tabs */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            All Milestones ({celebrations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('birthday')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center space-x-1 ${
              filterType === 'birthday'
                ? 'bg-pink-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Cake className="w-3 h-3" />
            <span>
              Birthdays ({celebrations.filter((c) => c.type === 'birthday').length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('anniversary')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center space-x-1 ${
              filterType === 'anniversary'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Award className="w-3 h-3" />
            <span>
              Anniversaries ({celebrations.filter((c) => c.type === 'anniversary').length})
            </span>
          </button>
        </div>

        {/* Time Horizon Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Timeframe:</span>
          </span>
          <select
            value={daysRange}
            onChange={(e) => setDaysRange(parseInt(e.target.value, 10))}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            <option value={14}>Next 14 Days</option>
            <option value={30}>Next 30 Days</option>
            <option value={60}>Next 60 Days</option>
            <option value={90}>Next 90 Days</option>
            <option value={365}>Full Year</option>
          </select>
        </div>
      </div>

      {/* 4. Celebrations List */}
      <div className="divide-y divide-slate-100">
        {filteredCelebrations.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            <Cake className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No upcoming celebrations found</p>
            <p className="text-slate-400 mt-0.5">
              No employee birthdays or work anniversaries match the selected filter within the next {daysRange} days.
            </p>
          </div>
        ) : (
          filteredCelebrations.map((item) => {
            const isToday = item.daysUntil === 0;
            const isTomorrow = item.daysUntil === 1;
            const isWithinAWeek = item.daysUntil <= 7 && item.daysUntil > 1;

            return (
              <div
                key={item.id}
                className={`p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isToday
                    ? 'bg-amber-50/40 hover:bg-amber-50/70'
                    : 'hover:bg-slate-50/80'
                }`}
              >
                {/* Left Employee Info & Milestone Type */}
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="relative shrink-0">
                    {item.employeeAvatar && item.employeeAvatar.trim() ? (
                      <img
                        src={item.employeeAvatar}
                        alt={item.employeeName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#3A5D83]/10 text-[#3A5D83] flex items-center justify-center font-bold text-xs border border-[#3A5D83]/20">
                        {item.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 text-xs">
                      {item.type === 'birthday' ? '🎂' : '🎖️'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {item.employeeName}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({item.employeeDepartment})
                      </span>
                      {item.type === 'birthday' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-100 text-pink-800 border border-pink-200">
                          Birthday
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Work Anniversary
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-600 mt-1">
                      <span className="font-semibold text-slate-900">
                        {item.milestoneTitle}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 text-[11px]">
                        {item.type === 'birthday'
                          ? `Born on ${item.rawDate}`
                          : `Hired on ${item.rawDate}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Date Badge & Quick Action */}
                <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                  {/* Countdown Badge */}
                  <div className="text-right">
                    <div className="flex items-center space-x-1.5 justify-end">
                      <span className="text-xs font-bold text-slate-900">
                        {item.nextOccurrenceStr}
                      </span>
                      {isToday ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                          Today! 🎉
                        </span>
                      ) : isTomorrow ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                          Tomorrow
                        </span>
                      ) : isWithinAWeek ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                          In {item.daysUntil} days
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          In {item.daysUntil} days
                        </span>
                      )}
                    </div>
                    <span className="block text-[10px] text-slate-400">
                      {item.employeeJobTitle}
                    </span>
                  </div>

                  {/* Send Wish Mail Button */}
                  <button
                    type="button"
                    onClick={(e) => handleSendWish(item, e)}
                    title={`Send celebration wish to ${item.employeeName}`}
                    className={`p-2 rounded-lg text-xs font-semibold transition-colors shadow-2xs border ${
                      wishedEmployees[item.id]
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                    }`}
                  >
                    {wishedEmployees[item.id] ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Footer Summary & Navigation */}
      {onNavigateTab && (
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Showing milestones based on employee records and join history.
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab('employees')}
            className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>Manage Employee Records</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
