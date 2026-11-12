import { isPaidLeaveType, type LeaveBalance, type LeaveRequest } from '../types';

/** Pure display helpers for the GO brand interface. No dates are invented: every value comes from the caller. */

/** Evening and night hours show a moon beside the greeting. */
export function isNightHour(hour: number): boolean {
  return hour >= 18 || hour < 5;
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Splits a page title into words; the last word of a multi-word title carries the GO accent. */
export function titleWords(title: string): { word: string; accent: boolean }[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  return words.map((word, index) => ({ word, accent: words.length > 1 && index === words.length - 1 }));
}

export const RING_CIRCUMFERENCE = 2 * Math.PI * 28;

/** Stroke offset for a progress ring; fractions outside 0–1 are clamped, unknown values draw an empty ring. */
export function ringOffset(fraction: number | null | undefined, circumference = RING_CIRCUMFERENCE): number {
  const value = typeof fraction === 'number' && Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return Number((circumference * (1 - value)).toFixed(3));
}

/** Intermediate count-up value. Whole targets stay whole; half-day targets move in half-day steps. */
export function countUpValue(target: number, progress: number, from = 0): number {
  const t = Math.min(1, Math.max(0, progress));
  const eased = 1 - Math.pow(1 - t, 3);
  const raw = from + (target - from) * eased;
  if (t >= 1) return target;
  return Number.isInteger(target) && Number.isInteger(from) ? Math.round(raw) : Math.round(raw * 2) / 2;
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthOnly = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const weekdayMedium = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const weekdayLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
const asDate = (value: string) => new Date(`${value}T12:00:00Z`);

export function formatShortDate(value: string): string {
  return isoDate(value) ? monthDay.format(asDate(value)) : value;
}

/** "Wed, Dec 30, 2026". */
export function formatMediumDate(value: string): string {
  return isoDate(value) ? weekdayMedium.format(asDate(value)) : value;
}

export function formatLongDate(value: string): string {
  return isoDate(value) ? weekdayLong.format(asDate(value)) : value;
}

/** "Dec 21–23", "Dec 30 – Jan 2" or "Dec 21" for a single day. */
export function formatTripRange(start: string, end: string): string {
  if (!isoDate(start)) return start;
  if (!isoDate(end) || end === start) return formatShortDate(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth ? `${formatShortDate(start)}–${Number(end.slice(8, 10))}` : `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** Boarding-pass stub for a holiday date. */
export function ticketParts(value: string): { month: string; day: string; weekday: string } {
  if (!isoDate(value)) return { month: '', day: value, weekday: '' };
  const date = asDate(value);
  return { month: monthOnly.format(date).toUpperCase(), day: String(Number(value.slice(8, 10))), weekday: weekdayShort.format(date) };
}

/** The approved leave an employee is on now, or the next one coming up. */
export function nextTimeOff(requests: LeaveRequest[], today: string): { request: LeaveRequest; current: boolean } | null {
  const request = requests
    .filter(r => r.status === 'Approved' && r.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return request ? { request, current: request.start_date <= today } : null;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** One friendly sentence for the dashboard hero, built only from loaded data. */
export function heroTip({ vacation, next }: { vacation?: LeaveBalance; next: ReturnType<typeof nextTimeOff> }): string {
  const remaining = vacation ? Math.max(0, vacation.allocated_days - vacation.used_days) : null;
  const balance = remaining === null ? '' : `${plural(remaining, 'vacation day')} left. `;
  if (next?.current) return `You’re on approved leave until ${formatShortDate(next.request.end_date)}. Enjoy the break!`;
  if (next) return `${balance}Your next time off is approved for ${formatTripRange(next.request.start_date, next.request.end_date)}.`;
  return `${balance}No time off booked yet.`;
}

/** Whole calendar days from one stored date to another (negative when in the past). */
export function daysBetween(from: string, to: string): number | null {
  if (!isoDate(from) || !isoDate(to)) return null;
  return Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86400000);
}

/** "Starts today", "Starts tomorrow" or "40 days to go". */
export function countdownLabel(today: string, start: string): string {
  const days = daysBetween(today, start);
  if (days === null || days < 0) return '';
  return days === 0 ? 'Starts today' : days === 1 ? 'Starts tomorrow' : `${days} days to go`;
}

/** "Nov 20, 2026 · 1 day" or "Dec 30 – Jan 2, 2027 · 3 days". */
export function formatLeaveSpan(request: Pick<LeaveRequest, 'start_date' | 'end_date' | 'total_days' | 'is_half_day'>): string {
  const length = request.is_half_day ? 'Half day' : plural(request.total_days, 'day');
  return `${formatDateRange(request.start_date, request.end_date)} · ${length}`;
}

/** "1 day", "3 days", "0.5 days". */
export function formatDayCount(count: number): string {
  return plural(count, 'day');
}

/** "Nov 20, 2026", "Dec 21–23, 2026" or "Dec 30 – Jan 2, 2027" (the year of the last day). */
export function formatDateRange(start: string, end: string): string {
  if (!isoDate(start)) return end && end !== start ? `${start} – ${end}` : start;
  return `${formatTripRange(start, end)}, ${(isoDate(end) ? end : start).slice(0, 4)}`;
}

/** Older server messages carry raw dates and "day(s)": "1 day(s) of Vacation Leave (2026-11-27)" becomes "1 day of Vacation Leave (Nov 27, 2026)". */
export function friendlyMessage(text: string): string {
  return String(text ?? '')
    .replace(/\b(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\b/g, (whole, start: string, end: string) => isoDate(start) && isoDate(end) ? formatDateRange(start, end) : whole)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, value => isoDate(value) ? formatDateRange(value, value) : value)
    .replace(/\b(\d+(?:\.\d+)?) day\(s\)/g, (_, count: string) => plural(Number(count), 'day'));
}

const stampDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
const stampTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });

/** A stored timestamp in company (Eastern) time: "Nov 7, 2026" or "Nov 7, 2026, 4:04 AM EST". */
export function formatStamp(value: string | number | Date | null | undefined, withTime = false): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return (withTime ? stampTime : stampDate).format(date);
}

/** What one balance card shows: days left, the allowance, what was used, and the ring share. */
export function balanceCardFigures(balance: LeaveBalance | undefined): { remaining: number | null; unit: string; fraction: number; caption: string } {
  if (!balance) return { remaining: null, unit: 'Not assigned', fraction: 0, caption: 'Ask HR to check your allowance' };
  if (!isPaidLeaveType(balance.leave_type)) return { remaining: balance.used_days, unit: balance.used_days === 1 ? 'day taken' : 'days taken', fraction: 0, caption: 'Unpaid · no balance deducted' };
  return {
    remaining: Math.max(0, balance.allocated_days - balance.used_days),
    unit: balance.allocated_days > 0 ? `of ${plural(balance.allocated_days, 'day')} left` : 'days left',
    fraction: balanceSummary([balance]).fraction,
    caption: balance.allocated_days === 0 ? 'No allowance assigned' : balance.used_days > 0 ? `${plural(balance.used_days, 'day')} used or booked` : 'Nothing used yet',
  };
}

/** Remaining days and share of an allowance across one or more balances. */
export function balanceSummary(balances: LeaveBalance[]): { remaining: number; allocated: number; used: number; fraction: number } {
  const allocated = balances.reduce((sum, b) => sum + b.allocated_days, 0);
  const remaining = balances.reduce((sum, b) => sum + Math.max(0, b.allocated_days - b.used_days), 0);
  return { remaining, allocated, used: balances.reduce((sum, b) => sum + b.used_days, 0), fraction: allocated > 0 ? remaining / allocated : 0 };
}

/** "Emergency and Medical" from a list of leave balances. */
export function leaveTypeList(balances: LeaveBalance[]): string {
  const names = balances.map(b => b.leave_type.replace(/ Leave$/, '')).filter((name, index, all) => all.indexOf(name) === index);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Coordinator coverage for a holiday, in plain words. */
export function coverageLabel(coverage: { pcs_working_count: number; pcs_required: number; conflicts_count?: number }): { text: string; attention: boolean } {
  const conflicts = coverage.conflicts_count ? ` · ${plural(coverage.conflicts_count, 'conflict')}` : '';
  if (coverage.pcs_required <= 0) return { text: `No coordinator required${conflicts}`, attention: Boolean(coverage.conflicts_count) };
  const missing = coverage.pcs_required - coverage.pcs_working_count;
  if (missing > 0) return { text: `Needs ${plural(missing, 'more coordinator')}${conflicts}`, attention: true };
  return { text: `Covered · ${coverage.pcs_working_count} of ${coverage.pcs_required}${conflicts}`, attention: Boolean(coverage.conflicts_count) };
}

export interface ReviewOutlook {
  paid: boolean;
  allocated: number | null;
  remaining: number | null;
  after: number | null;
  enough: boolean;
  overlaps: string[];
}

/** What approving a request would mean, using the same paid-leave rule as the server. */
export function reviewOutlook(request: LeaveRequest, balance: LeaveBalance | undefined, approved: LeaveRequest[]): ReviewOutlook {
  const paid = isPaidLeaveType(request.leave_type) || request.leave_type === 'Holiday Shift Credit';
  const remaining = balance ? balance.allocated_days - balance.used_days : paid ? 0 : null;
  const after = paid && remaining !== null ? remaining - request.total_days : null;
  const overlaps = approved
    .filter(r => r.id !== request.id && r.employee_id !== request.employee_id && r.status === 'Approved'
      && r.employee_department === request.employee_department && r.start_date <= request.end_date && r.end_date >= request.start_date)
    .map(r => r.employee_name)
    .filter((name, index, all) => all.indexOf(name) === index);
  return { paid, allocated: balance ? balance.allocated_days : null, remaining, after, enough: !paid || (after !== null && after >= 0), overlaps };
}

/** Rotating mascot lines. Only facts the caller passes in are mentioned. */
export function buddyMessages({ firstName, hour, weekday, unread, newRequests, onboarding }: {
  firstName: string; hour: number; weekday: number; unread: number; newRequests?: number; onboarding?: boolean;
}): string[] {
  // The page heading already says good morning; the buddy opens with a wish for the day.
  const wish = weekday === 0 || weekday === 6 ? 'Enjoy your weekend' : weekday === 5 ? 'Have a lovely weekend' : weekday === 1 ? 'Have a great week' : hour >= 18 ? 'Have a restful evening' : 'Have a great day';
  const lines = [`${wish}, ${firstName}!`];
  if (newRequests) lines.push(`${plural(newRequests, 'new leave request')} to review.`);
  lines.push(unread ? `You have ${plural(unread, 'unread notification')}.` : 'You’re all caught up on notifications.');
  if (onboarding) lines.push('Your getting-started checklist is waiting.');
  lines.push('Press Ctrl K to jump to any page.');
  return lines;
}
