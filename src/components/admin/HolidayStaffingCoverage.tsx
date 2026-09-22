import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Users,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Plus,
  AlertCircle,
  LayoutGrid,
  List,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { HolidayStaffingCoverage, UserProfile } from '../../types';
import { HolidayDetailModal } from './HolidayDetailModal';
import { formatHolidayDate, getCountryFlag } from '../../utils/countryUtils';

interface HolidayStaffingCoverageWidgetProps {
  coverageList: HolidayStaffingCoverage[];
  allEmployees: (UserProfile & { is_pc?: boolean })[];
  onRefresh: () => void;
  onOpenScheduleShift?: (holidayId?: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export const HolidayStaffingCoverageWidget: React.FC<
  HolidayStaffingCoverageWidgetProps
> = ({
  coverageList,
  allEmployees,
  onRefresh,
  onOpenScheduleShift,
  isLoading = false,
  error = null,
}) => {
  const [selectedHolidayId, setSelectedHolidayId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // 1. 2026 DATE FILTER - Strictly calendar year 2026 (Jan 1, 2026 - Dec 31, 2026)
  const filtered2026List = useMemo(() => {
    if (!coverageList || !Array.isArray(coverageList)) return [];

    return coverageList
      .filter((item) => {
        if (!item || !item.holiday) return false;
        if (item.holiday.is_active === false) return false;

        const dateStr = item.holiday.date;
        if (!dateStr || typeof dateStr !== 'string') return false;

        // Strictly 2026 calendar year boundary: 2026-01-01 to 2026-12-31
        // Excludes 2027, 2028+, past years, and any invalid dates
        if (selectedYear === '2026') {
          return dateStr >= '2026-01-01' && dateStr <= '2026-12-31';
        }

        // If local year selector is set to another year
        return dateStr.startsWith(`${selectedYear}-`);
      })
      .sort((a, b) => a.holiday.date.localeCompare(b.holiday.date));
  }, [coverageList, selectedYear]);

  // 3. MONTH GROUPING - Group the filtered 2026 holidays by month
  const groupedByMonth = useMemo(() => {
    const groups: {
      monthKey: string;
      monthTitle: string;
      items: HolidayStaffingCoverage[];
    }[] = [];
    const map = new Map<
      string,
      { monthTitle: string; items: HolidayStaffingCoverage[] }
    >();

    filtered2026List.forEach((item) => {
      const { monthName, year } = formatHolidayDate(item.holiday.date, {
        showYear: true,
      });
      const monthPart = item.holiday.date.split('-')[1];
      const key = `${year}-${monthPart}`;
      const title = `${monthName} ${year}`;

      if (!map.has(key)) {
        const group = {
          monthTitle: title,
          items: [] as HolidayStaffingCoverage[],
        };
        map.set(key, group);
        groups.push({ monthKey: key, monthTitle: title, items: group.items });
      }
      map.get(key)!.items.push(item);
    });

    return groups;
  }, [filtered2026List]);

  const selectedCoverage = coverageList?.find(
    (c) => c.holiday?.id === selectedHolidayId
  );

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRefresh();
    } finally {
      setIsRetrying(false);
    }
  };

  // 15. ERROR STATE
  if (error) {
    return (
      <section
        id="holiday-roster-coverage-overview-section"
        aria-label="Holiday & Roster Coverage Overview"
        className="bg-white rounded-xl border border-rose-200 shadow-xs p-6"
      >
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="p-3 rounded-full bg-rose-50 text-rose-600 mb-3 border border-rose-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Unable to load holiday coverage
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            {error ||
              'A problem occurred while retrieving holiday rosters and staffing requirements. Please try again.'}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#3A5D83] hover:bg-[#2F4D6D] disabled:opacity-50 transition-colors shadow-2xs"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`}
            />
            <span>{isRetrying ? 'Retrying...' : 'Retry Loading'}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      id="holiday-roster-coverage-overview-section"
      aria-label="Holiday & Roster Coverage Overview"
      className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
    >
      {/* 2. SECTION HEADER */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className="w-2.5 h-2.5 rounded-full bg-[#3A5D83] shrink-0"
              aria-hidden="true"
            />
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Holiday &amp; Roster Coverage Overview
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#3A5D83]/10 text-[#3A5D83] border border-[#3A5D83]/30">
              2026 Calendar
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise coverage breakdown, real-time working roster, and Program
            Coordinator (PC) requirements
          </p>
        </div>

        {/* Compact Right Controls Area */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Year Selector */}
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700">
            <span className="text-[11px] font-medium text-slate-400">Year:</span>
            <select
              id="holiday-coverage-year-selector"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
              aria-label="Select holiday year"
            >
              <option value="2026">2026</option>
            </select>
          </div>

          {/* View Toggle: Grid | List */}
          <div
            role="radiogroup"
            aria-label="View mode segmented control"
            className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              id="view-toggle-grid"
              role="radio"
              aria-checked={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              id="view-toggle-list"
              role="radio"
              aria-checked={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Schedule Shift Action (preserved functionality) */}
          {onOpenScheduleShift && (
            <button
              type="button"
              id="btn-quick-schedule-holiday-shift"
              onClick={() => onOpenScheduleShift()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#3A5D83] hover:bg-[#2F4D6D] text-white shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 sm:p-6">
        {/* 13. LOADING SKELETON STATE */}
        {isLoading || coverageList === undefined ? (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            aria-busy="true"
            aria-label="Loading holiday coverage"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 animate-pulse shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                  </div>
                  <div className="h-5 w-24 bg-slate-200 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-10 bg-slate-100 rounded-lg" />
                  <div className="h-10 bg-slate-100 rounded-lg" />
                  <div className="h-10 bg-slate-100 rounded-lg" />
                  <div className="h-10 bg-slate-100 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-32 bg-slate-200 rounded" />
                  <div className="h-2 w-full bg-slate-200 rounded-full" />
                </div>
                <div className="h-4 w-36 bg-slate-200 rounded pt-2" />
              </div>
            ))}
          </div>
        ) : filtered2026List.length === 0 ? (
          /* 14. EMPTY STATE */
          <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              No holidays found
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no scheduled company or statutory holidays recorded for{' '}
              {selectedYear}.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* 10. GRID VIEW */
          <div className="space-y-6">
            {groupedByMonth.map((group) => (
              <div key={group.monthKey}>
                {/* 3. Month Separator / Heading */}
                <div className="flex items-center space-x-3 mb-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {group.monthTitle}
                  </span>
                  <div className="h-px bg-slate-200/80 flex-1" />
                  <span className="text-[11px] font-semibold text-slate-400">
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'holiday' : 'holidays'}
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((item) => {
                    const {
                      holiday,
                      total_employees,
                      working_count,
                      leave_count,
                      pending_leave_count,
                      pcs_working_count,
                      pcs_required,
                      coverage_status,
                      conflicts_count,
                    } = item;

                    // 6 & 8. Coverage calculations
                    const isPcCoverageMet = pcs_working_count >= pcs_required;
                    const isFullyCovered =
                      isPcCoverageMet && coverage_status === 'Good';

                    const progress =
                      pcs_required > 0
                        ? Math.min(
                            (pcs_working_count / pcs_required) * 100,
                            100
                          )
                        : 100;

                    // 5. Date formatting: "SEP 30, 2026"
                    const { monthShort, day, year } = formatHolidayDate(
                      holiday.date,
                      { showYear: true }
                    );
                    const formattedDate = `${monthShort.toUpperCase()} ${day}, ${year}`;
                    const flag = getCountryFlag(holiday.country);

                    return (
                      <div
                        key={holiday.id}
                        id={`holiday-coverage-card-${holiday.id}`}
                        className={`rounded-xl border bg-white shadow-xs hover:shadow-md transition duration-200 p-4 sm:p-5 flex flex-col justify-between ${
                          !isFullyCovered
                            ? 'border-amber-200/90'
                            : 'border-slate-200'
                        }`}
                      >
                        <div>
                          {/* 5. Date & Holiday Name */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                {formattedDate}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2">
                                {holiday.name}
                              </h4>
                              <div className="flex items-center space-x-1.5 mt-1 text-[11px] text-slate-500">
                                <span>{flag}</span>
                                <span className="truncate">
                                  {holiday.country || 'Company-wide'}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="truncate">
                                  {holiday.holiday_type || 'Public Holiday'}
                                </span>
                              </div>
                            </div>

                            {/* 6. Coverage Status Badge */}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 border ${
                                isFullyCovered
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-[#ED8F2B]/10 text-[#ED8F2B] border-[#ED8F2B]/30'
                              }`}
                            >
                              {isFullyCovered ? (
                                <span>✓ Fully Covered</span>
                              ) : (
                                <span>⚠ PC Coverage Needed</span>
                              )}
                            </span>
                          </div>

                          {/* Scheduling Conflicts (if any) */}
                          {conflicts_count > 0 && (
                            <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-center space-x-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                              <span>
                                {conflicts_count} Scheduling{' '}
                                {conflicts_count === 1 ? 'Conflict' : 'Conflicts'}
                              </span>
                            </div>
                          )}

                          {/* 7. Metrics Breakdown: Compact Mini-Stat Element */}
                          <div className="grid grid-cols-2 gap-1.5 my-3">
                            <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-500">
                                Total
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {total_employees}
                              </span>
                            </div>
                            <div className="bg-emerald-50/60 rounded-lg px-2.5 py-1.5 border border-emerald-100/70 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-emerald-700">
                                Working
                              </span>
                              <span className="text-xs font-bold text-emerald-800">
                                {working_count}
                              </span>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-500">
                                On Leave
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {leave_count}
                              </span>
                            </div>
                            <div className="bg-[#ED8F2B]/10 rounded-lg px-2.5 py-1.5 border border-[#ED8F2B]/20 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-[#ED8F2B]">
                                Pending
                              </span>
                              <span className="text-xs font-bold text-[#ED8F2B]">
                                {pending_leave_count}
                              </span>
                            </div>
                          </div>

                          {/* 8. PC Coverage Visual Progress Bar */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                <span>PC Coverage</span>
                              </span>
                              <span className="text-[11px] font-medium text-slate-500">
                                <strong
                                  className={
                                    isFullyCovered
                                      ? 'text-emerald-700'
                                      : 'text-[#ED8F2B]'
                                  }
                                >
                                  {pcs_working_count}
                                </strong>{' '}
                                / {pcs_required} required
                              </span>
                            </div>
                            <div
                              className={`w-full h-2 rounded-full overflow-hidden ${
                                isFullyCovered ? 'bg-emerald-100' : 'bg-[#ED8F2B]/20'
                              }`}
                              role="progressbar"
                              aria-valuenow={pcs_working_count}
                              aria-valuemin={0}
                              aria-valuemax={pcs_required}
                              aria-label={`PC Coverage ${pcs_working_count} of ${pcs_required}`}
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isFullyCovered
                                    ? 'bg-emerald-500'
                                    : 'bg-[#ED8F2B]'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 9. Primary Action: View Roster & Approvals */}
                        <button
                          type="button"
                          onClick={() => setSelectedHolidayId(holiday.id)}
                          className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-medium text-[#3A5D83] hover:text-[#2F4D6D] hover:underline transition group/btn text-left"
                        >
                          <span>View Roster &amp; Approvals</span>
                          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 11. LIST VIEW */
          <div className="space-y-6">
            {groupedByMonth.map((group) => (
              <div key={group.monthKey}>
                {/* Month Separator */}
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {group.monthTitle}
                  </span>
                  <div className="h-px bg-slate-200/80 flex-1" />
                  <span className="text-[11px] font-semibold text-slate-400">
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'holiday' : 'holidays'}
                  </span>
                </div>

                {/* Responsive Desktop Table */}
                <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Holiday</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-2 text-center">Total</th>
                        <th className="py-3 px-2 text-center">Working</th>
                        <th className="py-3 px-2 text-center">On Leave</th>
                        <th className="py-3 px-2 text-center">Pending</th>
                        <th className="py-3 px-4 min-w-[140px]">PC Coverage</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const {
                          holiday,
                          total_employees,
                          working_count,
                          leave_count,
                          pending_leave_count,
                          pcs_working_count,
                          pcs_required,
                          coverage_status,
                        } = item;

                        const isPcCoverageMet =
                          pcs_working_count >= pcs_required;
                        const isFullyCovered =
                          isPcCoverageMet && coverage_status === 'Good';

                        const progress =
                          pcs_required > 0
                            ? Math.min(
                                (pcs_working_count / pcs_required) * 100,
                                100
                              )
                            : 100;

                        const { monthShort, day, year } = formatHolidayDate(
                          holiday.date,
                          { showYear: true }
                        );
                        const formattedDate = `${monthShort.toUpperCase()} ${day}, ${year}`;
                        const flag = getCountryFlag(holiday.country);

                        return (
                          <tr
                            key={holiday.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">
                              {formattedDate}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">
                                {holiday.name}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                                <span>{flag}</span>
                                <span>{holiday.country || 'Company-wide'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                  isFullyCovered
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-[#ED8F2B]/10 text-[#ED8F2B] border-[#ED8F2B]/30'
                                }`}
                              >
                                {isFullyCovered
                                  ? '✓ Fully Covered'
                                  : '⚠ PC Coverage Needed'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-slate-900">
                              {total_employees}
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-emerald-700">
                              {working_count}
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-slate-700">
                              {leave_count}
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-[#ED8F2B]">
                              {pending_leave_count}
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-slate-500">
                                    {pcs_working_count} / {pcs_required} req
                                  </span>
                                </div>
                                <div
                                  className={`w-full h-1.5 rounded-full overflow-hidden ${
                                    isFullyCovered
                                      ? 'bg-emerald-100'
                                      : 'bg-[#ED8F2B]/20'
                                  }`}
                                >
                                  <div
                                    className={`h-full rounded-full ${
                                      isFullyCovered
                                        ? 'bg-emerald-500'
                                        : 'bg-[#ED8F2B]'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedHolidayId(holiday.id)}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-[#3A5D83] hover:text-[#2F4D6D] hover:underline transition-colors"
                              >
                                <span>View Roster</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Fallback for List View (Stacked Cards to prevent horizontal break) */}
                <div className="md:hidden space-y-3">
                  {group.items.map((item) => {
                    const {
                      holiday,
                      total_employees,
                      working_count,
                      leave_count,
                      pending_leave_count,
                      pcs_working_count,
                      pcs_required,
                      coverage_status,
                    } = item;

                    const isPcCoverageMet = pcs_working_count >= pcs_required;
                    const isFullyCovered =
                      isPcCoverageMet && coverage_status === 'Good';

                    const progress =
                      pcs_required > 0
                        ? Math.min(
                            (pcs_working_count / pcs_required) * 100,
                            100
                          )
                        : 100;

                    const { monthShort, day, year } = formatHolidayDate(
                      holiday.date,
                      { showYear: true }
                    );
                    const formattedDate = `${monthShort.toUpperCase()} ${day}, ${year}`;

                    return (
                      <div
                        key={holiday.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {formattedDate}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900">
                              {holiday.name}
                            </h4>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                              isFullyCovered
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-[#ED8F2B]/10 text-[#ED8F2B] border-[#ED8F2B]/30'
                            }`}
                          >
                            {isFullyCovered
                              ? '✓ Fully Covered'
                              : '⚠ PC Coverage Needed'}
                          </span>
                        </div>

                        {/* Mobile Metrics Strip */}
                        <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-slate-600">
                            <strong>{total_employees}</strong> Total
                          </span>
                          <span className="text-emerald-700">
                            <strong>{working_count}</strong> Working
                          </span>
                          <span className="text-slate-700">
                            <strong>{leave_count}</strong> Leave
                          </span>
                          <span className="text-[#ED8F2B]">
                            <strong>{pending_leave_count}</strong> Pending
                          </span>
                        </div>

                        {/* PC Progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>PC Coverage</span>
                            <span>
                              {pcs_working_count} / {pcs_required} req
                            </span>
                          </div>
                          <div
                            className={`w-full h-1.5 rounded-full overflow-hidden ${
                              isFullyCovered ? 'bg-emerald-100' : 'bg-[#ED8F2B]/20'
                            }`}
                          >
                            <div
                              className={`h-full rounded-full ${
                                isFullyCovered ? 'bg-emerald-500' : 'bg-[#ED8F2B]'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedHolidayId(holiday.id)}
                          className="w-full pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#3A5D83] hover:text-[#2F4D6D] transition-colors"
                        >
                          <span>View Roster &amp; Approvals</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Holiday Detail Modal (Preserved existing interaction) */}
      {selectedCoverage && (
        <HolidayDetailModal
          coverage={selectedCoverage}
          allEmployees={allEmployees}
          onClose={() => setSelectedHolidayId(null)}
          onRefresh={() => {
            onRefresh();
          }}
        />
      )}
    </section>
  );
};
