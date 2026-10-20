# Company announcements

Admins open **Announcements** in Administration to create a draft, preview it, and publish. The editor supports a category, plain-text message, pinning, optional expiry and optional explicit acknowledgment. Published announcements can be edited or archived. Archiving hides the update and its notifications while preserving its report.

Employees open **Announcements** or **Company updates** on their dashboard. Admins use **My Space** for their own employee read/acknowledgment experience; management previews do not count as reading. Opening an update records a read. Required acknowledgment is a separate button after reading.

## Audience and versions

Choose **All departments (select all)** and **All countries (select all)** for a company-wide update. Choose specific groups to restrict the audience. The editor prevents publishing an empty custom selection. All-group selections are stored as empty arrays for compatibility with existing announcements. Selecting both groups requires a match in both. Country uses the employee's physical country, independently of their holiday calendar. Only active accounts qualify. Server-side checks apply to lists, reads, acknowledgments and linked notifications.

Publishing creates in-app notifications, not email. Editing a published update increments its version, replaces notifications, and requires fresh reading and acknowledgment. Concurrent edits and stale acknowledgment requests are rejected. Reports show current active recipients and receipt timestamps for the current version.

## Upload an image

In Create/Edit announcement, use **Upload image** to choose one JPG or PNG up to 450 KB. Add a short image description for screen readers and put important dates or instructions in the message. Use Preview to check the image before publishing. **Replace image** and **Remove image** are available when editing.

Images appear without cropping in the announcement, with a compact preview in the list and a full-size link in the detail view. Saving a draft keeps its image private to administrators. Publishing an image does not create a separate notification; it follows the announcement's existing publication and version rules. Uploaded examples are not automatically posted.

Images are checked for allowed MIME type, file signature and size. Only active users who can access the announcement, or administrators reviewing drafts/archives, can retrieve its image. Expiry, audience changes and archiving revoke employee image access. Replacement and removal revoke old image URLs. Image responses use no-store caching. Files live in `hr_v2_announcementImages`; announcement lists and ordinary database transactions read metadata, while individual image requests fetch the original bytes.

## Storage

Existing transactional persistence stores announcements in `hr_v2_announcements` and receipts in `hr_v2_announcementReceipts`. Existing databases initialize these as empty collections; no seed announcements are published. Drafts, receipts, audit entries and notifications survive persistence/reload. Browser access uses authenticated API endpoints; Firestore remains accessed through the backend.

## Validation

`npm run lint`, `npm run build`, and `npm test` pass (120 tests). Announcement coverage includes HTTP authentication, admin-only management/reporting, audience filtering, draft privacy, separate read/acknowledgment actions, persistence, concurrent updates, expiration, notification filtering and archive behavior. Image tests cover validation, private access, original bytes, no-store headers, replacement/removal, expiry, reload and invalid-upload rollback. Browser verification of authenticated production workflows requires an authorized signed-in session and has not been performed by these automated tests.
