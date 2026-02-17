# Campfire Skill Tree (Realtime)

Next.js + Convex app for a keyboard-first admin dashboard and public realtime leaderboard, with Google Sheets as the canonical source of truth.

## Features

- Public leaderboard at `/leaderboard`
- Admin spreadsheet-style editor at `/admin`
- Shared-passcode admin auth with signed HttpOnly cookie
- Google Sheets canonical data model with Convex realtime cache
- Sync pipeline:
  - Google Sheet edits -> Apps Script webhook -> Convex poll/merge
  - Fallback poll every 30s
  - Dashboard edits -> Convex optimistic update + queued writeback to Sheets

## Required Environment Variables

Copy `.env.example` to `.env.local` and set:

- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_FILE`
- `SHEET_WEBHOOK_SECRET`
- `ADMIN_PASSCODE`
- `ADMIN_COOKIE_SECRET`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`

## Google Service Account

Share your Google Sheet with this service account as **Editor**:

- `skill-tree-leaderboard@hack-sv.iam.gserviceaccount.com`

Never commit service-account JSON keys. `service-accounts/*.json` is gitignored.

## Commands

```bash
pnpm dev
pnpm lint
pnpm convex:dev
pnpm convex:deploy
```

## Google Sheets Schema

The app expects these tabs (and can initialize/repair headers from the admin dashboard button):

- `Skills`: `SkillID`, `SkillName`, `Category`, `XP`, `Active`, `UpdatedAt`
- `Attendees`: `AttendeeID`, `FullName`, `Active`, `UpdatedAt`
- `Completions`: `CompletionID`, `Timestamp`, `AttendeeID`, `SkillID`, `SkillXP`, `WildcardXP`, `TotalXP`, `UpdatedAt`, `Source`

Metadata columns are hidden by schema setup.

## Apps Script Webhook

Use `docs/apps-script-webhook.gs` as the sheet-side webhook trigger script.

## Keyboard Shortcuts (macOS-first)

- `Arrow keys`: navigate
- `Tab / Shift+Tab`: move horizontally
- `Enter / Shift+Enter`: commit and move vertically
- `Esc`: cancel edit
- `⌘C / Ctrl+C`: copy
- `⌘V / Ctrl+V`: paste
- `⌘D / Ctrl+D`: fill down
- `⌘S / Ctrl+S`: force queue flush + sheet sync
- `?`: toggle keymap overlay
