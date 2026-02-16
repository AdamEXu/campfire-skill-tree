import { z } from "zod";

const serverSchema = z.object({
  GOOGLE_SPREADSHEET_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_FILE: z.string().optional(),
  SHEET_WEBHOOK_SECRET: z.string().min(1),
  ADMIN_PASSCODE: z.string().min(1),
  ADMIN_COOKIE_SECRET: z.string().min(1),
  CONVEX_DEPLOYMENT: z.string().min(1),
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
});

export function getServerEnv() {
  return serverSchema.parse(process.env);
}

export function getClientEnv() {
  return clientSchema.parse({
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  });
}
