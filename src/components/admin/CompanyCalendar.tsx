import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  RefreshCw,
  Briefcase,
  Clock,
  Sun,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import type { CalendarEvent } from "../../types";
import { api } from "../../services/api";
import { getTodayDateString } from "../../utils/countryUtils";
import {
  eventsOnDate,
  filterCalendarEvents,
  monthDates,
  moveCalendarMonth,
} from "../../utils/calendar";

type EventType = CalendarEvent["type"];
const eventTypes: EventType[] = [
  "approved_leave",
  "holiday",
  "holiday_shift",
  "pending_leave",
];
const categories = {
  approved_leave: {
    label: "Leave",
    icon: Users,
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  holiday: {
    label: "Holidays",
    icon: Sun,
    color: "bg-[#EDF2F8] text-[#3A5D83] border-[#CBD8E6]",
  },
  holiday_shift: {
    label: "Holiday Coverage",
    icon: Briefcase,
    color: "bg-teal-50 text-teal-800 border-teal-200",
  },
  pending_leave: {
    label: "Pending Leave",
    icon: Clock,
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
};
const prettyDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  },
) => new Date(date + "T12:00:00").toLocaleDateString("en-US", options);
const eventKey = (event: CalendarEvent) => `${event.type}:${event.id}`;

export const CompanyCalendar: React.FC = () => {
  const { user } = useAuth();
  const { isAdministration } = useWorkspace();
  const today = getTodayDateString(user?.timezone);
  const [direction, setDirection] = useState("next");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [types, setTypes] = useState<EventType[]>(eventTypes);
  const [department, setDepartment] = useState("all");
  const [view, setView] = useState<"month" | "list">("month");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const detailsRef = useRef<HTMLElement>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEvents(await api.getCalendarEvents(!isAdministration));
    } catch (err: any) {
      setError(
        err?.message || "Unable to load the calendar. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAdministration]);
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filtered = useMemo(
    () => filterCalendarEvents(events, types, department),
    [events, types, department],
  );
  const departments = useMemo(
    () =>
      [
        ...new Set(
          events
            .map((event) => event.employee_department || event.department)
            .filter(Boolean),
        ),
      ].sort() as string[],
    [events],
  );
  const dates = monthDates(month);
  const dayEvents = eventsOnDate(filtered, selectedDate);
  const selectedEvent = dayEvents.find(
    (event) => eventKey(event) === selectedEventKey,
  );
  const agenda = dates
    .map((date) => ({ date, events: eventsOnDate(filtered, date) }))
    .filter((day) => day.events.length);
  const firstDay = new Date(month + "-01T12:00:00").getDay();
  const cellCount = Math.ceil((firstDay + dates.length) / 7) * 7;
  const selectDay = (date: string, event?: CalendarEvent) => {
    setSelectedDate(date);
    setSelectedEventKey(event ? eventKey(event) : null);
    if (window.matchMedia("(max-width: 1023px)").matches)
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };
  const changeMonth = (next: string) => {
    setDirection(next < month ? "previous" : "next");
    setMonth(next);
    setSelectedDate(next + "-01");
    setSelectedEventKey(null);
  };
  const toggleType = (type: EventType) =>
    setTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type],
    );
  const resetFilters = () => {
    setTypes(eventTypes);
    setDepartment("all");
    setSelectedEventKey(null);
  };
  const renderEventButton = (
    event: CalendarEvent,
    date: string,
    compact = false,
  ) => {
    const category = categories[event.type];
    const Icon = category.icon;
    return (
      <button
        key={eventKey(event)}
        type="button"
        onClick={() => selectDay(date, event)}
        aria-label={`View ${event.title} on ${prettyDate(date)}`}
        className={`w-full rounded-lg border text-left transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3A5D83] ${category.color} ${compact ? "px-1.5 py-1 text-[12px]" : "p-3 text-xs"} ${selectedDate === date && selectedEventKey === eventKey(event) ? "ring-2 ring-[#3A5D83] ring-offset-1" : ""}`}
      >
        <span className="flex items-start gap-1.5">
          <Icon
            aria-hidden="true"
            className={`shrink-0 ${compact ? "w-3 h-3" : "w-4 h-4"}`}
          />
          <span
            className={compact ? "truncate font-semibold" : "font-semibold"}
          >
            {event.title}
          </span>
        </span>
        {!compact && (
          <span className="block mt-1 text-[12px]">
            {category.label}
            {event.is_half_day
              ? ` · Half day (${event.half_day_period === "morning" ? "AM" : "PM"})`
              : ""}
            {event.employee_department || event.department
              ? ` · ${event.employee_department || event.department}`
              : ""}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="go-calendar space-y-5" data-direction={direction}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Company Calendar</h1>
          <p className="text-xs text-slate-500 mt-1">
            See who’s away, company holidays, and holiday coverage.
          </p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw
            aria-hidden="true"
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}{" "}
          <button
            type="button"
            className="underline font-semibold px-2"
            onClick={loadEvents}
          >
            Try again
          </button>
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1">Show</span>
        {eventTypes.map((type) => {
          const category = categories[type];
          const Icon = category.icon;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={types.includes(type)}
              onClick={() => toggleType(type)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${types.includes(type) ? category.color : "bg-white text-slate-400 border-slate-200"}`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {category.label}
            </button>
          );
        })}
        <select
          aria-label="Filter calendar by department"
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setSelectedEventKey(null);
          }}
          className="min-h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 sm:ml-auto"
        >
          <option value="all">All departments</option>
          {departments.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {(types.length !== eventTypes.length || department !== "all") && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-[#3A5D83] px-2"
          >
            Reset
          </button>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <section
          aria-label="Calendar"
          aria-busy={loading}
          className="min-w-0 rounded-2xl border border-slate-200 bg-white overflow-hidden"
        >
          <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => changeMonth(moveCalendarMonth(month, -1))}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm sm:text-base font-bold text-[#182E3F] min-w-[130px] text-center">
                {prettyDate(month + "-01", { month: "long", year: "numeric" })}
              </h2>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => changeMonth(moveCalendarMonth(month, 1))}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMonth(today.slice(0, 7));
                  selectDay(today);
                }}
                className="px-3 text-xs font-semibold rounded-lg border border-slate-200"
              >
                Today
              </button>
              <input
                type="month"
                aria-label="Go to month"
                value={month}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value))
                    changeMonth(e.target.value);
                }}
                className="min-h-10 w-[145px] rounded-lg border border-slate-200 px-2 text-xs"
              />
              <div
                role="group"
                aria-label="Calendar view"
                className="flex rounded-lg bg-slate-100 p-1"
              >
                <button
                  type="button"
                  aria-pressed={view === "month"}
                  onClick={() => setView("month")}
                  className={`flex items-center gap-1 rounded-md px-2 text-xs font-semibold ${view === "month" ? "bg-white shadow-sm text-[#182E3F]" : "text-slate-500"}`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Month
                </button>
                <button
                  type="button"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className={`flex items-center gap-1 rounded-md px-2 text-xs font-semibold ${view === "list" ? "bg-white shadow-sm text-[#182E3F]" : "text-slate-500"}`}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
              </div>
            </div>
          </div>
          {loading && (
            <p role="status" className="px-4 py-2 text-xs text-slate-500">
              Updating calendar…
            </p>
          )}
          <div className={view === "month" ? "hidden sm:block" : "hidden"}>
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-[12px] font-semibold text-slate-500 py-3">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div key={month} className="go-calendar-month grid grid-cols-7">
              {Array.from({ length: cellCount }, (_, index) => {
                const date = dates[index - firstDay];
                if (!date)
                  return (
                    <div
                      key={index}
                      aria-hidden="true"
                      className="bg-slate-50/60 border-r border-b border-slate-100"
                    />
                  );
                const schedule = eventsOnDate(filtered, date);
                return (
                  <div
                    key={date}
                    className={`min-w-0 min-h-[120px] p-1.5 border-r border-b border-slate-100 ${selectedDate === date ? "bg-[#EDF2F8]" : "bg-white"}`}
                  >
                    <button
                      type="button"
                      aria-pressed={selectedDate === date}
                      aria-current={date === today ? "date" : undefined}
                      aria-label={`${prettyDate(date)}, ${schedule.length} events`}
                      onClick={() => selectDay(date)}
                      className={`w-full mb-1 rounded-lg text-left px-2 text-xs font-semibold ${date === today ? "bg-[#3A5D83] text-white" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      {Number(date.slice(-2))}
                      <span className="float-right text-[12px] font-normal">
                        {schedule.length || ""}
                      </span>
                    </button>
                    <div className="space-y-1">
                      {schedule
                        .slice(0, 2)
                        .map((event) => renderEventButton(event, date, true))}
                      {schedule.length > 2 && (
                        <button
                          type="button"
                          onClick={() => selectDay(date)}
                          aria-label={`View all ${schedule.length} events on ${prettyDate(date)}`}
                          className="w-full px-1 text-left text-[12px] font-semibold text-[#3A5D83]"
                        >
                          +{schedule.length - 2} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className={
              view === "list" ? "p-4 space-y-5" : "sm:hidden p-4 space-y-5"
            }
          >
            <p className="text-xs text-slate-500">
              {view === "month" ? "Daily list on mobile · " : ""}
              {agenda.length} days with events this month
            </p>
            {!loading && agenda.length === 0 && (
              <div className="py-10 text-center">
                <CalendarDays className="w-8 h-8 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  No events to show
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Try another month or reset your filters.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-xs font-semibold text-[#3A5D83]"
                >
                  Reset filters
                </button>
              </div>
            )}
            {agenda.map((day) => (
              <div key={day.date}>
                <button
                  type="button"
                  onClick={() => selectDay(day.date)}
                  className={`mb-2 text-xs font-bold ${day.date === today ? "text-[#3A5D83]" : "text-slate-700"}`}
                >
                  {prettyDate(day.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {day.date === today ? " · Today" : ""}
                </button>
                <div className="space-y-2">
                  {day.events.map((event) =>
                    renderEventButton(event, day.date),
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          ref={detailsRef}
          aria-label="Selected day details"
          className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white overflow-hidden lg:sticky lg:top-4"
        >
          <div className="p-5 bg-[#182E3F] text-white">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-300">
              Day overview
            </p>
            <h3 className="mt-2 text-lg font-bold">
              {prettyDate(selectedDate, { weekday: "long" })}
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {prettyDate(selectedDate)} · {dayEvents.length}{" "}
              {dayEvents.length === 1 ? "event" : "events"}
            </p>
          </div>
          <div key={`${selectedDate}:${selectedEventKey || "day"}`} className="go-calendar-detail-content p-4 space-y-3" aria-live="polite">
            {selectedEvent ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedEventKey(null)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#3A5D83]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  All events for this day
                </button>
                <div
                  className={`rounded-xl border p-4 ${categories[selectedEvent.type].color}`}
                >
                  <span className="text-[12px] font-semibold uppercase">
                    {categories[selectedEvent.type].label}
                  </span>
                  <h4 className="font-bold text-sm mt-2 break-words">
                    {selectedEvent.title}
                  </h4>
                  <dl className="text-xs mt-4 space-y-3">
                    <div>
                      <dt className="font-semibold">Dates</dt>
                      <dd className="mt-0.5">
                        {prettyDate(selectedEvent.date)}
                        {selectedEvent.end_date &&
                        selectedEvent.end_date !== selectedEvent.date
                          ? ` – ${prettyDate(selectedEvent.end_date)}`
                          : ""}
                      </dd>
                    </div>
                    {(selectedEvent.employee_department ||
                      selectedEvent.department) && (
                      <div>
                        <dt className="font-semibold">Department</dt>
                        <dd>
                          {selectedEvent.employee_department ||
                            selectedEvent.department}
                        </dd>
                      </div>
                    )}
                    {selectedEvent.is_half_day && (
                      <div>
                        <dt className="font-semibold">Duration</dt>
                        <dd>
                          Half day ·{" "}
                          {selectedEvent.half_day_period === "morning"
                            ? "Morning"
                            : "Afternoon"}
                        </dd>
                      </div>
                    )}
                    {selectedEvent.working_hours && (
                      <div>
                        <dt className="font-semibold">Working hours</dt>
                        <dd>{selectedEvent.working_hours}</dd>
                      </div>
                    )}
                    {selectedEvent.is_pc && (
                      <div>
                        <dt className="font-semibold">Coverage role</dt>
                        <dd>Program Coordinator</dd>
                      </div>
                    )}
                    {selectedEvent.status && (
                      <div>
                        <dt className="font-semibold">Status</dt>
                        <dd>{selectedEvent.status}</dd>
                      </div>
                    )}
                    {selectedEvent.type === "holiday" &&
                      selectedEvent.description && (
                        <div>
                          <dt className="font-semibold">About this holiday</dt>
                          <dd className="whitespace-pre-wrap break-words">
                            {selectedEvent.description}
                          </dd>
                        </div>
                      )}
                  </dl>
                </div>
              </>
            ) : (
              <>
                {!loading && dayEvents.length === 0 && (
                  <div className="text-center py-7">
                    <CalendarDays className="w-7 h-7 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-700">
                      No events for this day
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Select another date or change your filters.
                    </p>
                  </div>
                )}
                {dayEvents.map((event) =>
                  renderEventButton(event, selectedDate),
                )}
                {dayEvents.length > 0 && (
                  <p className="text-[12px] text-slate-500 pt-1">
                    Select an event to see the details.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
