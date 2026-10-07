#!/usr/bin/env bash
# Run in Google Cloud Shell from this repository. Never paste secrets into chat.
set -euo pipefail
set +x
cd "$(dirname "${BASH_SOURCE[0]}")/.."
trap 'unset HR_BOOTSTRAP_PASSWORD HR_CONFIRM_PASSWORD; printf "\nSetup stopped. Read the error above; no database was deleted.\nFor permission denied, use the project owner account or ask your Google Cloud administrator.\n" >&2' ERR
trap 'unset HR_BOOTSTRAP_PASSWORD HR_CONFIRM_PASSWORD' EXIT

command -v gcloud >/dev/null || { printf 'Open Google Cloud Shell to run this helper.\n'; exit 1; }
printf '\nGO Destinations HR Hub — guided deployment\n'
printf 'This creates or updates hr-hub on Cloud Run and uses a separate Firestore database.\nGoogle Cloud billing must be enabled. Existing database records are kept.\n\n'
HR_DEFAULT_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [[ "$HR_DEFAULT_PROJECT" == '(unset)' ]]; then HR_DEFAULT_PROJECT=''; fi
read -r -p "HR project ID [${HR_DEFAULT_PROJECT}]: " HR_PROJECT_ID
HR_PROJECT_ID="${HR_PROJECT_ID:-$HR_DEFAULT_PROJECT}"
[[ "$HR_PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,61}[a-z0-9]$ ]] || { printf 'Please enter a valid Google Cloud project ID.\n'; exit 1; }
HR_PROJECT_STATE="$(gcloud projects describe "$HR_PROJECT_ID" --format='value(lifecycleState)')"
[[ "$HR_PROJECT_STATE" == ACTIVE ]] || { printf 'This project is not active. Resolve its project status before deploying.\n'; exit 1; }
HR_BILLING_ENABLED="$(gcloud billing projects describe "$HR_PROJECT_ID" --format='value(billingEnabled)')"
[[ "${HR_BILLING_ENABLED,,}" == true ]] || { printf 'Enable billing for this project in Google Cloud, then run this helper again.\n'; exit 1; }
read -r -p 'Administrator company email: ' HR_ADMIN_EMAIL
[[ "$HR_ADMIN_EMAIL" =~ ^[^[:space:]@,]+@[^[:space:]@,]+\.[^[:space:]@,]+$ ]] || { printf 'Please enter a valid company email.\n'; exit 1; }
read -r -s -p 'Choose a unique temporary admin password (12+ characters): ' HR_BOOTSTRAP_PASSWORD
printf '\n'
read -r -s -p 'Type the password again: ' HR_CONFIRM_PASSWORD
printf '\n'
[[ ${#HR_BOOTSTRAP_PASSWORD} -ge 12 && "$HR_BOOTSTRAP_PASSWORD" == "$HR_CONFIRM_PASSWORD" && "$HR_BOOTSTRAP_PASSWORD" != [[:space:]]* && "$HR_BOOTSTRAP_PASSWORD" != *[[:space:]] ]] || { printf 'Passwords must match, have 12+ characters, and have no leading/trailing whitespace.\n'; exit 1; }
unset HR_CONFIRM_PASSWORD

HR_REGION=us-central1
HR_DATABASE=hr-hub
HR_SERVICE=hr-hub
HR_RUNTIME_SA="hr-hub-backend@${HR_PROJECT_ID}.iam.gserviceaccount.com"
printf '\n1/5 Enabling Google Cloud services...\n'
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com secretmanager.googleapis.com iam.googleapis.com --project="$HR_PROJECT_ID" --quiet

printf '\n2/5 Preparing the HR database...\n'
HR_DATABASES="$(gcloud firestore databases list --project="$HR_PROJECT_ID" --format='value(name)')"
if printf '%s\n' "$HR_DATABASES" | grep -q "/databases/${HR_DATABASE}$"; then
  printf 'Using the existing hr-hub database. Its records and administrator password are preserved.\n'
else
  gcloud firestore databases create --project="$HR_PROJECT_ID" --database="$HR_DATABASE" --location="$HR_REGION" --type=firestore-native --quiet
fi

printf '\n3/5 Setting the backend and build permissions...\n'
HR_ACCOUNTS="$(gcloud iam service-accounts list --project="$HR_PROJECT_ID" --format='value(email)')"
if ! printf '%s\n' "$HR_ACCOUNTS" | grep -q -F -x "$HR_RUNTIME_SA"; then
  gcloud iam service-accounts create hr-hub-backend --project="$HR_PROJECT_ID" --display-name='HR Hub backend' --quiet
fi
gcloud projects add-iam-policy-binding "$HR_PROJECT_ID" --member="serviceAccount:${HR_RUNTIME_SA}" --role=roles/datastore.user --condition=None --quiet >/dev/null
HR_PROJECT_NUMBER="$(gcloud projects describe "$HR_PROJECT_ID" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$HR_PROJECT_ID" --member="serviceAccount:${HR_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role=roles/run.builder --condition=None --quiet >/dev/null

printf '\n4/5 Storing the initial password privately...\n'
# A unique bootstrap secret avoids replacing any existing secret or secret version.
HR_SECRET_NAME="hr-hub-bootstrap-$(date -u +%Y%m%d%H%M%S)-${RANDOM}"
printf '%s' "$HR_BOOTSTRAP_PASSWORD" | gcloud secrets create "$HR_SECRET_NAME" --project="$HR_PROJECT_ID" --replication-policy=automatic --data-file=- --quiet >/dev/null
unset HR_BOOTSTRAP_PASSWORD
gcloud secrets add-iam-policy-binding "$HR_SECRET_NAME" --project="$HR_PROJECT_ID" --member="serviceAccount:${HR_RUNTIME_SA}" --role=roles/secretmanager.secretAccessor --quiet >/dev/null

printf '\n5/5 Building and publishing your app (this may take several minutes)...\n'
gcloud run deploy "$HR_SERVICE" --project="$HR_PROJECT_ID" --source . --region="$HR_REGION" --service-account="$HR_RUNTIME_SA" --allow-unauthenticated --ingress=all --min=0 --max=3 --memory=512Mi --set-env-vars="GOOGLE_CLOUD_PROJECT=${HR_PROJECT_ID},FIRESTORE_DATABASE_ID=${HR_DATABASE},INITIAL_ADMIN_EMAIL=${HR_ADMIN_EMAIL},INITIAL_ADMIN_NAME=HR Administrator" --set-secrets="INITIAL_ADMIN_PASSWORD=${HR_SECRET_NAME}:1" --quiet
HR_RUN_URL="$(gcloud run services describe "$HR_SERVICE" --project="$HR_PROJECT_ID" --region="$HR_REGION" --format='value(status.url)')"
[[ "$HR_RUN_URL" == https://* ]] || { printf 'Cloud Run did not return an HTTPS app URL.\n'; exit 1; }
gcloud run services update "$HR_SERVICE" --project="$HR_PROJECT_ID" --region="$HR_REGION" --update-env-vars="APP_ORIGIN=${HR_RUN_URL}" --quiet
printf '\nYour HR Hub is deployed:\n%s\n\n' "$HR_RUN_URL"
printf 'Sign in with the company email and temporary password you entered.\nChoose a personal password, then sign in again.\nIf this database was already initialized, use your existing personal password.\n\n'
printf 'After successful first login, remove the initial-password configuration:\n'
printf 'gcloud run services update hr-hub --project=%s --region=us-central1 --remove-env-vars=INITIAL_ADMIN_EMAIL,INITIAL_ADMIN_NAME --remove-secrets=INITIAL_ADMIN_PASSWORD\n\n' "$HR_PROJECT_ID"
printf 'Next: connect hr.godestinationservices.com using step 7 in docs/DEPLOYMENT.md.\n'
printf 'Keep this URL open and verify login before changing GoDaddy DNS.\n'
