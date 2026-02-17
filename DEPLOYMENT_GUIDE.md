# Campfire Skill Tree Deployment Guide (Beginner-Friendly)

This guide assumes:

1. Frontend is deployed on **Vercel**.
2. Backend/realtime/sync is deployed on **Convex**.
3. Google Sheets is the canonical source of truth.

If you follow this step-by-step, you can deploy from zero experience.

## 1. What You Are Deploying

You are deploying 3 connected pieces:

1. **Google Sheet**: where your event data lives.
2. **Convex**: stores realtime cache + runs sync jobs/webhook processing.
3. **Vercel (Next.js app)**: public leaderboard UI + admin dashboard UI.

Flow:

1. Sheet edits -> Apps Script webhook -> Convex -> website updates.
2. Admin edits in website -> Convex -> writes back to Sheet.
3. Convex also polls Sheet every 30s as a fallback.

## 2. Accounts and Tools You Need

Create these accounts first:

1. Google account (for Google Sheets + Apps Script + Google Cloud).
2. Convex account: [https://dashboard.convex.dev](https://dashboard.convex.dev)
3. Vercel account: [https://vercel.com](https://vercel.com)
4. GitHub account (repo hosting + Vercel import).

Install on your computer:

1. Node.js LTS (20+): [https://nodejs.org](https://nodejs.org)
2. pnpm:

```bash
npm install -g pnpm
```

## 3. Get the Project Running Locally Once

In terminal:

```bash
cd /path/to/your/repo
pnpm install
```

Start Convex dev setup (this links project + creates `.env.local` Convex fields):

```bash
pnpx convex dev
```

If prompted:

1. Choose `create a new project` (or existing if you already created one).
2. Choose `cloud deployment`.

Stop it with `Ctrl+C` after setup is complete.

## 4. Prepare Your Google Sheet

Your sheet URL looks like:

`https://docs.google.com/spreadsheets/d/18DMgukvpV4GIT1Wa2IsoIaFnioMIoKHlOTtWv3wmcEA/edit?...`

The **Spreadsheet ID** is the part between `/d/` and `/edit`:

`18DMgukvpV4GIT1Wa2IsoIaFnioMIoKHlOTtWv3wmcEA`

Keep this value. You will use it in Convex env vars.

Expected tabs:

1. `Skills`
2. `Attendees`
3. `Completions`

If missing, the admin dashboard has an `Init/Repair Sheet Schema` button.

## 5. Create Google Service Account (Required)

This lets Convex read/write your sheet.

### 5.1 Create service account key

1. Open [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create/select a project.
3. Go to `APIs & Services` -> `Library`.
4. Enable `Google Sheets API`.
5. Go to `IAM & Admin` -> `Service Accounts`.
6. Create a new service account.
7. Open that service account -> `Keys` -> `Add Key` -> `Create new key` -> JSON.
8. Save the JSON file securely.

### 5.2 Share the sheet with service account email

1. Open the JSON file.
2. Copy `client_email` (looks like `name@project.iam.gserviceaccount.com`).
3. Open your Google Sheet -> `Share`.
4. Add that email as **Editor**.

If this is not done, sync will fail with permission errors.

## 6. Set Convex Production Environment Variables

Important: Convex runs in the cloud. Local file paths like `service-accounts/xyz.json` are not available there.

Use Convex Dashboard UI:

1. Open your Convex deployment in dashboard.
2. Go to `Settings` -> `Environment Variables`.
3. Add these:

1. `GOOGLE_SPREADSHEET_ID` = your spreadsheet id
2. `GOOGLE_SERVICE_ACCOUNT_JSON` = full JSON file contents in one value
3. `SHEET_WEBHOOK_SECRET` = strong random secret

Generate a secret quickly:

```bash
openssl rand -base64 32
```

Optional CLI way for service account JSON:

```bash
npx convex env set GOOGLE_SERVICE_ACCOUNT_JSON "$(cat /absolute/path/to/service-account.json | tr -d '\n')"
```

## 7. Deploy Convex Functions

From repo root:

```bash
pnpm convex:deploy
```

After deploy, collect these from Convex dashboard:

1. `CONVEX_DEPLOYMENT` (deployment name)
2. `NEXT_PUBLIC_CONVEX_URL` (looks like `https://xxx.convex.cloud`)
3. `NEXT_PUBLIC_CONVEX_SITE_URL` (looks like `https://xxx.convex.site`)

You will use these in Vercel and Apps Script.

## 8. Install Apps Script Webhook in the Sheet

This makes sheet edits push instantly to Convex.

1. Open your Google Sheet.
2. Click `Extensions` -> `Apps Script`.
3. Replace script content with file contents from:

`/Users/adam/Developer/campfire-skill-tree/docs/apps-script-webhook.gs`

4. Edit these constants in script:

1. `CONVEX_WEBHOOK_URL` = `https://<your-deployment>.convex.site/sheet-webhook`
2. `SHEET_WEBHOOK_SECRET` = same value as Convex env var

5. Save script.
6. In Apps Script, add trigger:

1. `Triggers` (clock icon) -> `Add Trigger`
2. Function: `onEdit`
3. Event source: `From spreadsheet`
4. Event type: `On edit`

7. Authorize when prompted.

## 9. Deploy Frontend to Vercel

### 9.1 Import project

1. Push repo to GitHub.
2. In Vercel: `Add New...` -> `Project`.
3. Import repo.
4. Set Root Directory to this project folder (if monorepo warning appears).

### 9.2 Set Vercel environment variables

In Vercel project settings -> `Environment Variables`, add:

1. `NEXT_PUBLIC_CONVEX_URL` = from Convex deployment
2. `ADMIN_PASSCODE` = admin login password
3. `ADMIN_COOKIE_SECRET` = strong random secret

Generate `ADMIN_COOKIE_SECRET`:

```bash
openssl rand -base64 48
```

Then deploy.

## 10. First-Time Verification Checklist

After Vercel deploy finishes:

1. Open your Vercel URL.
2. `/` should show leaderboard.
3. `/admin` should redirect to login if not authenticated.
4. Login with `ADMIN_PASSCODE`.
5. In admin, check status banner shows poll times (not all `-`).
6. Click `Sync from Sheet` once.
7. Confirm rows appear.
8. Edit one sheet row and confirm site updates quickly.

## 11. Useful Runtime Commands

Check sync health:

```bash
pnpx convex run sync:getPublicSyncStatus '{}'
pnpx convex run admin:getSyncDiagnostics '{}'
```

Manually trigger sync:

```bash
pnpx convex run sync:requestImmediateSync '{"reason":"manual-check"}'
```

## 12. Common Problems and Fixes

### Problem: Leaderboard is blank

Check:

1. Convex env vars exist in Convex dashboard (`GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`).
2. Sheet is shared to service account email as Editor.
3. `sync:getPublicSyncStatus` shows recent `lastPollAt`.

### Problem: Webhook edits do nothing

Check:

1. Apps Script trigger exists and is enabled.
2. `CONVEX_WEBHOOK_URL` is correct `.convex.site/sheet-webhook` URL.
3. `SHEET_WEBHOOK_SECRET` matches exactly in script and Convex env.

### Problem: `/admin` login fails

Check:

1. `ADMIN_PASSCODE` in Vercel env.
2. `ADMIN_COOKIE_SECRET` in Vercel env.
3. Redeploy Vercel after env changes.

### Problem: Convex can sync in dev but not production

Cause: you used `GOOGLE_SERVICE_ACCOUNT_FILE` only locally.

Fix:

1. Set `GOOGLE_SERVICE_ACCOUNT_JSON` in Convex production env.
2. Deploy Convex again.

## 13. Security Checklist (Do This)

1. Never commit service account JSON to git.
2. Use strong secrets for webhook/admin/cookies.
3. Rotate secrets if shared accidentally.
4. Keep service account access limited to required sheet.
5. Use separate Convex dev and prod deployments.

## 14. Where to Access Everything

1. Public leaderboard: `https://<your-vercel-domain>/`
2. Admin login: `https://<your-vercel-domain>/admin`
3. Convex dashboard: `https://dashboard.convex.dev`
4. Google Sheet: your spreadsheet URL

## 15. One-Line Quick Start Summary

1. Configure Google service account + share sheet.
2. Set Convex env vars + deploy Convex.
3. Install Apps Script webhook trigger.
4. Set Vercel env vars + deploy Vercel.
5. Verify `/` and `/admin` and run one manual sync.
