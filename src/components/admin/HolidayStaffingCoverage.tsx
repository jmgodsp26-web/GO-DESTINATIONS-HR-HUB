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
        aria-label="Holiday Coverage"
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
              'We couldn’t load holiday coverage. Please try again.'}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#3A5D83] hover:bg-[#182E3F] disabled:opacity-50 transition-colors shadow-2xs"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`}
            />
            <span>{isRetrying ? 'Retrying...' : 'Try again'}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      id="holiday-roster-coverage-overview-section"
      aria-label="Holiday Coverage"
      className="go-coverage bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
    >
      <div className="go-coverage-heading">
        <div>
          <span className="go-eyebrow">PLAN YOUR HOLIDAY TEAM</span>
          <h3>Holiday Coverage</h3>
          <p>See who is working, what needs attention, and which requests are waiting.</p>
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
              <span>Cards</span>
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
              <span>Table</span>
            </button>
          </div>

          {/* Schedule Shift Action (preserved functionality) */}
          {onOpenScheduleShift && (
            <button
              type="button"
              id="btn-quick-schedule-holiday-shift"
              onClick={() => onOpenScheduleShift()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#3A5D83] hover:bg-[#182E3F] text-white shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add shift</span>
            </button>
          )}
        </div>
      </div>

      {!isLoading && filtered2026List.length > 0 && (
        <div className="go-coverage-summary" aria-label="Holiday coverage summary">
          <div><span>Holidays</span><strong>{filtered2026List.length}</strong><small>In {selectedYear}</small></div>
          <div><span>Need attention</span><strong>{filtered2026List.filter(item => !(item.pcs_working_count >= item.pcs_required && item.coverage_status === 'Good')).length}</strong><small>Coverage or schedule to review</small></div>
          <div><span>Pending requests</span><strong>{filtered2026List.reduce((sum, item) => sum + item.total_pending_count, 0)}</strong><small>Leave and holiday shifts</small></div>
        </div>
      )}
      <p className="go-coverage-help"><ShieldCheck className="w-4 h-4" />Coordinator coverage shows scheduled Program Coordinators (PCs) compared with the number required.</p>
      {/* Main Content Area */}
      <div className="go-coverage-body p-5 sm:p-6">
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
              No holidays have been added for{' '}
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

                <div className="go-coverage-cards">
                  {group.items.map((item) => {
                    const { holiday, total_employees, working_count, leave_count, pending_leave_count, pcs_working_count, pcs_required, coverage_status, conflicts_count } = item;
                    const isPcCoverageMet = pcs_working_count >= pcs_required;
                    const isFullyCovered = isPcCoverageMet && coverage_status === 'Good';
                    const progress = pcs_required > 0 ? Math.min((pcs_working_count / pcs_required) * 100, 100) : 100;
                    const { monthShort, day } = formatHolidayDate(holiday.date);
                    return (
                      <article key={holiday.id} id={`holiday-coverage-card-${holiday.id}`} className={`go-coverage-card ${isFullyCovered ? 'is-covered' : 'needs-attention'}`}>
                        <div className="go-coverage-holiday">
                          <time dateTime={holiday.date}><span>{monthShort}</span><strong>{day}</strong></time>
                          <div><h4>{holiday.name}</h4><p>{getCountryFlag(holiday.country)} {holiday.country || 'Company-wide'}</p><span className={`go-coverage-status ${isFullyCovered ? 'is-covered' : 'needs-attention'}`}>{isFullyCovered ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{isFullyCovered ? 'Covered' : !isPcCoverageMet ? 'Needs PCs' : 'Needs review'}</span></div>
                        </div>
                        <div className="go-coverage-pcs">
                          <span>Coordinator coverage</span>
                          <p><strong>{pcs_working_count}</strong><span> / {pcs_required} needed</span></p>
                          <div role="progressbar" aria-label={`Coordinator coverage ${pcs_working_count} of ${pcs_required}`} aria-valuenow={pcs_working_count} aria-valuemin={0} aria-valuemax={Math.max(pcs_required, pcs_working_count)} className="go-coverage-track"><span style={{ width: `${progress}%` }} /></div>
                          <small>{isPcCoverageMet ? 'Coordinator requirement met' : `${Math.max(0, pcs_required - pcs_working_count)} more ${pcs_required - pcs_working_count === 1 ? 'PC' : 'PCs'} needed`}</small>
                        </div>
                        <dl className="go-coverage-people">
                          <div><dt>Working</dt><dd>{working_count}</dd></div><div><dt>On leave</dt><dd>{leave_count}</dd></div><div><dt>Leave pending</dt><dd>{pending_leave_count}</dd></div><div><dt>Total staff</dt><dd>{total_employees}</dd></div>
                        </dl>
                        <button type="button" aria-label={`View team for ${holiday.name}`} onClick={() => setSelectedHolidayId(holiday.id)} className="go-coverage-team">View team <ArrowRight className="w-4 h-4" /></button>
                        {conflicts_count > 0 && <p className="go-coverage-conflict"><AlertCircle className="w-4 h-4" />{conflicts_count} schedule {conflicts_count === 1 ? 'conflict' : 'conflicts'} to review</p>}
                      </article>
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
                        <th className="py-3 px-2 text-center">Leave pending</th>
                        <th className="py-3 px-4 min-w-[140px]">Coordinator coverage</th>
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
                                    : 'bg-[#ED9027]/10 text-[#ED9027] border-[#ED9027]/30'
                                }`}
                              >
                                {isFullyCovered
                                  ? '✓ Covered'
                                  : '⚠ Needs review'}
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
                            <td className="py-3 px-2 text-center font-bold text-[#ED9027]">
                              {pending_leave_count}
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-slate-500">
                                    {pcs_working_count} / {pcs_required} needed
                                  </span>
                                </div>
                                <div
                                  className={`w-full h-1.5 rounded-full overflow-hidden ${
                                    isFullyCovered
                                      ? 'bg-emerald-100'
                                      : 'bg-[#ED9027]/20'
                                  }`}
                                >
                                  <div
                                    className={`h-full rounded-full ${
                                      isFullyCovered
                                        ? 'bg-emerald-500'
                                        : 'bg-[#ED9027]'
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
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] hover:underline transition-colors"
                              >
                                <span>View team</span>
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
                                : 'bg-[#ED9027]/10 text-[#ED9027] border-[#ED9027]/30'
                            }`}
                          >
                            {isFullyCovered
                              ? '✓ Covered'
                              : '⚠ Needs review'}
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
                          <span className="text-[#ED9027]">
                            <strong>{pending_leave_count}</strong> Pending
                          </span>
                        </div>

                        {/* PC Progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Coordinator coverage</span>
                            <span>
                              {pcs_working_count} / {pcs_required} needed
                            </span>
                          </div>
                          <div
                            className={`w-full h-1.5 rounded-full overflow-hidden ${
                              isFullyCovered ? 'bg-emerald-100' : 'bg-[#ED9027]/20'
                            }`}
                          >
                            <div
                              className={`h-full rounded-full ${
                                isFullyCovered ? 'bg-emerald-500' : 'bg-[#ED9027]'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedHolidayId(holiday.id)}
                          className="w-full pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] transition-colors"
                        >
                          <span>View team</span>
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
