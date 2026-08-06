import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import {
  AUTH_PAGE_PREFIXES,
  DEFAULT_SIGNED_IN_REDIRECT,
  PROTECTED_PREFIXES,
  authConfig,
} from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isSignedIn = Boolean(request.auth?.user);

  // Signed-in users have no business on the login or sign-up screens.
  if (isSignedIn && matches(pathname, AUTH_PAGE_PREFIXES)) {
    return NextResponse.redirect(new URL(DEFAULT_SIGNED_IN_REDIRECT, request.nextUrl));
  }

  // Only the app routes require a session. The marketing page, the auth pages,
  // and anything unmatched (which should render a 404) stay public.
  if (!isSignedIn && matches(pathname, PROTECTED_PREFIXES)) {
    const signInUrl = new URL("/login", request.nextUrl);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Skip static assets, image optimisation, and the auth API itself.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
