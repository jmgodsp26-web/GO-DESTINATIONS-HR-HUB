# Publish the fresh HR Hub

Use company email + password. Employees must be added by HR. Keep the existing UI. Start with an empty employee database. These instructions deploy the code from GitHub; Google AI Studio is not required.

## Easiest setup: guided Cloud Shell helper

Sign in to Google Cloud with the HR project's owner account, select an active billing-enabled project, and open Cloud Shell using the terminal icon. Paste:

```bash
HR_SETUP_DIR="$(mktemp -d -t hr-hub-setup-XXXXXXXX)" && git clone --branch rebuild/company-email-hr-hub https://github.com/jmgodsp26-web/GO-DESTINATIONS-HR-HUB.git "$HR_SETUP_DIR" && bash "$HR_SETUP_DIR/scripts/easy-deploy.sh"
```

The helper asks for your project ID, administrator company email, and a hidden temporary password. It enables services, prepares Firestore, creates the runtime identity, configures build/database permissions, stores the bootstrap password in Secret Manager, builds the app, and prints the working HTTPS URL. No old database is deleted. If the `hr-hub` database already contains app records, they are kept, and its existing admin password remains authoritative.

Use a dedicated HR project because the runtime Firestore grant is project-wide. Google Cloud charges apply. If permission is denied or billing is disabled, the helper stops with the error; it cannot bypass account restrictions. IAM grants may need a few minutes to propagate before a retry succeeds.

Open the printed URL, sign in, choose your personal password, and sign in again. Run the cleanup command printed at the end after successful login. Then follow **step 7** below to connect your subdomain. The helper publishes the real app on Cloud Run; it does not use the sample-data design preview or automatically change GoDaddy DNS.

The helper has been checked locally with mocked Google Cloud commands. Actual cloud deployment requires your authorized Google Cloud account.

## 1. Choose an active project

Open https://console.cloud.google.com/ and select your intended HR project. It must be active, have billing enabled, and allow you to deploy/manage IAM. If it is suspended, resolve the suspension first; redeploying cannot fix a suspended project. Do not assume the earlier My Maps suspension belongs to this HR project.

Use the project owner account for this initial setup. A permission-denied error is a Google Cloud IAM problem; it is not a GoDaddy domain problem. Stop on any failed command and resolve that specific error before proceeding.

Open Cloud Shell (terminal icon at the top). Replace the example project ID below with the ID you selected:

```bash
export HR_PROJECT_ID='YOUR_ACTIVE_PROJECT_ID'
gcloud config set project "$HR_PROJECT_ID"
gcloud auth list
```

Confirm the active account and project are yours.

## 2. Get the prepared code

```bash
git clone --branch rebuild/company-email-hr-hub https://github.com/jmgodsp26-web/GO-DESTINATIONS-HR-HUB.git hr-hub-fresh
cd hr-hub-fresh
```

If this folder already exists, use a different new folder name. After the rebuild PR is merged, you can use `main` instead of the branch.

## 3. Enable services and create the empty database

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com secretmanager.googleapis.com iam.googleapis.com

