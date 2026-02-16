import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE_NAME, signAdminSession, verifyPasscode } from "@/lib/auth";

const bodySchema = z.object({
  passcode: z.string().min(1),
});

export async function POST(request: Request) {
  const envPasscode = process.env.ADMIN_PASSCODE;
  const cookieSecret = process.env.ADMIN_COOKIE_SECRET;

  if (!envPasscode || !cookieSecret) {
    return NextResponse.json({ error: "Admin auth env vars are missing" }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Passcode is required" }, { status: 400 });
  }

  if (!verifyPasscode(parsed.data.passcode, envPasscode)) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }

  const token = await signAdminSession(cookieSecret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
