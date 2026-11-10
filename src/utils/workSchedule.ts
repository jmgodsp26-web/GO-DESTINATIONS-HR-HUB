import type { WorkScheduleRules } from '../types/workSchedule';

export const WEEKDAYS = [
  { day: 1, label: 'Monday' }, { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' }, { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' }, { day: 6, label: 'Saturday' }, { day: 0, label: 'Sunday' },
];

export function parseScheduleDate(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Please select valid dates (YYYY-MM-DD).');
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Please select valid dates.');
  return time;
}

export function companyWorkingDays(workweek = 'Monday to Friday'): number[] {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const range = /^\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*(?:to|-)\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*$/i.exec(workweek);
  if (!range) throw new Error('Workweek must be a day range, such as Monday to Friday.');
  const days: number[] = [];
  let weekday = names.indexOf(range[1].toLowerCase());
  const finalDay = names.indexOf(range[2].toLowerCase());
  while (!days.includes(weekday)) { days.push(weekday); if (weekday === finalDay) break; weekday = (weekday + 1) % 7; }
  return days;
}

export function validateWorkSchedule(input: unknown): WorkScheduleRules {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Enter a valid work schedule.');
  const { regular_days, exceptions } = input as WorkScheduleRules;
  if (regular_days !== null && (!Array.isArray(regular_days) || regular_days.length < 1 || regular_days.length > 7 ||
    regular_days.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(regular_days).size !== regular_days.length)) {
    throw new Error('Select at least one regular working day, or use the company schedule.');
  }
  if (!Array.isArray(exceptions) || exceptions.length > 366) throw new Error('Use at most 366 date changes per employee.');
  const dates = new Set<string>();
  const normalized = exceptions.map(entry => {
    if (!entry || typeof entry !== 'object' || typeof entry.working !== 'boolean') throw new Error('Choose Working day or Day off for every date change.');
    parseScheduleDate(entry.date);
    if (dates.has(entry.date)) throw new Error('Each date can only appear once in schedule changes.');
    dates.add(entry.date);
    return { date: entry.date, working: entry.working };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { regular_days: regular_days === null ? null : [...regular_days].sort((a, b) => a - b), exceptions: normalized };
}

export function scheduleLabel(schedule: WorkScheduleRules | null | undefined, workweek: string): string {
  return schedule?.regular_days ? WEEKDAYS.filter(d => schedule.regular_days!.includes(d.day)).map(d => d.label).join(', ') : workweek;
}
