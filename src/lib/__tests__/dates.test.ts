import { test } from "node:test";
import assert from "node:assert/strict";

import {
  advanceRecurrence,
  dayKey,
  formatDate,
  fromUtcDay,
  frequencyLabel,
  lastNMonths,
  monthGrid,
  monthLabel,
  monthRange,
  parseDateInput,
  relativeDay,
  relativeTime,
  shiftMonth,
  toUtcDay,
  weekdayLabels,
} from "@/lib/dates";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ------------------------------------------------------- the UTC-day rule -- */

test("a local date becomes midnight UTC on the same calendar day", () => {
  const utc = toUtcDay(new Date(2026, 2, 4, 23, 45));
  assert.equal(utc.toISOString(), "2026-03-04T00:00:00.000Z");
});

test("the late-evening case does not roll over to the next day", () => {
  // The bug this guards: using the instant rather than the calendar day means
  // a transaction entered at 11:45pm is filed under tomorrow.
  assert.equal(iso(toUtcDay(new Date(2026, 11, 31, 23, 59, 59))), "2026-12-31");
});

test("toUtcDay and fromUtcDay round-trip the calendar day", () => {
  for (const [y, m, d] of [
    [2026, 0, 1],
    [2026, 1, 28],
    [2024, 1, 29], // a leap day
    [2026, 11, 31],
  ] as const) {
    const original = new Date(y, m, d);
    const back = fromUtcDay(toUtcDay(original));
    assert.equal(back.getFullYear(), y);
    assert.equal(back.getMonth(), m);
    assert.equal(back.getDate(), d);
  }
});

test("a yyyy-MM-dd string is a plain calendar day and is never shifted", () => {
  // Passing this to `new Date()` would parse it as UTC midnight and then shift
  // it a day backwards for anyone west of Greenwich.
  const parsed = parseDateInput("2026-03-04");
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(parsed.getDate(), 4);
});

test("toUtcDay accepts the same day-only string", () => {
  assert.equal(iso(toUtcDay("2026-03-04")), "2026-03-04");
});

test("an ISO timestamp is parsed as an instant", () => {
  const parsed = parseDateInput("2026-03-04T15:30:00.000Z");
  assert.equal(parsed.toISOString(), "2026-03-04T15:30:00.000Z");
});

test("dayKey is the yyyy-MM-dd the calendar grid buckets on", () => {
  assert.equal(dayKey(new Date(Date.UTC(2026, 2, 4))), "2026-03-04");
  assert.equal(dayKey("2026-03-04T00:00:00.000Z"), "2026-03-04");
});

/* ------------------------------------------------------------- formatting -- */

test("formatDate honours the requested pattern", () => {
  const day = new Date(Date.UTC(2026, 2, 4));
  assert.equal(formatDate(day, "MMM d, yyyy"), "Mar 4, 2026");
  assert.equal(formatDate(day, "dd/MM/yyyy"), "04/03/2026");
  assert.equal(formatDate(day, "yyyy-MM-dd"), "2026-03-04");
});

test("relative day labels are anchored on the calendar, not on elapsed hours", () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const shift = (days: number) =>
    new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + days));

  assert.equal(relativeDay(shift(0)), "Today");
  assert.equal(relativeDay(shift(-1)), "Yesterday");
  assert.equal(relativeDay(shift(1)), "Tomorrow");
  assert.equal(relativeDay(shift(-3)), "3 days ago");
  assert.equal(relativeDay(shift(3)), "In 3 days");
});

test("beyond a week, relativeDay falls back to an absolute date", () => {
  const old = new Date(Date.UTC(2020, 0, 15));
  assert.equal(relativeDay(old), "Jan 15, 2020");
});

test("relativeTime steps through its units", () => {
  const ago = (ms: number) => new Date(Date.now() - ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  assert.equal(relativeTime(ago(5_000)), "just now");
  assert.equal(relativeTime(ago(5 * minute)), "5m ago");
  assert.equal(relativeTime(ago(5 * hour)), "5h ago");
  assert.equal(relativeTime(ago(3 * day)), "3d ago");
  assert.equal(relativeTime(ago(14 * day)), "2w ago");
  assert.equal(relativeTime(ago(60 * day)), "2mo ago");
  assert.equal(relativeTime(ago(800 * day)), "2y ago");
});

/* ----------------------------------------------------------------- months -- */

test("monthRange is inclusive of the start and exclusive of the end", () => {
  const { start, end } = monthRange(2026, 3);
  assert.equal(start.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(end.toISOString(), "2026-04-01T00:00:00.000Z");
});

test("a December range rolls into the next year", () => {
  const { start, end } = monthRange(2026, 12);
  assert.equal(iso(start), "2026-12-01");
  assert.equal(iso(end), "2027-01-01");
});

test("shiftMonth crosses year boundaries in both directions", () => {
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 6, 0), { year: 2026, month: 6 });
  assert.deepEqual(shiftMonth(2026, 3, 14), { year: 2027, month: 5 });
});

