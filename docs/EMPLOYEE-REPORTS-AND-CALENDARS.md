# Employee exports and holiday calendars

## Export the employee list

Administrators can open **Employees → Export Employee List**. Search, department, country and status filters apply to the export; clear them to include all employees. The CSV opens in Excel and includes employee ID, name, email, department, job title, country, region, holiday calendar, holiday region, hire date, role and status. Passwords, documents, birthdays and leave reasons are excluded. CSV cells are escaped and formula prefixes neutralized.

## HR department

HR is available in the shared department list used by employee forms, filters and reports.

## Country and holiday calendar

- **Country** identifies where the employee is based: Canada, Argentina, United States, Philippines, Costa Rica or United Kingdom.
- **State / Province / Region** describes their physical location.
- **Holiday Calendar** selects which country's configured holidays apply to upcoming holidays and leave-day calculations.
- **Holiday Calendar** offers the same six countries as Country. The selections remain independent.
- The holiday-region input is removed. New assignments use national and company-wide holidays. Previously saved regional assignments are preserved until the holiday calendar is changed.
- Changing physical country does not change an assigned holiday calendar.
- Changing holiday calendar clears the previous calendar region.

Example: an employee based in the Philippines may use the United States holiday calendar.

Existing profiles without explicit calendar fields fall back to their original country and region. The first admin edit preserves that calendar independently of subsequent location changes. Existing stored leave requests and balances are not recalculated. Profiles outside the six new country choices retain their existing value in the edit form.

Adding a country option does not import holidays. Administrators still manage actual holiday dates in Holidays.

Validation: production build, TypeScript and all 78 automated tests passed, including legacy profiles, persistence, cross-country leave/calendar behavior, regional matching and CSV safety.
