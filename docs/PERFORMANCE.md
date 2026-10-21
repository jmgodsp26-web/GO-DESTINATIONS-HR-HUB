# HR Hub performance changes

## October 22 performance pass

The first pass removed unnecessary metadata writes and reduced page-read collection counts. This pass addresses repeated dashboard requests, document bytes, historical records during saves and uncompressed downloads.

- Personal dashboard core data now loads through one authenticated endpoint instead of four requests. Administration core data uses one endpoint instead of three. Documents and staffing detail load after the useful summary.
- Both endpoints reuse the existing data selectors. My Workspace remains restricted to the current employee, including when that employee is an administrator. The administration endpoint requires current administrator permissions.
- Identical in-flight JSON requests share one network call. Dashboard responses alone are retained for five seconds in bounded memory. Writes, manual refresh, focus and visibility changes clear the cache. Authentication changes reset its identity and discard late responses from the former session. HR responses and credentials are never persisted by this cache.
- Document lists fetch metadata rather than inline file contents. The selected file is fetched for preview/download. Legacy records are annotated with availability and MIME fields on a successful read, using merge writes that preserve the original bytes. At most 100 legacy annotations are written per transaction. Legacy file-returning endpoints remain compatible.
- Leave submissions read the current employee's balances and request history. Reviews and cancellations read the selected request and that employee's balances. Ledger, audit and new attachment rows are appended without scanning their history. The metadata serialization barrier and atomic approval/balance checks remain in place.
- Reviewed holiday and document writes load related collections only. Unknown operations retain the broad transaction path. Only loaded rows participate in deletion diffs.
- Onboarding summary counts no longer construct complete plan views or load file/message collections.
- Static text assets are compressed during the build with Brotli and gzip. Request handlers negotiate the encoding and preserve content type, Vary and immutable caching. Large authenticated JSON responses use async gzip when accepted, while retaining private/no-store headers. Small responses avoid compression overhead.
- Authenticated API responses include a numeric Server-Timing duration to help distinguish application processing time from transfer/network delay.

## Verification

- TypeScript and production build: passed.
- Automated suite: 137 tests passed, including dashboard HTTP privacy, current balances, cache invalidation, document ownership, compressed response integrity and encoding negotiation.
- Real persistence-adapter tests verify file-byte preservation, metadata-only queries, scoped leave accounting and retention of unrelated/historical records. A fixture with ten 300 KB documents returns under 5 KB of projected metadata.
- The live site previously returned its main JavaScript uncompressed despite accepting gzip/Brotli. The new build's main JavaScript is 453,099 bytes raw and 130,254 bytes with Brotli (71.3% smaller).

The repeatable local HTTP comparison uses 90 synthetic accounts, temporary file persistence and loopback networking. Each employee loads the same core data using either four separate endpoints or the combined endpoint. The table records completed core dashboard time, not individual API latency.

| Concurrent users | Mode | Requests | Failures | Median dashboard | 95th percentile dashboard |
| --- | --- | --- | --- | --- | --- |
| 3 | separate core requests | 12 | 0 | 52 ms | 65 ms |
| 3 | combined dashboard | 3 | 0 | 26 ms | 29 ms |
| 30 | separate core requests | 120 | 0 | 261 ms | 419 ms |
| 30 | combined dashboard | 30 | 0 | 55 ms | 106 ms |
| 90 | separate core requests | 360 | 0 | 620 ms | 1063 ms |
| 90 | combined dashboard | 90 | 0 | 155 ms | 276 ms |

These are isolated local timings, not Cloud Run/Firestore capacity certification. The adapter tests use a Firestore test double and do not measure real database latency, locking or index configuration. No production employee data or credentials were used. A saved holiday was also confirmed visible to another synthetic employee.

```sh
npm run lint
npm run build
npm test
node --import tsx scripts/check-local-capacity.mjs
```

## Remaining live checks

Measure authenticated dashboard and mutation p50/p95 time, error rates, transaction retries, CPU/memory and cold starts in a separate staging project with synthetic data and the production Firestore schema. Include simultaneous sign-ins, ordinary reads and approvals at 3, 30 and 90 users. Complete the authenticated browser walkthrough for employee/admin controls.

Cloud Run/Firestore locations, minimum instances and scaling limits require cloud access and have not been changed. Keeping a minimum instance can reduce cold starts and affects hosting cost. Duplicate regional build triggers previously failed independently of the serving us-central1 deployment.

Remaining limits include broad reads for unreviewed operations, non-paginated historical views and synchronous bcrypt authentication checks. This release does not promise zero delay or certify a complete 90-person production workload.

References:
- https://googleapis.dev/nodejs/firestore/latest/Query.html
- https://firebase.google.com/docs/firestore/transaction-data-contention
- https://docs.cloud.google.com/run/docs/configuring/min-instances