test("monthLabel is human-readable and 1-based", () => {
  assert.equal(monthLabel(2026, 1), "January 2026");
  assert.equal(monthLabel(2026, 12), "December 2026");
});

test("lastNMonths ends with the reference month and runs oldest first", () => {
  const months = lastNMonths(3, new Date(2026, 2, 15));
  assert.equal(months.length, 3);
  assert.deepEqual(
    months.map((m) => `${m.year}-${m.month}`),
    ["2026-1", "2026-2", "2026-3"],
  );
  assert.equal(months[2].label, "Mar");
  assert.equal(months[2].longLabel, "Mar 2026");
});

test("lastNMonths spans a year boundary without a month 0 or 13", () => {
  const months = lastNMonths(3, new Date(2026, 0, 10));
  assert.deepEqual(
    months.map((m) => `${m.year}-${m.month}`),
    ["2025-11", "2025-12", "2026-1"],
  );
  // The December bucket must end on 1 January, not on month index 12.
  assert.equal(iso(months[1].end), "2026-01-01");
});

test("each lastNMonths bucket is a half-open range that tiles the next", () => {
  const months = lastNMonths(6, new Date(2026, 7, 27));
  for (let i = 1; i < months.length; i += 1) {
    assert.equal(
      months[i - 1].end.getTime(),
      months[i].start.getTime(),
      "a gap or overlap between month buckets would drop or double-count rows",
    );
  }
});

test("monthGrid returns whole weeks that cover the month", () => {
  const grid = monthGrid(2026, 3);
  assert.equal(grid.length % 7, 0);
  assert.equal(grid[0].getDay(), 0);
  assert.ok(grid.some((d) => d.getMonth() === 2 && d.getDate() === 1));
  assert.ok(grid.some((d) => d.getMonth() === 2 && d.getDate() === 31));
});

test("monthGrid respects a Monday week start", () => {
  const grid = monthGrid(2026, 3, 1);
  assert.equal(grid.length % 7, 0);
  assert.equal(grid[0].getDay(), 1);
});

test("weekday labels rotate with the week start", () => {
  assert.equal(weekdayLabels(0)[0], "Sun");
  assert.equal(weekdayLabels(1)[0], "Mon");
  assert.equal(weekdayLabels(1)[6], "Sun");
  assert.equal(weekdayLabels(0).length, 7);
});

/* ------------------------------------------------------------- recurrence -- */

test("each frequency advances by its own unit", () => {
  const start = new Date(Date.UTC(2026, 2, 4));
  assert.equal(iso(advanceRecurrence(start, "DAILY", 1)), "2026-03-05");
  assert.equal(iso(advanceRecurrence(start, "WEEKLY", 1)), "2026-03-11");
  assert.equal(iso(advanceRecurrence(start, "MONTHLY", 1)), "2026-04-04");
  assert.equal(iso(advanceRecurrence(start, "YEARLY", 1)), "2027-03-04");
});

test("the interval multiplies the step", () => {
  const start = new Date(Date.UTC(2026, 2, 4));
  assert.equal(iso(advanceRecurrence(start, "WEEKLY", 2)), "2026-03-18");
  assert.equal(iso(advanceRecurrence(start, "MONTHLY", 3)), "2026-06-04");
});

test("an interval below 1 is floored rather than freezing the cursor", () => {
  // A zero step would make runDueRecurring loop until its guard trips.
  const start = new Date(Date.UTC(2026, 2, 4));
  assert.equal(iso(advanceRecurrence(start, "DAILY", 0)), "2026-03-05");
  assert.equal(iso(advanceRecurrence(start, "DAILY", -5)), "2026-03-05");
});

test("a single step off a long month clamps into a short one", () => {
  assert.equal(iso(advanceRecurrence(new Date(Date.UTC(2026, 0, 31)), "MONTHLY", 1)), "2026-02-28");
  assert.equal(iso(advanceRecurrence(new Date(Date.UTC(2024, 0, 31)), "MONTHLY", 1)), "2024-02-29");
});

test("a yearly step off a leap day clamps", () => {
  assert.equal(iso(advanceRecurrence(new Date(Date.UTC(2024, 1, 29)), "YEARLY", 1)), "2025-02-28");
});

test("frequency labels read naturally at interval 1 and above", () => {
  assert.equal(frequencyLabel("DAILY", 1), "Daily");
  assert.equal(frequencyLabel("MONTHLY", 1), "Monthly");
  assert.equal(frequencyLabel("WEEKLY", 2), "Every 2 weeks");
  assert.equal(frequencyLabel("MONTHLY", 3), "Every 3 months");
});
