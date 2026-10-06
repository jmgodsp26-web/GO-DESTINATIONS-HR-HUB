# GO Destinations HR Hub

## Authentication

React sends an email or employee ID and password to the Express backend. Passwords are verified with bcrypt (cost 12). Successful login returns a random opaque bearer token stored in browser sessionStorage. The backend keeps sessions only in memory: restart invalidates every session. Sessions expire after eight hours or two hours without authenticated API requests; background notification requests count as activity. There are no refresh tokens.

Temporary-password sessions may only read `/api/auth/me`, change their password, or log out. Password setup uses the authenticated restricted session; ordinary password changes also verify the current password. All password changes and admin resets revoke every session for the account and require signing in again. API middleware checks the current account status and admin role. No shared recovery password or name aliases are accepted.

## Run and configure

Use Node 22+, `npm ci`, `npm run dev`, or `npm run build` and `npm start`. Set configuration through your runtime environment (this server does not automatically load `.env` files).

Firestore uses the server-only Firebase Admin SDK and Application Default Credentials. On Cloud Run attach a dedicated service account with the minimum Firestore permissions required. For local cloud access set GOOGLE_APPLICATION_CREDENTIALS to a private service-account file outside the repository. The project/database are read from firebase-applet-config.json; GOOGLE_CLOUD_PROJECT can override the project. Never put service-account credentials in the frontend or Git.

Deploy the backend with its service account before deploying the deny-all firestore.rules. Admin SDK access uses IAM and does not depend on client rules. Deploy rules to the configured database using Firebase tooling/console. Verify writes and persistence with your production account before routing traffic. FIRESTORE_DISABLED=true enables isolated offline development; do not use it for production cloud persistence.

HR_DATA_DIR must point to a private persistent directory. Local JSON includes password hashes and HR data, uses restrictive file permissions, and is excluded from Git. It contains no session tokens. This remains a single-instance application; use a shared session/database design before horizontally scaling.

For a fresh installation only, set a strong unique BOOTSTRAP_ADMIN_PASSWORD (at least eight characters) to initialize the seeded HR admin igeguera@gmail.com. Sign in, change that temporary password, then remove the environment variable. Other seeded accounts have unknown random credentials and require an admin reset. Existing persisted/cloud account passwords remain authoritative; this variable does not reset existing accounts.

## Rollout from the previous version

Back up HR data privately before deployment. The deleted committed JSON snapshot must not be used as a deployment seed. Existing production data belongs on the private persistent volume or in Firestore. Previously public password hashes and session records remain in Git history: revoke sessions by restarting the patched backend, reset affected account passwords through a verified admin, and arrange history cleanup separately if needed. Removing the snapshot from the latest commit does not erase history. If admin access is lost, an authorized operator must update the admin credential record with a new bcrypt hash and mustChangePassword=true; there is deliberately no public recovery endpoint.

Deploy backend and Firestore rules together; confirm direct unauthenticated Firestore access is denied. Existing sessions require a new login. Run `npm run lint`, `npm test`, and `npm run build` before release.
