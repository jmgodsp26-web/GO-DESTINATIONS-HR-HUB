# New-hire onboarding

HR Hub now supports reusable onboarding checklists, individual employee plans, task ownership, document review, explicit acknowledgments and private task questions. Existing employee accounts and HR workflows continue to work as before.

## Start your first plan

1. Sign in as an administrator and switch to **Administration**.
2. Open **Onboarding**, then **Checklist templates**.
3. Select **Create template** or **Set up general onboarding**. Review the suggested tasks and replace the instructions with your company process.
4. Set each task's stage, responsible person, due date offset and whether completion requires HR review. Day 0 is the employee's onboarding start date; negative numbers are before that date. Add your approved company links and document requirements where needed.
5. Save the template, then select **Start onboarding**.
6. Choose an existing active employee account, the template and start date. Choose an active HR administrator and any manager or IT contact needed by the tasks. Contacts must have existing HR Hub accounts.
7. Review the employee's copy of the checklist and select **Assign checklist**.

Templates are copied into employee plans. Later template edits do not change already assigned instructions. There can be only one active plan per employee. Creating a plan does not create an employee account, change employment dates or send an email invitation.

## Employee and staff experience

- Assigned users see **Getting started** in their personal workspace and a dashboard shortcut. Administrators also complete their own assigned work from their personal workspace.
- Tasks are grouped into Before starting, First day, First week and First month. Users see only their own assigned tasks; HR administrators can manage the full plan.
- Task completion can be immediate or require HR review. Document tasks always require review. The uploader can view previous submission versions.
- Acknowledgment tasks record reading and explicit acknowledgment separately. These are checklist receipts, not an electronic-signature service.
- **Ask HR** opens a private conversation for that task. Other employees or assigned staff cannot read the conversation or document submissions for a task they do not own.
- In-app notifications open the relevant plan or task. Due and overdue reminders are evaluated when the assigned user checks notifications, at most once per task per day. HR can also send an in-app reminder. There is no background email or SMS delivery.

## HR review and completion

Use **Needs review**, **Overdue** and **Starting soon** to find plans needing attention. Starting soon includes the next 14 days using the employee's time zone.

Open a task to approve a submission, return it with an explanation, reply to a question or waive it with a reason. Another HR administrator must review an administrator's own submission. An administrator cannot review their own new-hire onboarding plan.

**Schedule & contacts** updates the welcome message, start date and contacts. Unfinished tasks move with the new date; completed tasks retain their dates. Tasks with submissions, read receipts or private conversations cannot be transferred to another owner.

Select **Finish onboarding** once every required task is completed or waived. Optional tasks do not block completion, but all tasks become read-only when the plan is closed. HR can reopen a completed plan if the employee has no other active plan. Cancelling requires a reason and retains the records.

## Files, storage and access

Uploads use the app's existing file validation and 450 KB file limit. Files are downloaded through authenticated owner/admin endpoints with no-store caching. PDF and image files can be previewed. List responses contain file metadata rather than file contents.

The server stores templates, plans, messages and files in separate `hr_v2_onboarding*` collections through the existing Firestore transaction layer. Existing data does not require a destructive migration. Ordinary transactions read onboarding file metadata; individual file downloads fetch only the requested original. Audit events identify onboarding actions. Removing an employee also removes that employee's onboarding records and files.

## Verification and release limits

`npm run lint`, `npm run build` and the full `npm test` suite passed (116 tests). Fourteen onboarding tests cover validation, immutable template copies, role and account checks, task privacy, explicit acknowledgments, file review and versioning, required completion, stale updates, reminder limits, date changes, cleanup and HTTP transactions. The tests use synthetic records and temporary local storage.

Authenticated visual browser QA was blocked by the browser environment's URL security policy. Automated checks do not certify every browser interaction. Firestore projection behavior is compiled and reviewed but was not exercised against the production database. Deployment and live asset verification are performed separately. No real employee test records are created by this release.
