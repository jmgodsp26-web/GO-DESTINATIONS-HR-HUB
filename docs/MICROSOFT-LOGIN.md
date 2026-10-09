# Microsoft company login

Microsoft login is optional and fails closed until all four environment settings below are present. Existing HR Hub password login remains available during rollout. This does not by itself enforce MFA: Entra must apply the company's MFA policy, and the retained password login is a separate sign-in path. An MFA-only rollout needs a deliberate fallback and administrator recovery plan.

## Browser setup

1. In Entra App registrations, register a single-tenant Web app. Use only the company's tenant; this app never uses the common or organizations endpoint.
2. Set the Web redirect URI to `https://hr.godestinationservices.com/api/auth/microsoft/callback`. Leave implicit access/ID token grants and public client flows disabled. No Microsoft Graph/mail/calendar permissions are required by this implementation: it requests only `openid profile`.
3. Create a client secret and store its **Value**, not its Secret ID, in Google Secret Manager as `hr-hub-microsoft-client-secret`. Do not send the value through chat, commit it, put it in frontend variables, or include it in a screenshot. Track its expiration and rotate it before expiry.
4. On that secret's Permissions tab, grant the Cloud Run runtime account `hr-hub-backend@gen-lang-client-0251250394.iam.gserviceaccount.com` **Secret Manager Secret Accessor** for this secret.
5. Cloud Run → hr-hub → Edit & deploy new revision → container Variables & Secrets. Preserve existing variables and add:

| Environment variable | Value |
| --- | --- |
| `APP_ORIGIN` | `https://hr.godestinationservices.com` (no trailing slash) |
| `MICROSOFT_TENANT_ID` | `5435dd0c-e8ac-49f5-a4de-ed8654c4672e` |
| `MICROSOFT_CLIENT_ID` | `e9f5bd46-dcfc-4d66-9199-2482af5a09eb` |

Under Secrets exposed as environment variables, add `MICROSOFT_CLIENT_SECRET` mapped to `hr-hub-microsoft-client-secret`, version 1 (or the intended enabled version). Do not paste its value as a plain environment variable. Deploy the revision after the code build succeeds. Keep port 8080 and existing command/arguments unchanged.

## Approve each employee

There is no automatic registration or email-based linking. An administrator must first add the employee in HR Hub, then approve that specific Entra user identity:

1. Entra → Users → All users → select the employee → Overview → copy the **user's Object ID**. It is not the Object ID of the HR HUB application or enterprise application.
2. HR Hub → Employees → Edit the existing employee → Microsoft user ID → paste that ID → Save.
3. The backend stores the configured tenant ID with that user ID, rejects duplicate links and records an audit event. Editing/removing the link revokes that employee's existing sessions; linking your own admin record signs you out, so keep your working HR Hub password during rollout.
4. Open the custom domain and click Sign in with Microsoft. A valid Microsoft identity is allowed only if there is exactly one linked, active HR Hub account with an accepted role. Existing roles and HR records remain unchanged.
5. Disabling/deleting the HR Hub employee prevents Microsoft login. Clearing the link also revokes existing HR Hub sessions. Entra deactivation by itself does not instantly revoke a previously issued HR Hub session: disable the employee in HR Hub during offboarding too. HR Hub retains its existing 8-hour absolute and 2-hour idle session limits.

## Technical controls and validation

Authorization code flow with PKCE S256; browser-bound HttpOnly/Secure/SameSite=Lax state cookie; random nonce; one-time 10-minute flow records consumed atomically before token exchange across instances. Fixed HTTPS return origin, fixed tenant-specific Microsoft endpoints and signing-key endpoint. JOSE verifies RS256 signature, issuer, audience, expiration, nonce, tenant, user Object ID and token version. Email/UPN and display name never grant access. No Microsoft tokens or secrets go to the frontend, database sessions, URLs or application logs; Microsoft access/refresh tokens are not retained and no offline access is requested.

Microsoft sessions use existing server-side hashed session tokens and the same HR authorization checks. They do not require changing an unused temporary HR Hub password; password-authenticated sessions retain the existing temporary-password restriction. Password credentials/flags are not silently changed by Microsoft login.

Tests use generated signing keys, synthetic identities and local isolated persistence. They exercise bad signatures/claims, expired tokens, incorrect tenant/audience/nonce, unlinked/disabled/invalid-role accounts, duplicate linking, session revocation, single-use persisted flows, browser-cookie mismatch, concurrent callbacks, cancellation and unchanged password onboarding. A real Entra login and MFA challenge still require live configuration and a approved test user's browser; passing local tests is not evidence that MFA is enforced in the tenant.
