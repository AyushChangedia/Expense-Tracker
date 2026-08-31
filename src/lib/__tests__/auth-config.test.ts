import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AUTH_PAGE_PREFIXES,
  DEFAULT_SIGNED_IN_REDIRECT,
  PROTECTED_PREFIXES,
  authConfig,
  matchesPrefix,
  safeCallbackUrl,
} from "@/lib/auth.config";

/* -------------------------------------------------------- open redirect -- */

test("an ordinary in-app path is preserved", () => {
  // The whole point of callbackUrl: land where you were headed.
  assert.equal(safeCallbackUrl("/transactions"), "/transactions");
  assert.equal(safeCallbackUrl("/transactions?type=EXPENSE&page=2"), "/transactions?type=EXPENSE&page=2");
  assert.equal(safeCallbackUrl("/settings#profile"), "/settings#profile");
});

test("an absolute URL to another origin is refused", () => {
  // CWE-601: the real login page on the real domain, then a handoff to the
  // attacker. Every step before the last one is genuine, which is what makes
  // it work.
  for (const hostile of [
    "https://evil.example",
    "http://evil.example/login",
    "https://evil.example/path?a=b",
    "HTTPS://EVIL.EXAMPLE",
  ]) {
    assert.equal(safeCallbackUrl(hostile), DEFAULT_SIGNED_IN_REDIRECT, hostile);
  }
});

test("a protocol-relative URL is refused", () => {
  // "//evil.example" inherits the current scheme and is a full navigation.
  assert.equal(safeCallbackUrl("//evil.example"), DEFAULT_SIGNED_IN_REDIRECT);
  assert.equal(safeCallbackUrl("//evil.example/path"), DEFAULT_SIGNED_IN_REDIRECT);
});

test("the backslash variant browsers normalise is refused", () => {
  assert.equal(safeCallbackUrl("/\\evil.example"), DEFAULT_SIGNED_IN_REDIRECT);
});

test("a non-http scheme is refused", () => {
  for (const hostile of ["javascript:alert(1)", "data:text/html,<script>", "mailto:a@b.c"]) {
    assert.equal(safeCallbackUrl(hostile), DEFAULT_SIGNED_IN_REDIRECT, hostile);
  }
});

test("control characters cannot smuggle a scheme past the check", () => {
  assert.equal(safeCallbackUrl("/\njavascript:alert(1)"), DEFAULT_SIGNED_IN_REDIRECT);
  assert.equal(safeCallbackUrl("/\tpath"), DEFAULT_SIGNED_IN_REDIRECT);
});

test("missing, empty and whitespace values fall back", () => {
  assert.equal(safeCallbackUrl(null), DEFAULT_SIGNED_IN_REDIRECT);
  assert.equal(safeCallbackUrl(undefined), DEFAULT_SIGNED_IN_REDIRECT);
  assert.equal(safeCallbackUrl(""), DEFAULT_SIGNED_IN_REDIRECT);
  assert.equal(safeCallbackUrl("   "), DEFAULT_SIGNED_IN_REDIRECT);
});

test("a relative path with no leading slash is refused", () => {
  // "evil.example" resolves against the current directory, but it is also not
  // a route this app can serve, so there is no reason to allow it.
  assert.equal(safeCallbackUrl("evil.example"), DEFAULT_SIGNED_IN_REDIRECT);
  assert.equal(safeCallbackUrl("../admin"), DEFAULT_SIGNED_IN_REDIRECT);
});

test("an explicit fallback is honoured", () => {
  assert.equal(safeCallbackUrl("https://evil.example", "/login"), "/login");
});

/* ------------------------------------------------------- route prefixes -- */

test("the default signed-in redirect is itself a protected route", () => {
  // Otherwise a successful sign-in lands somewhere public.
  assert.ok(PROTECTED_PREFIXES.includes(DEFAULT_SIGNED_IN_REDIRECT));
});

test("protected and auth prefixes do not overlap", () => {
  // A path in both would redirect in a loop.
  for (const prefix of AUTH_PAGE_PREFIXES) {
    assert.ok(!PROTECTED_PREFIXES.includes(prefix), `${prefix} is in both lists`);
  }
});

