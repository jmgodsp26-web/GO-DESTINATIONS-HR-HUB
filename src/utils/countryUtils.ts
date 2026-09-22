import { Holiday } from '../types';

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  defaultTimezone: string;
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', defaultTimezone: 'America/New_York' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', defaultTimezone: 'Asia/Manila' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', defaultTimezone: 'America/Toronto' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultTimezone: 'Europe/London' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', defaultTimezone: 'Australia/Sydney' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', defaultTimezone: 'Asia/Singapore' },
  { code: 'IN', name: 'India', flag: '🇮🇳', defaultTimezone: 'Asia/Kolkata' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', defaultTimezone: 'Pacific/Auckland' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', defaultTimezone: 'Europe/Berlin' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', defaultTimezone: 'Asia/Tokyo' },
];

export const DEFAULT_COUNTRY = 'United States';
export const COMMON_COUNTRIES = SUPPORTED_COUNTRIES.map((c) => c.name);

/**
 * Returns flag emoji for a given country string, or a fallback icon/emoji.
 */
export function getCountryFlag(countryName?: string | null): string {
  if (!countryName) return '🌐';
  const norm = countryName.trim().toLowerCase();

  if (norm === 'global' || norm === 'company-wide' || norm === 'all') {
    return '🌐';
  }

  const match = SUPPORTED_COUNTRIES.find(
    (c) => c.name.toLowerCase() === norm || c.code.toLowerCase() === norm
  );
  if (match) return match.flag;

  // Keyword checks
  if (norm.includes('united states') || norm === 'usa' || norm === 'us') return '🇺🇸';
  if (norm.includes('philippines') || norm === 'ph') return '🇵🇭';
  if (norm.includes('canada') || norm === 'ca') return '🇨🇦';
  if (norm.includes('united kingdom') || norm.includes('britain') || norm === 'uk' || norm === 'gb') return '🇬🇧';
  if (norm.includes('australia') || norm === 'au') return '🇦🇺';
  if (norm.includes('singapore') || norm === 'sg') return '🇸🇬';
  if (norm.includes('india') || norm === 'in') return '🇮🇳';
  if (norm.includes('new zealand') || norm === 'nz') return '🇳🇿';
  if (norm.includes('germany') || norm === 'de') return '🇩🇪';
  if (norm.includes('japan') || norm === 'jp') return '🇯🇵';

  return '📍';
}

/**
 * Checks if a holiday applies to an employee based on their country and region.
 * Company-wide holidays apply to EVERY employee worldwide.
 */
export function isHolidayApplicableToEmployee(
  holiday: Holiday,
  employeeLocation: { country?: string; region?: string } | null | undefined
): boolean {
  // If holiday is inactive, never show to employees
  if (holiday.is_active === false) return false;

  // Company-wide scope or Global country applies to all employees
  if (
    holiday.scope === 'Company-wide' ||
    holiday.country?.toLowerCase() === 'company-wide' ||
    holiday.country?.toLowerCase() === 'global' ||
    holiday.country?.toLowerCase() === 'all'
  ) {
    return true;
  }

  // If employee has no country specified, we only show company-wide
  if (!employeeLocation?.country) {
    return false;
  }

  const empCountry = employeeLocation.country.trim().toLowerCase();
  const holCountry = (holiday.country || '').trim().toLowerCase();

  // Match country
  if (empCountry !== holCountry) {
    return false;
  }

  // If holiday specifies a region other than 'All', check if employee matches
  if (holiday.region && holiday.region.trim().toLowerCase() !== 'all') {
    if (!employeeLocation.region) return true; // Default to including if region unknown
    const empRegion = employeeLocation.region.trim().toLowerCase();
    const holRegion = holiday.region.trim().toLowerCase();
    return empRegion.includes(holRegion) || holRegion.includes(empRegion);
  }

  return true;
}

/**
 * Returns today's calendar date as YYYY-MM-DD in the local calendar or specified timezone.
 * Immune to UTC conversion and timezone rollbacks.
 */
export function getTodayDateString(timeZone?: string): string {
  try {
    const tz = timeZone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const formatted = formatter.format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // fallback
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD string into numeric components without timezone shifting.
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

/**
 * Formats a calendar date safely without UTC offset shifts.
 * Noon anchor (12:00:00) ensures zero day-drift across any time zone.
 */
export function formatHolidayDate(
  dateStr: string,
  options?: { showYear?: boolean; showWeekday?: boolean }
): {
  monthName: string;
  monthShort: string;
  day: number;
  weekday: string;
  year: number;
  formatted: string;
} {
  const { year, month, day } = parseDateParts(dateStr);
  const d = new Date(year, month - 1, day, 12, 0, 0);

  const monthShort = d.toLocaleString('en-US', { month: 'short' });
  const monthName = d.toLocaleString('en-US', { month: 'long' });
  const weekday = d.toLocaleString('en-US', { weekday: 'short' });
  const formatted = options?.showYear
    ? `${monthShort} ${day}, ${year}`
    : `${monthShort} ${day}`;

  return {
    monthName,
    monthShort,
    day,
    weekday,
    year,
    formatted,
  };
}

/**
 * Filter and sort holidays strictly for upcoming dates.
 * By default enforces strict future: holiday.date > todayStr.
 * Never shows past holidays under any circumstances.
 * Chronologically sorted by ISO date string (soonest -> latest).
 */
export function getUpcomingHolidays(
  holidays: Holiday[],
  options?: {
    referenceDateStr?: string;
    strictFutureOnly?: boolean;
    userLocation?: { country?: string; region?: string } | null;
    year?: number | string;
  }
): Holiday[] {
  const todayStr = options?.referenceDateStr || getTodayDateString();
  const strictFutureOnly = options?.strictFutureOnly !== false; // default true: holiday.date > today

  return holidays
    .filter((h) => {
      // Must be active
      if (h.is_active === false) return false;

      // Year boundary enforcement (e.g. 2026 holidays only for current calendar year dashboard)
      if (options?.year && options.year !== 'All') {
        const yearPrefix = `${options.year}-`;
        if (!h.date.startsWith(yearPrefix)) return false;
      }

      // Strict future comparison: holiday.date > today
      if (strictFutureOnly) {
        if (h.date <= todayStr) return false;
      } else {
        if (h.date < todayStr) return false;
      }

      // Check applicability if userLocation is provided
      if (options?.userLocation) {
        if (!isHolidayApplicableToEmployee(h, options.userLocation)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculates days countdown string (e.g., "Today", "Tomorrow", "In 12 days", or "Past")
 */
export function getHolidayCountdown(
  dateStr: string,
  referenceDateStr?: string
): { label: string; daysDiff: number; isToday: boolean; isTomorrow: boolean; isPast: boolean } {
  const today = referenceDateStr ? new Date(referenceDateStr + 'T00:00:00') : new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Past', daysDiff: diffDays, isToday: false, isTomorrow: false, isPast: true };
  }
  if (diffDays === 0) {
    return { label: 'Today', daysDiff: 0, isToday: true, isTomorrow: false, isPast: false };
  }
  if (diffDays === 1) {
    return { label: 'Tomorrow', daysDiff: 1, isToday: false, isTomorrow: true, isPast: false };
  }
  return {
    label: `In ${diffDays} days`,
    daysDiff: diffDays,
    isToday: false,
    isTomorrow: false,
    isPast: false,
  };
}
