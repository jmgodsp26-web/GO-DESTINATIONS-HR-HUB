export function holidayApplies(h: {country?: string; region?: string; scope?: string; is_active?: boolean}, country?: string, region?: string): boolean {
  const normal = (value?: string) => (value || '').trim().toLowerCase();
  if (h.is_active === false) return false;
  if (h.scope === 'Company-wide' || ['global', 'all', 'company-wide'].includes(normal(h.country))) return true;
  if (normal(h.country) !== normal(country)) return false;
  return !h.region || normal(h.region) === 'all' || normal(h.region) === normal(region);
}
export function workingDays(start: string, end: string, holidays: {date: string; country?: string; region?: string; scope?: string; is_active?: boolean}[], country?: string, region?: string, workweek = 'Monday to Friday'): number {
  const parse = (value: string) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Please select valid leave dates (YYYY-MM-DD).');
    const time = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Please select valid leave dates.');
    return time;
  };
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const range = /^\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*(?:to|-)\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*$/i.exec(workweek);
  if (!range) throw new Error('Workweek must be a day range, such as Monday to Friday.');
  const days = new Set<number>();
  let weekday = names.indexOf(range[1].toLowerCase());
  const finalDay = names.indexOf(range[2].toLowerCase());
  while (!days.has(weekday)) {days.add(weekday); if (weekday === finalDay) break; weekday = (weekday + 1) % 7;}
  const first = parse(start), last = parse(end), day = 86400000;
  if (last < first) throw new Error('End date cannot be earlier than start date.');
  if (last - first > 366 * day) throw new Error('Please request at most one year of leave at a time.');
  const excluded = new Set(holidays.filter(h => holidayApplies(h, country, region)).map(h => h.date));
  let count = 0;
  for (let time = first; time <= last; time += day) {
    const date = new Date(time);
    if (days.has(date.getUTCDay()) && !excluded.has(date.toISOString().slice(0, 10))) count++;
  }
  return count;
}