gcloud firestore databases create --database=hr-hub --location=us-central1 --type=firestore-native
```

This creates a separate database named `hr-hub`. If that name already exists, check that database before using it: it must have no `hr_v2_` data if you want a fresh installation. Do not delete an existing database to follow this guide.

In Firebase Console https://console.firebase.google.com/ add Firebase to this same existing Google Cloud project if it is not listed. Select the project, open Firestore Database, select `hr-hub`, and publish the contents of `firestore.rules` under Rules. These rules deny browser/client access; the backend uses its service account.

## 4. Create the backend identity and grant build access

```bash
gcloud iam service-accounts create hr-hub-backend --display-name='HR Hub backend'
export HR_RUNTIME_SA="hr-hub-backend@${HR_PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$HR_PROJECT_ID" --member="serviceAccount:${HR_RUNTIME_SA}" --role=roles/datastore.user
export HR_PROJECT_NUMBER="$(gcloud projects describe "$HR_PROJECT_ID" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$HR_PROJECT_ID" --member="serviceAccount:${HR_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role=roles/run.builder
```

If the backend service account already exists, skip its creation and set the variable/grants. The database grant is project-wide: use this project for HR only, or have an administrator scope it to the HR database. IAM changes may take a few minutes to propagate. Restricted organization policies may require an administrator. Do not grant blanket Editor access to solve errors.

## 5. Set the first administrator privately

Enter the company email that will administer HR. The password prompt below hides what you type; use a unique temporary password of at least 12 characters. Do not send it in chat.

```bash
read -r -p 'First HR administrator company email: ' HR_ADMIN_EMAIL
read -r -s -p 'Unique temporary admin password (12+ characters): ' HR_BOOTSTRAP_PASSWORD
printf '\n'
printf '%s' "$HR_BOOTSTRAP_PASSWORD" | gcloud secrets create hr-hub-bootstrap --replication-policy=automatic --data-file=-
unset HR_BOOTSTRAP_PASSWORD
gcloud secrets add-iam-policy-binding hr-hub-bootstrap --member="serviceAccount:${HR_RUNTIME_SA}" --role=roles/secretmanager.secretAccessor
```

If that secret already exists, do not overwrite blindly. Confirm it is your intended bootstrap secret and add a new version privately if needed. This secret initializes an empty database only; it cannot reset an existing admin.

## 6. Deploy Cloud Run

```bash
gcloud run deploy hr-hub --source . --region=us-central1 --service-account="$HR_RUNTIME_SA" --allow-unauthenticated --ingress=all --min=0 --max=3 --memory=512Mi --set-env-vars="GOOGLE_CLOUD_PROJECT=${HR_PROJECT_ID},FIRESTORE_DATABASE_ID=hr-hub,INITIAL_ADMIN_EMAIL=${HR_ADMIN_EMAIL},INITIAL_ADMIN_NAME=HR Administrator" --set-secrets=INITIAL_ADMIN_PASSWORD=hr-hub-bootstrap:latest
```

Allow public Cloud Run access so browsers can reach the login screen. The app itself checks company credentials for HR data. Public access does not make Firestore records public.

Wait for a successful deployment. Get and configure its exact HTTPS URL:

```bash
export HR_RUN_URL="$(gcloud run services describe hr-hub --region=us-central1 --format='value(status.url)')"
gcloud run services update hr-hub --region=us-central1 --update-env-vars="APP_ORIGIN=${HR_RUN_URL}"
printf '%s\n' "$HR_RUN_URL"
```

Open that URL. Sign in using the company email and temporary password. Set your personal password, then sign in again. Confirm Employees shows only your administrator. Add a test employee with a unique temporary password; verify their password setup and login before entering real HR data.

If the service fails to start, open Cloud Run → hr-hub → Logs. A Firestore permission error means the runtime service account/database configuration needs fixing. A missing bootstrap variable means step 5/6 was incomplete. Check your own project; do not guess from a different project's logs.

## 7. Connect the subdomain through Firebase Hosting

This avoids relying on the Cloud Run Domain Mapping service list. Cloud Run serves the whole app; Firebase Hosting forwards requests to it, including the special `__session` login cookie.

1. Firebase Console → your project → Hosting. Create an additional Hosting site with a unique site ID (for example, a short unique HR site name). Use a new site so this deployment does not replace another website.
2. In Cloud Shell, install the Firebase CLI and sign in:

```bash
npm install -g firebase-tools
firebase login --no-localhost
read -r -p 'New Firebase Hosting site ID: ' HR_HOSTING_SITE
export HR_HOSTING_SITE
node --input-type=module -e 'import fs from "node:fs"; const c=JSON.parse(fs.readFileSync("firebase.json","utf8")); c.hosting.site=process.env.HR_HOSTING_SITE; fs.writeFileSync("firebase.json",JSON.stringify(c,null,2)+"\n");'
firebase deploy --only hosting --project "$HR_PROJECT_ID"
```

3. Before testing the Hosting URL, configure the matching origin:

```bash
gcloud run services update hr-hub --region=us-central1 --update-env-vars="APP_ORIGIN=https://${HR_HOSTING_SITE}.web.app"
```

4. Open `https://YOUR_SITE_ID.web.app` and verify login.
5. In that Hosting site's dashboard, click Add custom domain and enter `hr.godestinationservices.com`.
6. Open GoDaddy → your domain → DNS. Add the exact verification TXT and routing records Firebase displays. For the subdomain the Host/Name is normally `hr`; use the wizard's values. Remove only conflicting records for this same `hr` hostname. Leave mail/MX records and the main website records intact. Do not copy an IP from an unrelated guide.
7. Wait until Firebase reports the domain connected and its HTTPS certificate ready. Then set the final origin:

```bash
gcloud run services update hr-hub --region=us-central1 --update-env-vars=APP_ORIGIN=https://hr.godestinationservices.com
```

8. Open https://hr.godestinationservices.com/ and verify admin login, employee login, logout, and a test leave request. With this strict origin setting, perform sign-ins at this final domain; POST requests from other service/Hosting hostnames are intentionally rejected.

## 8. Remove bootstrap configuration and finish setup

After the administrator personal password works:

```bash
gcloud run services update hr-hub --region=us-central1 --remove-env-vars=INITIAL_ADMIN_EMAIL,INITIAL_ADMIN_NAME --remove-secrets=INITIAL_ADMIN_PASSWORD
```

Keep the initialized database; this does not erase data or reset passwords. Configure Firestore backups and billing alerts. Add employees in Employee Management using their company emails and unique temporary passwords; share those credentials privately. Employees must choose personal passwords at first login. Set leave balances and company holidays before approving real requests.

No automated invitation email or public signup is configured. If someone forgets their password, an HR administrator issues a new unique temporary password through Employee Management. The app does not authenticate against your email mailbox or Google Workspace.

## Official references

- Source deployment and required IAM: https://docs.cloud.google.com/run/docs/deploying-source-code
- Secret Manager integration: https://docs.cloud.google.com/run/docs/configuring/services/secrets
- Firebase Hosting → Cloud Run: https://firebase.google.com/docs/hosting/cloud-run
- Hosting cookie forwarding: https://firebase.google.com/docs/hosting/manage-cache
- Custom domains: https://firebase.google.com/docs/hosting/custom-domain
