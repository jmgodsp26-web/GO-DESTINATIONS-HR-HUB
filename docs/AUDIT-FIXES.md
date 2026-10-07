# HR workflow audit fixes — 7 October 2026

The audited 62 synthetic scenarios are now regression assertions in `tests/workflows.test.mjs` and `tests/http-workflows.test.mjs`. Additional cases cover credit redemption/refund, historical credit rates, assignment downgrade, holiday deletion, private binary downloads, policy validation, allocation floors, sequence persistence, and safe CSV output. `npm run lint`, `npm run build`, then `npm test` verifies the source and compiled server.

## Behavior

- Employees see confidential leave reasons, supporting attachments and review notes only for their own requests. HR administrators retain their authorized view. Staffing and calendar views hide other employees' confidential details.
- Leave dates must be real YYYY-MM-DD dates, within a one-year request range. Full and half days use the same applicable country/region holidays and configured workweek. A workweek uses a day range, for example `Monday to Friday` or `Monday to Saturday`.
- Supporting files are actually stored and downloaded through an owner/admin-only API. Leave attachments are kept in a separate `hr_v2_leaveAttachments` collection. Accepted files are at most 450,000 bytes (450 KB); unsupported executable web document types and malformed data are rejected. No additional storage bucket configuration is required. Old placeholder attachment links cannot recover files that were never uploaded.
- Holiday credit awards use the configured rate. Reversals use the amount originally awarded, and reapproval restores credit once. Credits already redeemed cannot be withdrawn until the approved credit leave is cancelled. Assignment downgrades and holiday deletion also reconcile the ledger.
- Manual adjustments stop at used days and record the actual applied change. Editing allocations creates a corresponding ledger entry. New employee IDs use a persistent increasing sequence; existing employee records keep their IDs.
- Employee defaults and emergency allocation use company policy. Earned holiday credit is selectable in the leave form. Document upload limits agree with the backend and saving waits for file loading.
- CSV exporters quote delimiters and neutralize formula-leading text.
- Email delivery is explicitly unavailable and cannot be enabled. In-app notifications remain available. The medical certificate field is explicitly an HR review guideline rather than an automatically enforced rule.

## Deployment and verification

Merge the fixes into the branch watched by the existing Cloud Build trigger. This uses the current Cloud Run service and initialized Firestore database; do not recreate or erase the database. Existing sessions and records remain in the current namespace. The new attachment collection and employee sequence metadata are created through the existing transactional persistence.

The isolated HTTP tests use synthetic test-only local storage. They do not certify production IAM, multi-instance Firestore behavior, or all browser workflows. After deployment, verify personal-password setup, employee and administrator leave workflows, private downloads, notifications, and persistence through the live interface using clearly identified test records.
