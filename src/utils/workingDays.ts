import type { WorkScheduleRules } from '../types/workSchedule';
import { companyWorkingDays, parseScheduleDate } from './workSchedule';

export function holidayApplies(h: {country?: string; region?: string; scope?: string; is_active?: boolean}, country?: string, region?: string): boolean {
  const normal = (value?: string) => (value || '').trim().toLowerCase();
  if (h.is_active === false) return false;
  if (h.scope === 'Company-wide' || ['global', 'all', 'company-wide'].includes(normal(h.country))) return true;
  if (normal(h.country) !== normal(country)) return false;
  return !h.region || normal(h.region) === 'all' || normal(h.region) === normal(region);
}
export function workingDates(start: string, end: string, holidays: {date: string; country?: string; region?: string; scope?: string; is_active?: boolean}[], country?: string, region?: string, workweek = 'Monday to Friday', schedule?: WorkScheduleRules | null): string[] {
  const days = new Set(schedule?.regular_days ?? companyWorkingDays(workweek));
  const overrides = new Map((schedule?.exceptions || []).map(entry => [entry.date, entry.working]));
  const first = parseScheduleDate(start), last = parseScheduleDate(end), day = 86400000;
  if (last < first) throw new Error('End date cannot be earlier than start date.');
  if (last - first > 366 * day) throw new Error('Please request at most one year of leave at a time.');
  const excluded = new Set(holidays.filter(h => holidayApplies(h, country, region)).map(h => h.date));
  const dates: string[] = [];
  for (let time = first; time <= last; time += day) {
    const date = new Date(time), key = date.toISOString().slice(0, 10);
    const scheduled = overrides.has(key) ? overrides.get(key) : days.has(date.getUTCDay());
    if (scheduled && !excluded.has(key)) dates.push(key);
  }
  return dates;
}

export function workingDays(start: string, end: string, holidays: Parameters<typeof workingDates>[2], country?: string, region?: string, workweek = 'Monday to Friday', schedule?: WorkScheduleRules | null): number {
  return workingDates(start, end, holidays, country, region, workweek, schedule).length;
}


/** Counts use the same calendar/workweek rules as the server's charged days. */
export function leaveDayBreakdown(start: string, end: string, holidays: Parameters<typeof workingDays>[2], country?: string, region?: string, workweek = 'Monday to Friday', schedule?: WorkScheduleRules | null) {
  const charged = workingDays(start, end, holidays, country, region, workweek, schedule);
  const scheduled = workingDays(start, end, [], country, region, workweek, schedule);
  const selected = Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1;
  return { selected, nonWorking: selected - scheduled, holidays: scheduled - charged, charged };
}
