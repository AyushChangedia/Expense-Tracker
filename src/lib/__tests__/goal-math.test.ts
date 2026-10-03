import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DAYS_PER_MONTH,
  pacingFor,
  percentComplete,
  remainingFor,
  requiredPerMonth,
  standing,
} from "@/lib/goal-math";

/**
 * A goal card answers one question: am I going to get there, and what will it
 * take each month. The two cases nobody builds for are a deadline that is today
 * and a deadline that has passed, so both get their own tests here.
 */

/* ----------------------------------------------------- percentComplete -- */

test("half saved is half done", () => {
  assert.equal(percentComplete(500, 1000), 50);
});

test("saving past the target caps at complete", () => {
  // A progress bar at 140% would overflow its track.
  assert.equal(percentComplete(1400, 1000), 100);
});

test("a target of zero is not a division by zero", () => {
  assert.equal(percentComplete(0, 0), 0);
  assert.equal(percentComplete(500, 0), 0);
  assert.equal(percentComplete(500, -100), 0);
});

test("nothing saved is nothing done", () => {
  assert.equal(percentComplete(0, 1000), 0);
});

/* -------------------------------------------------------- remainingFor -- */

test("what is still to be saved", () => {
  assert.equal(remainingFor(300, 1000), 700);
});

test("an over-funded goal has nothing left, not a negative", () => {
  assert.equal(remainingFor(1400, 1000), 0);
});

test("float noise does not reach the figure", () => {
  assert.equal(remainingFor(70.1, 100), 29.9);
});

/* ---------------------------------------------------- requiredPerMonth -- */

test("the sum needed, spread over the months left", () => {
  // Two average months, so a little under ₹1,000 each.
  assert.equal(requiredPerMonth(2000, Math.round(DAYS_PER_MONTH * 2)), 998.03);
  assert.equal(DAYS_PER_MONTH, 30.44);
});

test("no deadline means no monthly figure to quote", () => {
  assert.equal(requiredPerMonth(5000, null), null);
});

test("a funded goal needs nothing more each month", () => {
  assert.equal(requiredPerMonth(0, 90), null);
  assert.equal(requiredPerMonth(-50, 90), null);
});

test("the final fortnight asks for the remainder, not twice it", () => {
  // Half a month left, so dividing by it would double the figure: ₹40,000 a
  // month on a goal that needs ₹20,000 by the end of the fortnight.
  assert.equal(requiredPerMonth(20_000, 15), 20_000);
});

test("tomorrow's deadline asks for the remainder, not thirty times it", () => {
  assert.equal(requiredPerMonth(20_000, 1), 20_000);
});

test("a deadline today or past still names a finite sum", () => {
  // The month floor is what keeps this from a division by zero and from the
  // negative months a passed deadline would otherwise produce.
  assert.equal(requiredPerMonth(5000, 0), 5000);
  assert.equal(requiredPerMonth(5000, -60), 5000);
});

test("the monthly figure falls as the deadline moves out", () => {
  let previous = Infinity;
  for (const days of [30, 60, 120, 365, 1000]) {
    const needed = requiredPerMonth(12_000, days);
    assert.ok(needed !== null && needed <= previous, `${days} days asked ${needed}`);
    previous = needed!;
  }
});

test("the monthly figure is never more than the whole remainder", () => {
  for (const days of [-100, 0, 1, 7, 15, 31, 90, 400]) {
    const needed = requiredPerMonth(9_000, days);
    assert.ok(needed !== null && needed <= 9_000, `${days} days asked ${needed}`);
  }
});

/* ------------------------------------------------------------ pacingFor -- */

test("a funded goal is complete, whatever its deadline said", () => {
  assert.equal(pacingFor(0, -500), "complete");
  assert.equal(pacingFor(0, 90), "complete");
  assert.equal(pacingFor(0, null), "complete");
});

test("a passed deadline with money still to save is overdue", () => {
  // The case the query had no way to express: before this, a goal six months
  // late looked exactly like one with six months to run.
  assert.equal(pacingFor(2000, -1), "overdue");
  assert.equal(pacingFor(2000, -180), "overdue");
});

test("a deadline today is due today, not overdue and not on track", () => {
  assert.equal(pacingFor(2000, 0), "due-today");
});

test("a goal with time left is on track", () => {
  assert.equal(pacingFor(2000, 1), "on-track");
  assert.equal(pacingFor(2000, 400), "on-track");
});

test("a goal with no deadline is on track rather than overdue", () => {
  // A deadline is optional, and not setting one must not read as missing it.
  assert.equal(pacingFor(2000, null), "on-track");
});

/* -------------------------------------------------------------- standing -- */

test("a goal halfway there with three months to run", () => {
  assert.deepEqual(standing(5000, 10_000, 91), {
    percentComplete: 50,
    remaining: 5000,
    requiredPerMonth: 1672.53,
    pacing: "on-track",
  });
});

test("a finished goal reports nothing outstanding", () => {
  assert.deepEqual(standing(10_000, 10_000, 30), {
    percentComplete: 100,
    remaining: 0,
    requiredPerMonth: null,
    pacing: "complete",
  });
});

test("a late goal still names what it would take to finish", () => {
  const result = standing(4000, 10_000, -45);
  assert.equal(result.pacing, "overdue");
  assert.equal(result.remaining, 6000);
  assert.equal(result.requiredPerMonth, 6000);
});

test("a goal with no deadline has progress but no monthly figure", () => {
  const result = standing(2500, 10_000, null);
  assert.equal(result.percentComplete, 25);
  assert.equal(result.requiredPerMonth, null);
  assert.equal(result.pacing, "on-track");
});

test("percentage and remainder never disagree about being finished", () => {
  for (const current of [0, 1, 4999.99, 10_000, 12_000]) {
    const result = standing(current, 10_000, 30);
    assert.equal(
      result.percentComplete === 100,
      result.remaining === 0,
      `${current} saved gave ${result.percentComplete}% with ${result.remaining} left`,
    );
  }
});
