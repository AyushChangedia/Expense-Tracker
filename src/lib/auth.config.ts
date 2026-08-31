import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe half of the auth setup.
 *
 * `middleware.ts` runs on the edge runtime where Prisma and bcrypt cannot be
 * loaded, so this file deliberately contains no database access. The full
 * configuration in `src/lib/auth.ts` extends it with the Prisma adapter and
 * the credentials provider.
 */

export const AUTH_ROUTES = {
  signIn: "/login",
  signUp: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
} as const;

export const DEFAULT_SIGNED_IN_REDIRECT = "/dashboard";

/** Routes that require a session. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/budgets",
  "/goals",
  "/recurring",
  "/analytics",
  "/calendar",
  "/insights",
  "/categories",
  "/settings",
];

/** Signed-in users are bounced away from these. */
export const AUTH_PAGE_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password"];

/**
 * Reduce a caller-supplied `callbackUrl` to a safe same-origin path.
 *
 * The sign-in and sign-up screens read this straight from the query string and
 * navigate to it after a successful login. Passing it through unchecked is an
 * open redirect (CWE-601): a link to
 * `https://fluxfin.app/login?callbackUrl=https://evil.example` shows the real
 * sign-in page on the real domain, the user signs in legitimately, and is then
 * handed to the attacker — the most convincing shape a phishing chain has,
 * because every step before the last one is genuine.
 *
 * Only a path rooted at `/` is allowed through. That excludes absolute URLs,
 * protocol-relative `//evil.example`, the backslash variant browsers normalise
 * to it, and anything with a scheme.
 */
export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_REDIRECT,
): string {
  if (!raw) return fallback;

  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  // `//host` and `/\host` are both read as protocol-relative by browsers.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // A control character can be used to smuggle one of the above past a check.
  if (/[\u0000-\u001f]/.test(value)) return fallback;

  return value;
}

/**
 * Does `pathname` fall under one of `prefixes`?
 *
 * Exact match or a `/`-delimited descendant, so `/settings` covers
 * `/settings/profile` but `/settings-export` is a different route and is not
 * covered. Plain `startsWith` gets that wrong in the direction that matters:
 * it would treat an unrelated route as protected, or — with the lists the
 * other way round — bounce a signed-in user off a page they should see.
 *
 * Exported because the middleware and the `authorized` callback below both
 * need it and had a copy each. Two implementations of one security check drift
 * apart the first time somebody fixes only the one they were looking at.
 */
export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: AUTH_ROUTES.signIn,
    error: AUTH_ROUTES.signIn,
    newUser: DEFAULT_SIGNED_IN_REDIRECT,
  },
  session: {
    // Credentials sign-in requires JWT sessions; the Prisma adapter still
    // persists users/accounts for OAuth linking.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: googleEnabled
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          allowDangerousEmailAccountLinking: true,
          profile(profile) {
            return {
              id: profile.sub,
              name: profile.name,
              email: profile.email,
              image: profile.picture,
            };
          },
        }),
      ]
    : [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (!matchesPrefix(pathname, PROTECTED_PREFIXES)) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