test("every prefix is an absolute path with no trailing slash", () => {
  for (const prefix of [...PROTECTED_PREFIXES, ...AUTH_PAGE_PREFIXES]) {
    assert.ok(prefix.startsWith("/"), prefix);
    assert.ok(prefix === "/" || !prefix.endsWith("/"), `${prefix} has a trailing slash`);
  }
});

/* ---------------------------------------------------- the prefix matcher -- */

test("a prefix matches itself and its descendants", () => {
  assert.ok(matchesPrefix("/settings", ["/settings"]));
  assert.ok(matchesPrefix("/settings/profile", ["/settings"]));
  assert.ok(matchesPrefix("/settings/profile/email", ["/settings"]));
});

test("a prefix does not match a route that merely starts with the same letters", () => {
  // Plain startsWith gets this wrong, and wrongly protecting or wrongly
  // exposing a route are both real outcomes of the same slip.
  assert.ok(!matchesPrefix("/settings-export", ["/settings"]));
  assert.ok(!matchesPrefix("/transactions-archive", ["/transactions"]));
  assert.ok(!matchesPrefix("/logins", ["/login"]));
});

test("an unmatched path matches nothing", () => {
  assert.ok(!matchesPrefix("/", PROTECTED_PREFIXES));
  assert.ok(!matchesPrefix("/pricing", PROTECTED_PREFIXES));
  assert.ok(!matchesPrefix("/", AUTH_PAGE_PREFIXES));
});

test("an empty prefix list matches nothing", () => {
  assert.ok(!matchesPrefix("/dashboard", []));
});

/* ------------------------------------------------- the protection matrix -- */

/** What the middleware and the authorized callback both decide from. */
const decide = (pathname: string) => ({
  protected: matchesPrefix(pathname, PROTECTED_PREFIXES),
  authPage: matchesPrefix(pathname, AUTH_PAGE_PREFIXES),
});

test("app routes are protected and their sub-paths with them", () => {
  for (const path of [
    "/dashboard",
    "/transactions",
    "/transactions/abc123",
    "/budgets",
    "/goals",
    "/recurring",
    "/analytics",
    "/calendar",
    "/insights",
    "/categories",
    "/settings",
    "/settings/profile",
  ]) {
    assert.equal(decide(path).protected, true, `${path} is not protected`);
  }
});

test("the public surface stays public", () => {
  // The marketing page and the auth screens must not require a session, or
  // signing in becomes impossible.
  for (const path of ["/", "/login", "/signup", "/forgot-password", "/reset-password"]) {
    assert.equal(decide(path).protected, false, `${path} would require a session`);
  }
});

test("auth screens are recognised so a signed-in user is bounced off them", () => {
  for (const path of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
    assert.equal(decide(path).authPage, true, path);
  }
  assert.equal(decide("/dashboard").authPage, false);
});

test("no path is both protected and an auth page", () => {
  // Such a path would redirect in a loop for one state or the other.
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/dashboard",
    "/settings/profile",
    "/nonsense",
  ]) {
    const result = decide(path);
    assert.ok(!(result.protected && result.authPage), `${path} is in both sets`);
  }
});

test("the authorized callback lets anyone reach a public route", () => {
  const call = (pathname: string, signedIn: boolean) =>
    authConfig.callbacks.authorized({
      auth: signedIn ? ({ user: { id: "u1" } } as never) : null,
      request: { nextUrl: { pathname } } as never,
    } as never);

  assert.equal(call("/", false), true);
  assert.equal(call("/login", false), true);
  assert.equal(call("/pricing", false), true);
});

test("the authorized callback gates protected routes on a session", () => {
  const call = (pathname: string, signedIn: boolean) =>
    authConfig.callbacks.authorized({
      auth: signedIn ? ({ user: { id: "u1" } } as never) : null,
      request: { nextUrl: { pathname } } as never,
    } as never);

  for (const path of PROTECTED_PREFIXES) {
    assert.equal(call(path, false), false, `${path} allowed a signed-out visitor`);
    assert.equal(call(path, true), true, `${path} blocked a signed-in user`);
  }
  assert.equal(call("/transactions/abc123", false), false, "a sub-path was left open");
});
