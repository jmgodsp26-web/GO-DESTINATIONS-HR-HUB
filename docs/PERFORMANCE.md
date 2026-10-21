# HR Hub performance changes

## What caused avoidable work

Every authenticated request loaded all 19 HR collections in a Firestore transaction. Successful page reads also rewrote the shared metadata document and read every session. This made unrelated readers compete with writes and transferred records and attachments unrelated to the page.

Notification checks ran every 10 seconds, including hidden tabs, and sign-in waited for notifications before finishing. Holiday saves reloaded holidays, staffing coverage and the complete employee directory.

## Changes

- Reviewed GET/HEAD routes load their required collections plus users and the current session. Unknown routes retain the full collection set until reviewed.
- Page reads update the current session's activity without rewriting unchanged metadata or reading/writing other sessions. Current account status, role, password-change requirements and expiry checks still run for every request.
- The persistence adapter only diffs collections it loaded. It cannot interpret omitted collections as deletions.
- Business writes retain complete transactions and the shared serialization barrier. No leave accounting or approval policy changes.
- Notification reads still persist onboarding reminders and daily deduplication atomically. Polling runs every 60–70 seconds while visible, pauses while hidden, resumes on return, and does not overlap requests. Opening notifications can still refresh immediately.
- Sign-in does not wait for the notification list.
- Holiday save/edit/toggle uses the confirmed server response immediately and refreshes staffing separately. It avoids reloading employees after each change. A failed refresh reports that the change was saved and the staffing view needs refreshing.
- Existing database startup checks its initialization marker instead of downloading every collection. New-database initialization retains the overwrite guard.
- Hashed JavaScript/CSS assets cache for one year. Authenticated API responses remain private/no-store; HTML is not made immutable.

## Verification on 2026-10-21

- TypeScript check: passed.
- Production build: passed.
- Automated suite: 127 tests passed, including cancellation through the browser API, privacy, balance accounting, authentication, announcements, onboarding and new persistence-adapter regression tests.
- The adapter test exercises 90 concurrent distinct sessions; each reads four resources for its balance page and writes only its own session. The Firestore adapter test double verifies API usage and data preservation, not Firestore latency or locking implementation.
- Local HTTP load test uses 90 synthetic accounts, temporary file persistence and loopback networking. Production credentials/data are never used. It also checks that a saved holiday is visible to another employee.

| Concurrent users | Requests | Failures | Median response | 95th percentile |
| --- | --- | --- | --- | --- |
| 3 | 12 | 0 | 55 ms | 85 ms |
| 30 | 120 | 0 | 490 ms | 741 ms |
| 90 | 360 | 0 | 909 ms | 1,607 ms |

These local timings are **not** a Cloud Run/Firestore benchmark, a before/after comparison, or a production capacity guarantee.

Run locally:

```sh
npm run lint
npm run build
npm test
node --import tsx scripts/check-local-capacity.mjs
```

## Remaining live verification

Measure authenticated dashboard loading and holiday/leave writes in a separate staging project with synthetic data and the production Firestore schema. Ramp to 3, 30 and 90 users and measure p50/p95 response time, error rate, transaction retries, cold starts and CPU/memory. Include simultaneous sign-ins and a mix of reads and writes; do not load-test employee production data.

Verify Cloud Run and Firestore locations, instance limits, and cold-start behavior. A minimum Cloud Run instance can reduce cold starts but changes hosting cost; it is not configured by this code change. Other Cloud Build regional triggers previously failed; only the serving service's deployment establishes release status.

Remaining architectural limits: business writes still load the full store; document listing still loads document bytes on the server before stripping them; large historical collections and bursts of bcrypt password checks can add latency. Route-specific writes, document metadata/blob separation and paginated histories should follow measured staging results. Do not represent this release as a promise of zero delay or complete browser coverage.

Reference: https://firebase.google.com/docs/firestore/transaction-data-contention

Reference: https://docs.cloud.google.com/run/docs/configuring/min-instances
