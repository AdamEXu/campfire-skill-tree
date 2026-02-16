import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login?reason=missing-admin-secret", request.url));
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isValid = await verifyAdminSession(token, secret);

  if (isValid) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
