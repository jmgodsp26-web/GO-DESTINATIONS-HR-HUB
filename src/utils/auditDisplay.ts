import { easternDate } from './easternTime';

/** Display helpers for the Activity Log. Only the stored log values are used. */

export type AuditIcon =
  | 'signin' | 'signinFailed' | 'password' | 'approved' | 'rejected' | 'cancelled'
  | 'employeeCreated' | 'employeeUpdated' | 'employeeRemoved' | 'balance' | 'holiday'
  | 'announcement' | 'document' | 'settings' | 'onboarding' | 'other';

/** Picks an icon and colour for an action name. Red for failures and removals, green for approvals. */
export function auditTone(action: string): { icon: AuditIcon; color: 'good' | 'bad' | 'warm' | 'calm' } {
  const a = String(action || '').toLowerCase();
  if (a.includes('sign-in failed') || a.includes('failed')) return { icon: 'signinFailed', color: 'bad' };
  if (a.includes('signed in') || a.includes('sign in')) return { icon: 'signin', color: 'calm' };
  if (a.includes('password')) return { icon: 'password', color: 'warm' };
  if (a.includes('announcement')) return { icon: 'announcement', color: 'warm' };
  if (a.includes('document')) return { icon: 'document', color: a.includes('deleted') ? 'bad' : 'calm' };
  if (a.includes('onboarding') || a.includes('checklist')) return { icon: 'onboarding', color: 'calm' };
  if (a.includes('settings')) return { icon: 'settings', color: 'warm' };
  if (a.includes('holiday')) return { icon: 'holiday', color: a.includes('deleted') || a.includes('rejected') ? 'bad' : a.includes('approved') ? 'good' : 'calm' };
  if (a.includes('balance') || a.includes('usage')) return { icon: 'balance', color: 'warm' };
  if (a.includes('employee') && (a.includes('deleted') || a.includes('disabled'))) return { icon: 'employeeRemoved', color: 'bad' };
  if (a.includes('employee') && a.includes('created')) return { icon: 'employeeCreated', color: 'good' };
  if (a.includes('employee') || a.includes('schedule')) return { icon: 'employeeUpdated', color: 'calm' };
  if (a.includes('cancel')) return { icon: 'cancelled', color: 'warm' };
  if (a.includes('reject')) return { icon: 'rejected', color: 'bad' };
  if (a.includes('approv')) return { icon: 'approved', color: 'good' };
  return { icon: 'other', color: 'calm' };
}

const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Groups logs by their company (Eastern) date, newest first: "Today", "Yesterday", then "Monday, Nov 9, 2026". */
export function groupAuditLogs<T extends { timestamp: string }>(logs: T[], today: string): { date: string; label: string; items: T[] }[] {
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);
  const groups = new Map<string, T[]>();
  const time = (value: string) => { const ms = Date.parse(value); return Number.isFinite(ms) ? ms : -Infinity; };
  for (const log of [...logs].sort((a, b) => time(b.timestamp) - time(a.timestamp))) {
    const at = new Date(log.timestamp);
    const date = Number.isFinite(at.getTime()) ? easternDate(at) : 'unknown';
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(log);
  }
  return [...groups.entries()].map(([date, items]) => ({
    date,
    label: date === today ? 'Today' : date === yesterdayIso ? 'Yesterday' : date === 'unknown' ? 'Date not recorded' : dayLabel.format(new Date(`${date}T12:00:00Z`)),
    items,
  }));
}
