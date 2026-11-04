export const EASTERN_TIME_ZONE = 'America/New_York';

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: EASTERN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: EASTERN_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function easternDate(date = new Date()): string {
  const parts = Object.fromEntries(dateParts.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function easternDateTimeInput(date: Date): string {
  return `${easternDate(date)}T${timeParts.format(date)}`;
}

export function easternInputToISOString(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const wallTime = Date.parse(value + 'Z');
  if (!Number.isFinite(wallTime)) return null;
  // Try both modern Eastern offsets. A missing or repeated wall time is ambiguous.
  const matches = [4, 5].map(hours => new Date(wallTime + hours * 3_600_000))
    .filter(date => easternDateTimeInput(date) === value);
  return matches.length === 1 ? matches[0].toISOString() : null;
}
