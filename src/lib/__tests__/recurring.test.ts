import { test } from "node:test";
import assert from "node:assert/strict";

import { advanceRecurrence, utcDayOf } from "@/lib/dates";
import { computeNextRunDate } from "@/lib/recurring";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/**
 * Walks a rule the way runDueRecurring does — one step at a time, feeding each
 * result back in — which is where a per-step clamp turns into permanent drift.
 */
function sequence(
  start: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  interval: number,
  steps: number,
  anchorDay?: number,
): string[] {
  let cursor = start;
  const out = [iso(cursor)];
  for (let i = 0; i < steps; i += 1) {
    cursor = advanceRecurrence(cursor, frequency, interval, anchorDay);
    out.push(iso(cursor));
  }
  return out;
}

/* ------------------------------------------------------------ month ends -- */

test("a rule due on the 31st keeps paying on the 31st", () => {
  // The regression: February clamps to the 28th, and without an anchor the
  // next step starts from the 28th, so every later month pays on the 28th too.
  assert.deepEqual(sequence(utc(2026, 1, 31), "MONTHLY", 1, 5, 31), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
    "2026-05-31",
    "2026-06-30",
  ]);
});

test("a rule due on the 30th survives February the same way", () => {
  assert.deepEqual(sequence(utc(2026, 1, 30), "MONTHLY", 1, 3, 30), [
    "2026-01-30",
    "2026-02-28",
    "2026-03-30",
    "2026-04-30",
  ]);
});

test("a leap February clamps to the 29th, not the 28th", () => {
  assert.deepEqual(sequence(utc(2024, 1, 31), "MONTHLY", 1, 2, 31), [
    "2024-01-31",
    "2024-02-29",
    "2024-03-31",
  ]);
});

test("a mid-month rule is unaffected by the anchor", () => {
  assert.deepEqual(sequence(utc(2026, 1, 15), "MONTHLY", 1, 3, 15), [
    "2026-01-15",
    "2026-02-15",
    "2026-03-15",
    "2026-04-15",
  ]);
});

test("a quarterly rule off the 31st re-anchors too", () => {
  assert.deepEqual(sequence(utc(2026, 1, 31), "MONTHLY", 3, 2, 31), [
    "2026-01-31",
    "2026-04-30",
    "2026-07-31",
  ]);
});

test("a yearly rule on 29 February returns to the 29th in the next leap year", () => {
  assert.deepEqual(sequence(utc(2024, 2, 29), "YEARLY", 1, 4, 29), [
    "2024-02-29",
    "2025-02-28",
    "2026-02-28",
    "2027-02-28",
    "2028-02-29",
  ]);
});

test("daily and weekly rules ignore the anchor entirely", () => {
  // Re-seating a weekly rule on a day-of-month would break its weekday.
  assert.deepEqual(sequence(utc(2026, 1, 29), "DAILY", 1, 3, 29), [
    "2026-01-29",
    "2026-01-30",
    "2026-01-31",
    "2026-02-01",
  ]);
  assert.deepEqual(sequence(utc(2026, 1, 29), "WEEKLY", 1, 2, 29), [
    "2026-01-29",
    "2026-02-05",
    "2026-02-12",
  ]);
});

test("without an anchor the single-step behaviour is unchanged", () => {
  // Callers asking "what comes next" once still get the plain clamp.
  assert.equal(iso(advanceRecurrence(utc(2026, 1, 31), "MONTHLY", 1)), "2026-02-28");
  assert.equal(iso(advanceRecurrence(utc(2026, 1, 15), "MONTHLY", 1)), "2026-02-15");
});

/* -------------------------------------------------------- next run dates -- */

test("a start date in the future is itself the next run", () => {
  assert.equal(
    iso(computeNextRunDate(utc(2026, 9, 1), "MONTHLY", 1, utc(2026, 8, 27))),
    "2026-09-01",
  );
});

test("a start date of today is the next run", () => {
  assert.equal(
    iso(computeNextRunDate(utc(2026, 8, 27), "MONTHLY", 1, utc(2026, 8, 27))),
    "2026-08-27",
  );
});

test("a past start walks forward on its own cadence", () => {
  assert.equal(
    iso(computeNextRunDate(utc(2026, 1, 1), "MONTHLY", 1, utc(2026, 8, 27))),
    "2026-08-01",
  );
});

test("a past monthly start on the 31st does not decay to the 28th", () => {
  assert.equal(
    iso(computeNextRunDate(utc(2026, 1, 31), "MONTHLY", 1, utc(2026, 8, 27))),
    "2026-07-31",
  );
});

test("a weekly rule lands on the same weekday it started on", () => {
  const next = computeNextRunDate(utc(2026, 1, 7), "WEEKLY", 1, utc(2026, 8, 27));
  assert.equal(next.getUTCDay(), utc(2026, 1, 7).getUTCDay());
});

test("a fortnightly rule keeps its two-week phase", () => {
  const start = utc(2026, 1, 7);
  const next = computeNextRunDate(start, "WEEKLY", 2, utc(2026, 8, 27));
  const elapsedDays = (next.getTime() - start.getTime()) / 86_400_000;
  assert.equal(elapsedDays % 14, 0);
});

test("a yearly rule started years ago lands on this year", () => {
  assert.equal(
    iso(computeNextRunDate(utc(2020, 3, 15), "YEARLY", 1, utc(2026, 8, 27))),
    "2026-03-15",
  );
});

test("the walk terminates on a daily rule started long ago", () => {
  // Guarded rather than unbounded: a daily rule from years back must not spin.
  const next = computeNextRunDate(utc(2019, 1, 1), "DAILY", 1, utc(2026, 8, 27));
  assert.ok(next.getTime() <= utc(2026, 8, 27).getTime());
});

/* -------------------------------------------------------------- timezones -- */

test("utcDayOf is idempotent on a stored UTC day", () => {
  const stored = utc(2026, 1, 15);
  assert.equal(utcDayOf(stored).toISOString(), stored.toISOString());
  assert.equal(utcDayOf(utcDayOf(stored)).toISOString(), stored.toISOString());
});

test("stepping a recurrence never depends on the server's timezone", () => {
  // The whole schema stores calendar days at midnight UTC. Reading those back
  // with local getters shifts them a day earlier anywhere west of Greenwich,
  // so a recurring rule crept backwards one day on every run in a US-hosted
  // deployment. Every date here is UTC in and UTC out.
  const stepped = advanceRecurrence(utc(2026, 1, 15), "MONTHLY", 1, 15);
  assert.equal(stepped.toISOString(), "2026-02-15T00:00:00.000Z");
  assert.equal(stepped.getUTCHours(), 0, "a step must land exactly on midnight UTC");
});

test("every frequency lands on midnight UTC", () => {
  const start = utc(2026, 1, 15);
  for (const frequency of ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const) {
    const next = advanceRecurrence(start, frequency, 1, 15);
    assert.equal(
      next.getTime() % 86_400_000,
      0,
      `${frequency} produced a date that is not midnight UTC`,
    );
  }
});

test("a month step across a year boundary rolls the year", () => {
  assert.equal(iso(advanceRecurrence(utc(2026, 11, 15), "MONTHLY", 2, 15)), "2027-01-15");
  assert.equal(iso(advanceRecurrence(utc(2026, 12, 31), "MONTHLY", 1, 31)), "2027-01-31");
  assert.equal(iso(advanceRecurrence(utc(2026, 1, 15), "MONTHLY", 24, 15)), "2028-01-15");
});
