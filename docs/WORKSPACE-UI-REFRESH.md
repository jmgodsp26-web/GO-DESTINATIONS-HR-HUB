# Workspace UI refresh — October 2026

The workspace previously mixed oversized introductions, several card patterns, and a nine-column employee table. This update establishes one page hierarchy and reduces the amount of competing decoration around routine HR tasks.

- Shared page headings across dashboards, employees, leave, calendar, holidays, documents, reports, notifications, activity and settings.
- Compact navy navigation, a lighter header and a keyboard skip link.
- Reusable summary cards with native buttons for navigable metrics.
- Personal dashboard with a compact identity panel and the existing leave, holiday-shift and request actions.
- Employee directory summary, labeled filters, result counts, an empty state and six grouped columns. All existing employee details and actions remain available; actions stay visible when the table scrolls horizontally.
- Consistent input heights, borders, spacing, mobile layouts and visible keyboard focus.

Open Sans and the existing GO palette are retained: navy `#182E3F`, denim `#3A5D83`, orange `#ED9027`, with lighter supporting neutrals. The signed-in presentation is scoped through `.go-polished` in `src/workspace-ui.css`; login artwork and motion retain their existing styles.

No API, database, authorization, leave calculation, approval or deployment configuration changes are included. Two misleading presentation placeholders are removed: a fixed “Service Layer Active” badge and the invented 2/2 holiday coverage fallback. An unavailable coverage metric now displays an em dash.

## Verification

- Existing automated regression suite: 82 passing tests.
- TypeScript type check and production build pass.
- Browser visual QA was unavailable in the editing environment. Desktop/mobile rendering, keyboard navigation, dialog layouts and live authenticated interactions still need visual verification. Automated workflow tests do not establish that every live screen is error-free.
