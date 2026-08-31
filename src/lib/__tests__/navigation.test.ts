import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PROTECTED_PREFIXES } from "@/lib/auth.config";
import {
  MOBILE_NAV_ITEMS,
  NAV_ITEMS,
  NAV_SECTIONS,
  isActivePath,
} from "@/lib/navigation";

const APP_DIR = path.join(process.cwd(), "src", "app");

/** Every route the (dashboard) group actually serves, as a path. */
const dashboardRoutes = fs
  .readdirSync(path.join(APP_DIR, "(dashboard)"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `/${entry.name}`)
  .sort();

/* ------------------------------------------------------------ the lists -- */

test("NAV_ITEMS is exactly the sections flattened", () => {
  assert.deepEqual(NAV_ITEMS, NAV_SECTIONS.flatMap((s) => s.items));
});

test("every item is complete enough to render", () => {
  for (const item of NAV_ITEMS) {
    assert.ok(item.href.startsWith("/"), item.href);
    assert.ok(item.label.length > 0, item.href);
    assert.ok(item.description.length > 0, `${item.href} has no description`);
    assert.ok(item.icon, `${item.href} has no icon`);
  }
});

test("hrefs are unique", () => {
  const hrefs = NAV_ITEMS.map((i) => i.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("shortcuts are unique and single keys", () => {
  // They are pressed after `g`, so two items on one key means one is
  // unreachable and which one wins is list order.
  const shortcuts = NAV_ITEMS.map((i) => i.shortcut).filter(Boolean) as string[];
  assert.equal(new Set(shortcuts).size, shortcuts.length, "a shortcut is used twice");
  for (const key of shortcuts) assert.match(key, /^[a-z]$/, key);
});

test("section labels are unique and non-empty", () => {
  const labels = NAV_SECTIONS.map((s) => s.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const label of labels) assert.ok(label.length > 0);
});

/* -------------------------------------------- agreement with the routes -- */

test("every nav destination is a route that exists", () => {
  // The sidebar, the mobile nav and the command palette all read this list, so
  // a stale href is three broken links and a 404.
  for (const item of NAV_ITEMS) {
    assert.ok(
      dashboardRoutes.includes(item.href),
      `${item.href} is in the nav but has no page under src/app/(dashboard)`,
    );
  }
});

test("every dashboard route is reachable from the nav", () => {
  // The other direction: a page nobody can navigate to.
  const hrefs = new Set(NAV_ITEMS.map((i) => i.href));
  for (const route of dashboardRoutes) {
    assert.ok(hrefs.has(route), `${route} exists but is in no nav section`);
  }
});

test("every nav destination requires a session", () => {
  // The drift that matters: a page added to (dashboard) and to the nav, but
  // not to PROTECTED_PREFIXES, is served to anyone with the URL.
  for (const item of NAV_ITEMS) {
    assert.ok(
      PROTECTED_PREFIXES.includes(item.href),
      `${item.href} is not in PROTECTED_PREFIXES and is therefore public`,
    );
  }
});

test("every dashboard route is protected, nav or not", () => {
  for (const route of dashboardRoutes) {
    assert.ok(PROTECTED_PREFIXES.includes(route), `${route} is publicly reachable`);
  }
});

/* ----------------------------------------------------------- mobile bar -- */

test("the mobile bar holds five distinct destinations", () => {
  assert.equal(MOBILE_NAV_ITEMS.length, 5);
  const hrefs = MOBILE_NAV_ITEMS.map((i) => i.href);
  assert.equal(new Set(hrefs).size, 5, "the same destination twice");
});

test("the mobile bar holds the destinations it means to, in order", () => {
  // The regression: these were indices into NAV_ITEMS, so adding an item to an
  // earlier section re-pointed the bar at whatever moved into those slots.
  assert.deepEqual(
    MOBILE_NAV_ITEMS.map((i) => i.href),
    ["/dashboard", "/transactions", "/budgets", "/analytics", "/calendar"],
  );
});

test("every mobile item is a real nav item, not a copy", () => {
  for (const item of MOBILE_NAV_ITEMS) {
    assert.ok(NAV_ITEMS.includes(item), `${item.href} is not the same object as its nav entry`);
  }
});

/* ---------------------------------------------------------- active path -- */

test("a route highlights itself", () => {
  for (const item of NAV_ITEMS) {
    assert.ok(isActivePath(item.href, item.href), item.href);
  }
});

test("a nested route highlights its parent", () => {
  assert.ok(isActivePath("/transactions/abc123", "/transactions"));
  assert.ok(isActivePath("/settings/profile", "/settings"));
});

test("the dashboard highlights only on an exact match", () => {
  // Otherwise it would be a prefix of nothing but itself and still fight the
  // other entries on any path that happened to start with it.
  assert.ok(isActivePath("/dashboard", "/dashboard"));
  assert.ok(!isActivePath("/dashboard/anything", "/dashboard"));
});

test("a sibling route does not highlight a neighbour", () => {
  assert.ok(!isActivePath("/budgets", "/goals"));
  // The prefix trap: /categories must not light up /calendar or vice versa.
  assert.ok(!isActivePath("/categories", "/calendar"));
  assert.ok(!isActivePath("/transactions-archive", "/transactions"));
});

test("exactly one nav item is active for any real route", () => {
  for (const route of dashboardRoutes) {
    const active = NAV_ITEMS.filter((item) => isActivePath(route, item.href));
    assert.equal(active.length, 1, `${route} lit up ${active.length} nav items`);
  }
});
