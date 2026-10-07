# GO Destinations HR Hub

The existing React HR portal with company email/password login, an Express API, and server-only Firestore persistence. The fresh installation creates one administrator and no seeded employees, leave records, or holidays. Existing collections are not imported or erased.

Follow [the step-by-step deployment guide](docs/DEPLOYMENT.md) to deploy from GitHub and connect `hr.godestinationservices.com`.

## Authentication components and request flow

- `src/components/auth/LoginPage.tsx`: company email and password form.
- `src/services/api.ts`: same-origin API calls with cookies; no JavaScript-accessible authentication token.
- `src/context/AuthContext.tsx`: restores the current user via `/api/auth/me` and forces temporary-password setup.
- `server.ts`: login/logout endpoints, authorization, origin checks, cookie settings, request limits, and transactional response handling.
- `server/db.ts`: bcrypt password verification, account status/role checks, password changes, and session revocation.
- `server/persistence.ts`: Firestore transactions and a fresh `hr_v2_` collection namespace.
- `server/firestore.ts`: Firebase Admin SDK with Application Default Credentials. This app does not use Firebase Authentication or Google Workspace SSO.

Login posts email/password over HTTPS to `/api/auth/login`. The backend normalizes the email, looks up an HR-created account, and verifies its bcrypt hash (cost 12). It issues a random 256-bit opaque session token in the `__session` cookie: HttpOnly, Secure, SameSite=Lax, host-only, eight-hour lifetime. The response contains the user and password-change flag, never the token. Firestore stores only the SHA-256 token digest and session metadata. Sessions survive restarts and are shared across instances; they expire after eight hours or two hours without authenticated requests. Background API polling counts as activity. There are no refresh tokens.

Each authenticated request loads account/session state in a Firestore transaction. Middleware rejects expired sessions and disabled accounts, then applies administrative permissions. Temporary-password sessions can only inspect their account, set a personal password, or log out. Password changes and HR resets revoke all sessions for the account. All passwords require at least 12 characters. The login page accepts email only; HR must create the account first. There is no public registration, email verification, email delivery, or self-service password recovery. HR distributes unique temporary passwords privately and performs resets through the admin screen.

The response is sent only after the transaction succeeds. Failed operations roll back; database outages fail closed instead of silently saving to container disk. API responses use `private, no-store`. POST requests require JSON and reject an unexpected browser Origin. Login limits are per IP, per service instance; these limits are not a distributed account lockout.

## Credentials and first administrator

Set `GOOGLE_CLOUD_PROJECT`, `FIRESTORE_DATABASE_ID`, and `APP_ORIGIN` explicitly. On the first boot only, set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD`. The password must be unique and at least 12 characters; store it in Secret Manager, never Git or chat. First login requires a personal password. Remove the bootstrap environment variables/secret mapping after setup. They do not reset existing accounts.

Attach a dedicated Cloud Run service account with Firestore access. Do not create a service-account JSON key for Cloud Run. For local cloud development, use `gcloud auth application-default login`; protect any private key file outside this repository if your organization requires one. Firestore client rules deny all access; the Admin SDK uses IAM. Never ship Admin SDK credentials to the frontend.

## Development and verification

Use Node 22+. `npm ci`, `npm run lint`, `npm run build`, then `npm test`. Runtime configuration comes from environment variables; `.env.example` documents them. Environment files are not loaded automatically. The cookie is Secure outside isolated tests, so use HTTPS for browser development.

Tests use `NODE_ENV=test` and an isolated temporary JSON store, never production disk persistence. To run the same lifecycle against an already-running local Firestore emulator, use `HR_AUTH_TEST_EMULATOR=127.0.0.1:8089 npm test`. This deletes data only in the emulator project `demo-hr-auth-tests`. Tests cover a clean database, temporary-password restrictions, password/reset/logout revocation, roles, CSRF origin checks, password hashing, token digests, leave creation, and restart persistence.

## Operating limits

This implementation is intended for a small HR team. Every API request reads the complete HR dataset and serializes committed operations through a metadata document. That preserves the original synchronous business logic and prevents lost updates, but incurs reads proportional to stored records and limits concurrent throughput. Load-test with your expected employee/document history before broad rollout; a larger organization should use targeted database queries/transactions. Documents remain stored inline with the existing upload size limit. Configure Firestore backups and billing alerts before entering real HR data.

Earlier commits may contain historical HR snapshots/password hashes. Removing the snapshot from the current tree does not erase Git history. This fresh namespace does not reuse those credentials or sessions. Arrange private backup/history cleanup separately if needed.
