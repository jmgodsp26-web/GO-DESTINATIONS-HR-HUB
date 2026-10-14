# Company announcements

Admins open **Announcements** in Administration to create a draft, preview it, and publish. The editor supports a category, plain-text message, pinning, optional expiry and optional explicit acknowledgment. Published announcements can be edited or archived. Archiving hides the update and its notifications while preserving its report.

Employees open **Announcements** or **Company updates** on their dashboard. Admins use **My Space** for their own employee read/acknowledgment experience; management previews do not count as reading. Opening an update records a read. Required acknowledgment is a separate button after reading.

## Audience and versions

Empty department or country selections mean everyone in that group. Selecting both groups requires a match in both. Country uses the employee's physical country, independently of their holiday calendar. Only active accounts qualify. Server-side checks apply to lists, reads, acknowledgments and linked notifications.

Publishing creates in-app notifications, not email. Editing a published update increments its version, replaces notifications, and requires fresh reading and acknowledgment. Concurrent edits and stale acknowledgment requests are rejected. Reports show current active recipients and receipt timestamps for the current version.

## Storage

Existing transactional persistence stores announcements in `hr_v2_announcements` and receipts in `hr_v2_announcementReceipts`. Existing databases initialize these as empty collections; no seed announcements are published. Drafts, receipts, audit entries and notifications survive persistence/reload. Browser access uses authenticated API endpoints; Firestore remains accessed through the backend.

## Validation

`npm run lint`, `npm run build`, and `npm test` pass (92 tests). Announcement coverage includes HTTP authentication, admin-only management/reporting, audience filtering, draft privacy, separate read/acknowledgment actions, persistence, concurrent updates, expiration, notification filtering and archive behavior. Browser verification of authenticated production workflows requires an authorized signed-in session and has not been performed by these automated tests.
