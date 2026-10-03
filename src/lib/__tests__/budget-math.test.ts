import { test } from "node:test";
import assert from "node:assert/strict";

import {
  WARNING_THRESHOLD,
  dailyAllowance,
  daysLeftInMonth,
  percentUsed,
  projectedSpend,
  standing,
  statusFor,
} from "@/lib/budget-math";

/**
 * Every figure here is one a person acts on, and none of them throws when it is
 * wrong — a daily allowance that reads high just means overspending, three
 * weeks later, for a reason nobody traces back to a division.
 */

/* --------------------------------------------------------- percentUsed -- */

test("spending half the budget is fifty percent", () => {
  assert.equal(percentUsed(500, 1000), 50);
});

test("overspending goes past a hundred rather than capping", () => {
  // The card needs to show how far past, not that it is past.
  assert.equal(percentUsed(1500, 1000), 150);
});

test("a budget of zero is not a division by zero", () => {
  assert.equal(percentUsed(0, 0), 0);
  assert.equal(percentUsed(50, 0), 0);
});

test("a negative budget is treated as no budget", () => {
  assert.equal(percentUsed(50, -100), 0);
});

test("the percentage is rounded to the paisa it is displayed at", () => {
  assert.equal(percentUsed(333.33, 1000), 33.33);
});

/* ------------------------------------------------------------ statusFor -- */

test("below the warning line is healthy", () => {
  assert.equal(statusFor(0), "healthy");
  assert.equal(statusFor(WARNING_THRESHOLD - 0.01), "healthy");
});

test("the warning line itself warns", () => {
  assert.equal(statusFor(WARNING_THRESHOLD), "warning");
  assert.equal(statusFor(99.99), "warning");
});

test("exactly on budget counts as exceeded, not healthy", () => {
  // A budget spent to the last rupee has nothing left in it, and a green card
  // saying so would be a lie.
  assert.equal(statusFor(100), "exceeded");
  assert.equal(statusFor(240), "exceeded");
});

/* ------------------------------------------------------ daysLeftInMonth -- */

test("the whole month is left on the first", () => {
  assert.equal(daysLeftInMonth(1, 31), 31);
});

test("one day is left on the last day of the month", () => {
  // The regression. It returned 0, and the allowance that follows returned
  // nothing, on a card that still showed money remaining.
  assert.equal(daysLeftInMonth(31, 31), 1);
  assert.equal(daysLeftInMonth(28, 28), 1);
});

test("two days are left on the second to last", () => {
  assert.equal(daysLeftInMonth(30, 31), 2);
});

test("a day past the end of the month is never negative", () => {
  // monthProgress pins dayOfMonth to daysInMonth for a past month, but a clock
  // skewed across a timezone can hand this a 32nd.
  assert.equal(daysLeftInMonth(32, 31), 0);
  assert.equal(daysLeftInMonth(99, 28), 0);
});

test("every day of a month gets a positive count, in step", () => {
  for (const daysInMonth of [28, 29, 30, 31]) {
    for (let day = 1; day <= daysInMonth; day += 1) {
      const left = daysLeftInMonth(day, daysInMonth);
      assert.ok(left >= 1, `day ${day} of ${daysInMonth} left ${left}`);
      assert.equal(left, daysInMonth - day + 1);
    }
  }
});

/* -------------------------------------------------------- dailyAllowance -- */

test("what is left, spread over the days that remain", () => {
  assert.equal(dailyAllowance(300, 10), 30);
});

test("an overspent budget allows nothing rather than a negative", () => {
  // A negative allowance on a card reads as money to spend.
  assert.equal(dailyAllowance(-500, 10), 0);
});

test("no days remaining allows nothing rather than dividing by them", () => {
  assert.equal(dailyAllowance(300, 0), 0);
  assert.equal(dailyAllowance(300, -3), 0);
});

test("the allowance rises as the month runs out, not the other way", () => {
  // The same money over fewer days. A sequence that fell would mean the
  // divisor was moving the wrong way.
  let previous = 0;
  for (let day = 1; day <= 31; day += 1) {
    const allowance = dailyAllowance(310, daysLeftInMonth(day, 31));
    assert.ok(allowance >= previous, `day ${day} allowed ${allowance} after ${previous}`);
    previous = allowance;
  }
  assert.equal(previous, 310, "the last day should allow the whole remainder");
});

/* -------------------------------------------------------- projectedSpend -- */

test("the pace so far, carried to the end of the month", () => {
  // ₹100 over ten days of a thirty-day month lands at ₹300.
  assert.equal(projectedSpend(100, 10, 30), 300);
});

test("a finished month projects to what was actually spent", () => {
  assert.equal(projectedSpend(900, 31, 31), 900);
});

test("day zero projects the spend itself, not Infinity", () => {
  // Dividing by it gives Infinity, which renders as "∞" on the card.
  assert.equal(projectedSpend(250, 0, 31), 250);
  assert.ok(Number.isFinite(projectedSpend(250, 0, 31)));
});

test("spending nothing projects nothing", () => {
  assert.equal(projectedSpend(0, 15, 31), 0);
});

/* -------------------------------------------------------------- standing -- */

test("a healthy budget mid-month", () => {
  const result = standing(1000, 200, 10, 31);
  assert.deepEqual(result, {
    spent: 200,
    remaining: 800,
    percentUsed: 20,
    status: "healthy",
    dailyAllowance: 36.36,
    projectedSpend: 620,
  });
});

test("an exceeded budget leaves nothing to spend and a negative remainder", () => {
  const result = standing(1000, 1250, 20, 31);
  assert.equal(result.remaining, -250);
  assert.equal(result.status, "exceeded");
  assert.equal(result.dailyAllowance, 0);
});

test("an untouched budget allows the whole thing, evenly", () => {
  const result = standing(310, 0, 1, 31);
  assert.equal(result.dailyAllowance, 10);
  assert.equal(result.projectedSpend, 0);
  assert.equal(result.status, "healthy");
});

test("spent and remaining always add back to the budget", () => {
  for (const spent of [0, 0.01, 33.333, 999.999, 1000, 1500]) {
    const result = standing(1000, spent, 15, 30);
    assert.ok(
      Math.abs(result.spent + result.remaining - 1000) < 0.01,
      `${result.spent} + ${result.remaining} is not 1000`,
    );
  }
});

test("float noise does not leak into the figures", () => {
  // 0.1 + 0.2 arithmetic reaches a card as 29.999999999999996.
  const result = standing(100, 70.1, 15, 30);
  assert.equal(result.remaining, 29.9);
  assert.equal(String(result.remaining), "29.9");
});

test("the allowance spends exactly the remainder over the days left", () => {
  const result = standing(1000, 400, 20, 31);
  const left = daysLeftInMonth(20, 31);
  assert.ok(
    Math.abs(result.dailyAllowance * left - result.remaining) < left * 0.01,
    `${result.dailyAllowance} × ${left} does not add up to ${result.remaining}`,
  );
});
