# Employee import

Administration → Employees → Import Employees reads only the first worksheet of an `.xlsx` workbook (maximum 5 MB, 200 employee rows). The Excel reader loads only when a file is selected. Workbook bytes stay in the browser; only reviewed employee fields are submitted.

Required headings: Name, Email Address, Department, Position, Location, Start Date. Phone Number and Birthdate are optional. Dates should be Excel dates or YYYY-MM-DD. Optional Role/Portal Role supports Admin or Administrator; an Admin marker in the first unlabeled column is also recognized. All other rows default to Employee. The Password column and policy notes are ignored.

Review the preview before importing. Correct missing emails, review full-access Admin roles, choose holiday calendars, and enter opening vacation/sick allowances. Unspecified vacation/sick days default to **0**, explicitly shown for review; notes are not interpreted as current balances. Other leave types follow the existing employee-creation rules. The South Africa → United States temporary mapping is an explicit button, never automatic. Department text is preserved.

The operator enters the temporary password once (12+ characters, maximum 72 UTF-8 bytes), confirms the review checkbox, and submits. Every new account must change its password at first login. No invitation emails are sent. Share access instructions through the company's approved channel.

Existing normalized names or emails (including disabled accounts) and repeats in the workbook are skipped. Existing records, credentials, roles and balances are not updated. A matching name with a different email is held for manual identity review, not silently merged.

The client refreshes the directory before submission. Server-side administrator authorization, field allowlisting, validation, duplicate checks and Firestore's transaction serialization remain authoritative. Each batch of up to five accounts commits atomically; completed batches remain saved if a later batch fails. Re-select/review the original workbook and retry after interruption: previously committed accounts are skipped. Results show created/skipped rows and never passwords. The password is cleared from component state when processing finishes and is never persisted to browser storage.

Validation covers parser mapping, names/email normalization, dates and allocations, server authorization, whole-batch rejection, retry deduplication, credential preservation and first-login password-change enforcement. Production employee records are not used for automated testing.
