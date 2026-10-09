# HR Hub security hardening

This change addresses the confirmed application findings from the October 9 audit. Existing employee records, leave policy, balances, approvals and company settings are preserved. No database recreation is required.

## Changes

- Only `admin` and `employee` roles are accepted on account creation/update. Unknown roles cannot authenticate, use an existing session or read leave requests. Account identifiers and credential flags cannot be injected into profile updates.
- Production CSP allows same-origin scripts, the existing Google fonts, HTTPS avatars, data/blob images and inline styling used by the UI animation/layout. Inline scripts, objects, external connections and framing are blocked. Local Vite development keeps its preview/HMR behavior.
- The existing compatibility script is an external frontend asset. Backend output is built into `build/server.cjs`, outside the frontend directory, without a source map. Static serving is restricted to frontend assets and named public files. Backend and source-map requests return 404.
- Login counters are stored in `hr_v2_loginAttempts` through the same transaction barrier as sessions. Failed login responses commit counters and security audit events; other failed HR operations continue to roll back. Accounts receive 20 attempts per 15-minute window across IPs/instances. Success clears the account counter. The shared IP limit is 1,000 attempts per window, with a matching per-instance abuse guard. Counters use SHA-256 fingerprints, not plaintext emails/IPs, and expired rows are removed during normal transactions.
- Sign-in success/failure events are available in Activity Log. No passwords or session tokens are logged. Unauthenticated private API calls are rejected before loading the full HR database.
- The coarse general API guard allows 10,000 requests/15 minutes per IP to accommodate existing notification polling from a shared office. This is a local abuse guard, not a distributed denial-of-service defense.
- Unused Firebase client and Gemini dependencies are removed. The remaining gaxios dependency uses patched UUID 11 through a targeted override. Firebase Admin uses the Cloud Run identity as before.

## Validation

63 tests cover existing HR workflows plus invalid roles, account identity tampering, stale invalid-role sessions, persisted throttling across restarts/IPs, concurrent login limits, shared-office sign-ins, safe asset serving and CSP. TypeScript, production build and dependency audit are also checked. Tests use synthetic local data; no production employee records are created or modified.

## Deployment

The Docker entry point now uses `build/server.cjs`. Rebuild from this repository's Dockerfile; do not reuse an old image or a manually overridden `dist/server.cjs` command. The frontend assets retain the approved design. Verify CSP and X-Frame-Options on the live response, `/server.cjs` and `/server.cjs.map` returning 404, and the existing health endpoint returning OK.

## Cloud settings still require verification

The repository cannot prove deployed Firestore rules, IAM grants, backup configuration or historical access logs. Do not treat these as fixed by this code change.

1. In the `hr-hub` Firestore database, verify that the repository's deny-all client rules are deployed. The backend Admin SDK uses IAM and bypasses those rules.
2. Separate the Cloud Build/deployment service account from the Cloud Run runtime identity. Move the trigger to a dedicated deployer and verify a deployment before removing deployment/image-upload privileges from the runtime account. Keep the runtime's necessary database access and any still-required secret access.
3. After the initial admin's personal password works, remove bootstrap environment/secret bindings following `DEPLOYMENT.md`. Do not remove the initialized database.
4. Enable backups and perform an isolated restore test. Enable appropriate security log retention/alerts and monitor failed sign-ins.
5. Admin MFA is recommended as a separately planned authentication feature. It is not implemented or claimed by this patch; enrollment/recovery require a deliberate rollout.

The audit does not prove that no historical compromise occurred. These changes reduce confirmed risks; they are not a guarantee against every attack.
