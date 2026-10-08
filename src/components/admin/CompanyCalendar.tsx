import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CalendarEvent } from '../../types';
import { api } from '../../services/api';
import { getTodayDateString } from '../../utils/countryUtils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  CalendarDays,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  RefreshCw,
  Sun,
  Sunset,
  Shield,
  Briefcase,
} from 'lucide-react';

export const CompanyCalendar: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [typeFilter, setTypeFilter] = useState<'all' | 'holiday' | 'approved_leave' | 'holiday_shift' | 'pending_leave'>('all');
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [selectedDayString, setSelectedDayString] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getCalendarEvents();
      setEvents(data);
    } catch (err: any) {
      if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
        console.error('Failed to load calendar events:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calendar Grid math
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Helper to format date as YYYY-MM-DD
  const formatDateStr = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Check if an event spans across date
  const isEventOnDate = (event: CalendarEvent, dateStr: string) => {
    if (event.end_date) {
      return dateStr >= event.date && dateStr <= event.end_date;
    }
    return event.date === dateStr;
  };

  const getEventsForDay = (dateStr: string) => {
    return events.filter((ev) => {
      if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
      return isEventOnDate(ev, dateStr);
    });
  };

  const handleDayClick = (dateStr: string) => {
    const dayEvs = getEventsForDay(dateStr);
    setSelectedDayString(dateStr);
    setSelectedDayEvents(dayEvs);
  };

  // Calendar cells
  const calendarCells = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateStr = formatDateStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, dayNum);
    calendarCells.push({
      day: dayNum,
      dateStr,
      isCurrentMonth: false,
      events: getEventsForDay(dateStr),
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = formatDateStr(year, month, i);
    calendarCells.push({
      day: i,
      dateStr,
      isCurrentMonth: true,
      events: getEventsForDay(dateStr),
    });
  }

  // Next month padding days
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const dateStr = formatDateStr(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, i);
    calendarCells.push({
      day: i,
      dateStr,
      isCurrentMonth: false,
      events: getEventsForDay(dateStr),
    });
  }

  return (
    <div className="go-calendar space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Company Calendar</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Plan around team availability, holiday coverage, and company holidays. Select a day to see its events.
        </p>
      </div>

      {/* Legend / Filter tags */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1 rounded-lg font-medium border transition-colors ${
            typeFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Events
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('approved_leave')}
          className={`px-3 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1.5 ${
            typeFilter === 'approved_leave'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Approved Leave (Full & Half Day)</span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('holiday_shift')}
          className={`px-3 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1.5 ${
            typeFilter === 'holiday_shift'
              ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
              : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100/60'
          }`}
        >
          <Briefcase className="w-3 h-3 text-teal-600" />
          <span>Holiday Shifts</span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('holiday')}
          className={`px-3 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1.5 ${
            typeFilter === 'holiday'
              ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100/60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span>Company Holidays</span>
        </button>

        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setTypeFilter('pending_leave')}
            className={`px-3 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1.5 ${
              typeFilter === 'pending_leave'
                ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Pending Approvals</span>
          </button>
        )}
      </div>

      {/* Calendar Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Month Navigation Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-bold text-slate-900">{monthName}</h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date(2026, 7, 1))}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-semibold text-slate-500 bg-slate-50 py-2">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Month Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[480px]">
          {calendarCells.map((cell, idx) => {
            const todayStr = getTodayDateString(user?.timezone);
            const isToday = cell.dateStr === todayStr;
            const isSelected = selectedDayString === cell.dateStr;

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(cell.dateStr)}
                className={`p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer min-h-[85px] ${
                  !cell.isCurrentMonth
                    ? 'bg-slate-50/40 text-slate-400'
                    : isSelected
                    ? 'bg-indigo-50/50 ring-1 ring-indigo-400'
                    : 'bg-white hover:bg-slate-50/60'
                }`}
              >
                {/* Date Number Badge */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium inline-block w-6 h-6 leading-6 text-center rounded-full ${
                      isToday
                        ? 'bg-indigo-600 text-white font-bold'
                        : cell.isCurrentMonth
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {cell.events.length > 2 && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      +{cell.events.length - 2}
                    </span>
                  )}
                </div>

                {/* Event Pills (max 2 visible on cell) */}
                <div className="space-y-1 overflow-hidden">
                  {cell.events.slice(0, 2).map((ev) => {
                    const isHalfDay = Boolean(ev.is_half_day);
                    const isShift = ev.type === 'holiday_shift';

                    const bgClass =
                      ev.type === 'holiday'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : isShift
                        ? 'bg-teal-100 text-teal-800 border-teal-200'
                        : isHalfDay
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : ev.type === 'approved_leave'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200';

                    return (
                      <div
                        key={ev.id}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate border flex items-center space-x-1 ${bgClass}`}
                        title={ev.title}
                      >
                        {isHalfDay && (
                          <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-200/80 px-1 rounded">
                            {ev.half_day_period === 'morning' ? 'AM' : 'PM'}
                          </span>
                        )}
                        {isShift && ev.is_pc && (
                          <span className="text-[9px] font-black uppercase text-teal-800 bg-teal-200/80 px-1 rounded">
                            PC
                          </span>
                        )}
                        <span className="truncate">{ev.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Panel */}
      {selectedDayString && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Schedule for {selectedDayString}
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {selectedDayEvents.length} event(s) scheduled
            </span>
          </div>

          {selectedDayEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No leave, working shifts, or company holidays scheduled on this day.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map((ev) => {
                const isHalfDay = Boolean(ev.is_half_day);
                const isShift = ev.type === 'holiday_shift';

                return (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                      ev.type === 'holiday'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                        : isShift
                        ? 'bg-teal-50 border-teal-200 text-teal-950'
                        : isHalfDay
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                        : ev.type === 'approved_leave'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <p className="font-bold">{ev.title}</p>
                        {isHalfDay && (
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-amber-200/90 text-amber-900 font-bold text-[10px] rounded">
                            {ev.half_day_period === 'morning' ? (
                              <Sun className="w-3 h-3 text-amber-700" />
                            ) : (
                              <Sunset className="w-3 h-3 text-amber-700" />
                            )}
                            <span>
                              {ev.half_day_period === 'morning' ? 'Morning 9AM–1PM' : 'Afternoon 1PM–5PM'}
                            </span>
                          </span>
                        )}
                        {isShift && ev.is_pc && (
                          <span className="px-1.5 py-0.5 bg-teal-200/90 text-teal-900 font-bold text-[10px] rounded">
                            Program Coordinator
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-80">
                        {ev.type === 'holiday'
                          ? ev.description || 'Official Company Holiday'
                          : isShift
                          ? `Working Shift • ${ev.working_hours || '9:00 AM – 5:00 PM'} • ${ev.employee_department || ev.department || ''}`
                          : `${ev.leave_type || 'Leave'} • ${ev.employee_department || ev.department || 'Staff'}`}
                      </p>
                    </div>

                    <span className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-white/70">
                      {ev.type === 'holiday'
                        ? 'Holiday'
                        : isShift
                        ? 'Shift Assigned'
                        : ev.type === 'approved_leave'
                        ? isHalfDay
                          ? 'Half-Day Leave'
                          : 'Approved Leave'
                        : 'Pending Review'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
