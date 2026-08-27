import { test } from "node:test";
import assert from "node:assert/strict";

import { buildInsights } from "@/lib/insights";

const summary = (over: Record<string, unknown> = {}) =>
  ({
    income: 3000,
    expenses: 2000,
    savings: 1000,
    savingsRate: 33,
    netCashFlow: 1000,
    expenseChange: null,
    ...over,
  }) as never;

const base = {
  categoryBreakdown: [],
  monthlyTrend: [],
  weeklySpending: [],
  budgets: [],
  goals: [],
  recentTransactions: [],
  currency: "USD",
  locale: "en-US",
  monthProgress: { dayOfMonth: 15, daysInMonth: 30 },
};

const goal = (over: Record<string, unknown> = {}) =>
  ({
    id: "g1",
    name: "Emergency fund",
    status: "ACTIVE",
    requiredPerMonth: 500,
    percentComplete: 20,
    remaining: 4000,
    ...over,
  }) as never;

const ids = (ctx: Record<string, unknown>) =>
  buildInsights({ summary: summary(), ...base, ...ctx } as never).map((i) => i.id);

/* ------------------------------------------------------------------ goals -- */

test("a goal needing more than was saved is flagged", () => {
  assert.ok(ids({ goals: [goal()], summary: summary({ savings: 100 }) }).includes("goal-at-risk"));
});

test("a goal is still flagged in a month that saved nothing", () => {
  // The regression: a `savings > 0` guard meant the warning vanished exactly
  // when every goal was in trouble.
  assert.ok(
    ids({ goals: [goal()], summary: summary({ savings: 0, savingsRate: 0, netCashFlow: 0 }) })
      .includes("goal-at-risk"),
  );
});

test("a goal is still flagged in a month that ran a deficit", () => {
  assert.ok(
    ids({
      goals: [goal()],
      summary: summary({ savings: -400, savingsRate: -13, netCashFlow: -400, expenses: 3400 }),
    }).includes("goal-at-risk"),
  );
});

test("a goal comfortably covered by this month's saving is not flagged", () => {
  assert.ok(
    !ids({ goals: [goal({ requiredPerMonth: 100 })], summary: summary({ savings: 1000 }) })
      .includes("goal-at-risk"),
  );
});

test("a goal with no monthly requirement is never at risk", () => {
  // No target date means no required rate to fall behind.
  assert.ok(
    !ids({ goals: [goal({ requiredPerMonth: null })], summary: summary({ savings: 0 }) })
      .includes("goal-at-risk"),
  );
});

test("only active goals are considered", () => {
  for (const status of ["COMPLETED", "ARCHIVED"]) {
    assert.ok(
      !ids({ goals: [goal({ status })], summary: summary({ savings: 0 }) })
        .includes("goal-at-risk"),
    );
  }
});

test("the widest shortfall is the one reported", () => {
  const out = buildInsights({
    ...base,
    summary: summary({ savings: 0 }),
    goals: [goal({ id: "a", name: "Small", requiredPerMonth: 200 }), goal({ id: "b", name: "Big", requiredPerMonth: 900 })],
  } as never);
  const risk = out.find((i) => i.id === "goal-at-risk");
  assert.match(risk!.title, /Big/);
});

test("the copy reads correctly at zero and below", () => {
  const at = (savings: number) =>
    buildInsights({ ...base, summary: summary({ savings }), goals: [goal()] } as never).find(
      (i) => i.id === "goal-at-risk",
    )!.detail;

  assert.match(at(0), /nothing was left over/);
  assert.match(at(-400), /short of breaking even/);
  assert.doesNotMatch(at(-400), /saved −/, "a negative saving must not read as 'saved −$400'");
  assert.match(at(100), /you saved/);
});

test("a goal near completion is celebrated", () => {
  assert.ok(
    ids({ goals: [goal({ percentComplete: 85, requiredPerMonth: null })] }).includes("goal-close"),
  );
});

/* ------------------------------------------------------------- essentials -- */

test("a negative cash flow outranks everything else", () => {
  const out = ids({ summary: summary({ savings: -500, netCashFlow: -500, expenses: 3500 }) });
  assert.equal(out[0], "negative-cash-flow");
});

test("an exceeded budget outranks a warning one", () => {
  const budget = (over: Record<string, unknown>) =>
    ({
      status: "warning",
      percentUsed: 85,
      amount: 1000,
      spent: 850,
      remaining: 150,
      dailyAllowance: 10,
      projectedSpend: 900,
      category: { name: "Food" },
      ...over,
    }) as never;

  const out = ids({
    budgets: [budget({}), budget({ status: "exceeded", percentUsed: 130, spent: 1300 })],
  });
  assert.ok(out.includes("budget-exceeded"));
  assert.ok(!out.includes("budget-warning"), "both must not fire at once");
});

test("nothing to say produces the getting-started card rather than an empty panel", () => {
  const out = buildInsights({
    ...base,
    summary: summary({ income: 0, expenses: 0, savings: 0, savingsRate: 0, netCashFlow: 0 }),
    monthProgress: { dayOfMonth: 1, daysInMonth: 30 },
  } as never);
  assert.deepEqual(out.map((i) => i.id), ["getting-started"]);
});

test("at most six insights are returned, strongest first", () => {
  const out = buildInsights({
    ...base,
    summary: summary({ savings: -500, netCashFlow: -500, expenses: 3500, expenseChange: 40 }),
    goals: [goal(), goal({ id: "g2", percentComplete: 90, requiredPerMonth: null })],
    categoryBreakdown: [{ name: "Food", total: 2000, count: 12, share: 60 }],
    recentTransactions: Array.from({ length: 5 }, (_, i) => ({
      type: "EXPENSE",
      amount: i === 0 ? 1500 : 50,
      description: "Laptop",
    })),
  } as never);
  assert.ok(out.length <= 6, `got ${out.length}`);
  assert.equal(out[0].id, "negative-cash-flow");
});

test("the score is never leaked to the UI", () => {
  const out = buildInsights({ ...base, summary: summary() } as never);
  for (const insight of out) {
    assert.ok(!("score" in insight), "score is an internal ranking field");
  }
});
