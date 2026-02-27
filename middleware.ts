import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  const sessionCookie = allCookies.find(c => c.name.includes("session"));
  const { pathname } = request.nextUrl;

  const authPaths = ["/auth/sign-in", "/auth/sign-up"];
  if (sessionCookie && authPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const protectedPaths = ["/dashboard", "/agents", "/accounts"];
  if (!sessionCookie && protectedPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/accounts/:path*",
    "/auth/:path*",
  ],
};
