/** Legacy profiles keep their original country calendar until explicitly assigned. */
export function employeeCalendar(employee?: {
  country?: string; region?: string; holiday_calendar?: string; holiday_region?: string;
} | null): { country: string; region: string } {
  return {
    country: employee?.holiday_calendar ?? employee?.country ?? '',
    region: employee?.holiday_region ?? (employee?.holiday_calendar === undefined ? employee?.region ?? '' : ''),
  };
}
