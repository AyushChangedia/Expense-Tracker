import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AUTH_PAGE_PREFIXES,
  DEFAULT_SIGNED_IN_REDIRECT,
  PROTECTED_PREFIXES,
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
