# HR workflow improvements

This release preserves HR policy calculations, authentication, role checks and approval rules. Existing employee records, leave balances, requests and documents are retained.

## Employee experience

- My Workspace puts personal balances, requests waiting on HR, next approved leave and upcoming holidays together. Dashboard sections load independently and show retry messages instead of invented data or empty results after a failure.
- Request leave explains the employee's holiday calendar and workweek, calendar days, excluded non-working days and holidays, and the requested duration. Inline errors and a focused error summary help employees correct the form. A persistent submission confirmation links directly to the new request.
- Country and holiday calendar remain separate. Physical country continues to determine announcement targeting; holiday calendar continues to determine leave calculations.
- Announcements can be filtered by unread or needs acknowledgment. Updated versions explain when acknowledgment is required again. Administrators get an active-recipient count before publication and filters in readership reports.

## Administration

- Leave approvals initially show pending requests, oldest first. The focused review includes the reason, attachment, current balance and overlapping approved absences in the department. Own requests are visible but cannot be selected for review. The existing server prohibition remains enforced.
- Batch approval/rejection asks for confirmation and reports success or failure for every request. Successful requests are not retried automatically. Failed requests remain selected only while still eligible.
- Selecting an employee's name opens a dedicated record with Overview, Employment, Leave, Documents and Account sections. The existing edit, access, allowance and document-management actions remain available.
- Report years come from current/data years, with all four quarters and a true year-to-date cutoff. Requests are explicitly grouped by start date.
- Team summaries say “not on approved leave,” rather than implying live attendance. No clock-in/out feature was added.

## Navigation, files and loading

- Hash routes preserve the workspace, page and linked record across refresh, Back and bookmarks. The existing role-aware navigation restricts employee routes. Notification links open the corresponding request or announcement.
- Harmless view choices are stored per user in session storage. Forms, passwords and HR records are not stored there. Unsaved leave requests, announcement edits, employee edits, holiday shift requests, document uploads and settings are protected on navigation/close or reload.
- Native dialogs provide focus containment, background inertness, Escape handling and restored focus. Busy submissions cannot be dismissed. Mobile forms use readable inputs and practical action sizes.
- Document lists use metadata; a single admin request lists all document metadata. Original bytes are fetched on demand from an authenticated owner/admin endpoint, with no-store caching. PDFs and images support opening a preview. Missing originals are labeled unavailable; no substitute text file is generated.
- Larger screens load on demand. The initial JavaScript build is about 447 KB before compression, compared with about 860 KB for the same work before code splitting. This measures bundle size, not a guaranteed load-time reduction.

## Verification and limits

`npm run lint`, `npm run build`, and `npm test` pass. The suite has 102 tests, including route/role boundaries, per-request batch outcomes, calendar calculations, audience intersection counts, document authorization, binary download/preview headers, and existing HR and security regressions. HTTP tests use synthetic records in temporary local stores and do not access production data.

Authenticated visual browser QA was unavailable in this environment. Build and API checks do not certify every real-device interaction. Deployment is verified separately through the primary Cloud Build check and live asset hashes. No database migration, cloud IAM change, Microsoft-login activation or real employee test record is part of this release.
