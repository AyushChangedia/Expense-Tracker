import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import { serialize, toDecimal, toNumber } from "@/lib/serialize";

const D = (v: string | number) => new Prisma.Decimal(v);

/* ------------------------------------------------------------- serialize -- */

test("a Decimal becomes a plain number", () => {
  // Decimal instances throw when passed across the server/client boundary.
  assert.equal(serialize(D("1234.56")), 1234.56);
  assert.equal(serialize(D("0")), 0);
});

test("a Date becomes an ISO string", () => {
  assert.equal(serialize(new Date("2026-03-04T00:00:00.000Z")), "2026-03-04T00:00:00.000Z");
});

test("nested objects and arrays are converted all the way down", () => {
  const input = {
    id: "t1",
    amount: D("240.00"),
    date: new Date("2026-03-04T00:00:00.000Z"),
    category: { name: "Food", budget: D("500") },
    tags: [{ name: "coffee", createdAt: new Date("2026-01-01T00:00:00.000Z") }],
  };
  assert.deepEqual(serialize(input), {
    id: "t1",
    amount: 240,
    date: "2026-03-04T00:00:00.000Z",
    category: { name: "Food", budget: 500 },
    tags: [{ name: "coffee", createdAt: "2026-01-01T00:00:00.000Z" }],
  });
});

test("an array of rows is converted element by element", () => {
  assert.deepEqual(serialize([{ amount: D("1.5") }, { amount: D("2.5") }]), [
    { amount: 1.5 },
    { amount: 2.5 },
  ]);
});

test("null and undefined pass through untouched", () => {
  assert.equal(serialize(null), null);
  assert.equal(serialize(undefined), undefined);
  assert.deepEqual(serialize({ notes: null }), { notes: null });
});

test("primitives are returned as they are", () => {
  assert.equal(serialize("Coffee"), "Coffee");
  assert.equal(serialize(42), 42);
  assert.equal(serialize(true), true);
});

test("the output survives a JSON round trip", () => {
  // Which is the entire point: it has to cross the RSC boundary.
  const out = serialize({ amount: D("240.00"), date: new Date("2026-03-04T00:00:00.000Z") });
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
});

test("a Decimal keeps its precision to the cent", () => {
  assert.equal(serialize(D("0.07")), 0.07);
  assert.equal(serialize(D("999999999.99")), 999999999.99);
});

/* -------------------------------------------------------------- toNumber -- */

test("toNumber accepts every shape money arrives in", () => {
  assert.equal(toNumber(D("12.34")), 12.34);
  assert.equal(toNumber(12.34), 12.34);
  assert.equal(toNumber("12.34"), 12.34);
});

test("toNumber defaults to zero rather than producing NaN", () => {
  // The results feed sums and chart axes, where one NaN poisons the total.
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber("abc"), 0);
  assert.equal(toNumber(Number.NaN), 0);
  assert.equal(toNumber(Number.POSITIVE_INFINITY), 0);
});

/* ------------------------------------------------------------- toDecimal -- */

test("toDecimal keeps two decimal places", () => {
  assert.equal(toDecimal(12.5).toString(), "12.5");
  assert.equal(toDecimal(12.345).toString(), "12.35");
  assert.equal(toDecimal(0.005).toString(), "0.01");
});

test("toDecimal refuses a non-finite value instead of storing it", () => {
  // new Prisma.Decimal("NaN") is a valid Decimal that only fails at the
  // INSERT, as a driver error naming a column rather than the arithmetic.
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => toDecimal(bad), /currency amount/, String(bad));
  }
});

test("toDecimal and toNumber round-trip an amount", () => {
  for (const value of [0.01, 12.34, 240, 999999999.99]) {
    assert.equal(toNumber(toDecimal(value)), value, String(value));
  }
});
