import { isPaidLeaveType, type LeaveBalance, type LeaveRequest } from '../types';

/** Pure display helpers for the GO brand interface. No dates are invented: every value comes from the caller. */

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
const weekdayLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
const asDate = (value: string) => new Date(`${value}T12:00:00Z`);

export function formatShortDate(value: string): string {
  return isoDate(value) ? monthDay.format(asDate(value)) : value;
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
  if (next) return `${balance}Your next time off: ${formatTripRange(next.request.start_date, next.request.end_date)}.`;
  return `${balance}No time off booked yet.`;
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
  const lines = [`${greetingFor(hour)}, ${firstName}!`];
  if (newRequests) lines.push(`${plural(newRequests, 'new leave request')} to review.`);
  lines.push(unread ? `You have ${plural(unread, 'unread notification')}.` : 'You’re all caught up on notifications.');
  if (onboarding) lines.push('Your getting-started checklist is waiting.');
  if (weekday === 5) lines.push('Happy Friday! Any weekend plans?');
  else if (weekday === 1) lines.push('New week, new adventures!');
  lines.push('Press Ctrl K to jump to any page.');
  return lines;
}
