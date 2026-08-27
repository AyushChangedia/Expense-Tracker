import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  hashHue,
  initials,
  percentChange,
  percentage,
  round2,
  slugify,
  sum,
  truncate,
  unique,
} from "@/lib/utils";

/* ---------------------------------------------------------------- slugify -- */

test("slugify turns a display name into a stable slug", () => {
  assert.equal(slugify("Food & Drink"), "food-drink");
  assert.equal(slugify("  Bills  "), "bills");
  assert.equal(slugify("Nights Out"), "nights-out");
});

test("slugify drops apostrophes rather than turning them into separators", () => {
  // "Sam's Cafe" must not become "sam-s-cafe".
  assert.equal(slugify("Sam's Cafe"), "sams-cafe");
  assert.equal(slugify("Sam’s Cafe"), "sams-cafe");
});

test("slugify never leaves a leading or trailing dash", () => {
  assert.equal(slugify("!!! Food !!!"), "food");
  assert.equal(slugify("---"), "");
});

test("slugify caps length so it always fits the column", () => {
  assert.equal(slugify("x".repeat(200)).length, 60);
});

test("slugify collapses runs of separators into one dash", () => {
  assert.equal(slugify("a   /   b"), "a-b");
});

/* --------------------------------------------------------------- initials -- */

test("initials use the first and last word of a name", () => {
  assert.equal(initials("Ayush Changedia"), "AC");
  assert.equal(initials("Ada Byron Lovelace"), "AL");
});

test("a single word gives two letters", () => {
  assert.equal(initials("Ayush"), "AY");
});

test("an email is used when there is no name", () => {
  assert.equal(initials(null, "ayush.changedia@example.com"), "AC");
  assert.equal(initials("", "ayush@example.com"), "AY");
});

test("initials never throw on missing input", () => {
  // Rendered in the avatar on every page, including before the session loads.
  assert.equal(initials(), "U");
  assert.equal(initials(null, null), "U");
  assert.equal(initials("   ", ""), "U");
});

/* ----------------------------------------------------------------- maths -- */

test("clamp holds a value inside its range", () => {
  assert.equal(clamp(50), 50);
  assert.equal(clamp(-10), 0);
  assert.equal(clamp(150), 100);
  assert.equal(clamp(5, 10, 20), 10);
});

test("percentage of nothing is zero, not NaN", () => {
  // A progress bar reading NaN% would render as an empty attribute.
  assert.equal(percentage(50, 0), 0);
  assert.equal(percentage(0, 0), 0);
  assert.equal(percentage(25, 200), 12.5);
});

test("percentChange returns null when there is no baseline to compare", () => {
  // null means "no comparison", which the UI renders as an em dash. Returning
  // 0 or Infinity here would read as a real measurement.
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(0, 0), 0);
});

test("percentChange is signed relative to the previous magnitude", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(50, 100), -50);
  // A negative baseline must not flip the sign of the change.
  assert.equal(percentChange(-50, -100), 50);
});

test("round2 rounds half away from zero without float drift", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(1.004), 1);
});

test("sum of nothing is zero", () => {
  assert.equal(sum([]), 0);
  assert.equal(sum([1, 2, 3]), 6);
  assert.equal(sum([-1, 1]), 0);
});

test("unique preserves first-seen order", () => {
  assert.deepEqual(unique([3, 1, 3, 2, 1]), [3, 1, 2]);
  assert.deepEqual(unique<string>([]), []);
});

/* --------------------------------------------------------------- strings -- */

test("truncate leaves short strings alone", () => {
  assert.equal(truncate("Coffee", 20), "Coffee");
});

test("truncate keeps the result within the limit, ellipsis included", () => {
  const out = truncate("A rather long description", 10);
  assert.equal(out.length, 10);
  assert.ok(out.endsWith("…"));
});

/* ------------------------------------------------------------------ hues -- */

test("hashHue is deterministic and in range", () => {
  // Tag colours must not change between renders or between server and client.
  for (const value of ["food", "travel", "", "a".repeat(200), "🎉"]) {
    const hue = hashHue(value);
    assert.equal(hue, hashHue(value), `${value} was not stable`);
    assert.ok(hue >= 0 && hue < 360, `${value} produced ${hue}`);
    assert.ok(Number.isInteger(hue));
  }
});

test("different tags mostly get different hues", () => {
  const hues = new Set(
    ["food", "travel", "rent", "bills", "fun", "health"].map(hashHue),
  );
  assert.ok(hues.size >= 5, `only ${hues.size} distinct hues`);
});
