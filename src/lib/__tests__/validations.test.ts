import { test } from "node:test";
import assert from "node:assert/strict";

import {
  amountSchema,
  budgetSchema,
  categorySchema,
  changePasswordSchema,
  dateSchema,
  goalSchema,
  passwordSchema,
  signUpSchema,
  transactionFilterSchema,
  transactionSchema,
} from "@/lib/validations";

const ok = <T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, value: unknown) =>
  schema.safeParse(value).success;

/* --------------------------------------------------------------- amounts -- */

test("an amount must be a positive, finite number", () => {
  assert.ok(ok(amountSchema, 25));
  assert.ok(ok(amountSchema, 0.01));
  assert.ok(!ok(amountSchema, 0), "zero is not a transaction");
  assert.ok(!ok(amountSchema, -5));
  assert.ok(!ok(amountSchema, Number.POSITIVE_INFINITY));
  assert.ok(!ok(amountSchema, Number.NaN));
});

test("an amount is capped at the Decimal(14,2) limit", () => {
  assert.ok(ok(amountSchema, 999_999_999.99));
  assert.ok(!ok(amountSchema, 1_000_000_000));
});

test("an amount may not carry more than two decimals", () => {
  // The column stores two; a third would be silently rounded on write.
  assert.ok(ok(amountSchema, 12.34));
  assert.ok(!ok(amountSchema, 12.345));
});

test("a string amount is rejected rather than coerced", () => {
  // Coercion here would turn a typo into a number and book it.
  assert.ok(!ok(amountSchema, "25"));
});

/* ----------------------------------------------------------------- dates -- */

test("a date accepts a Date, an ISO string and a plain day", () => {
  assert.ok(ok(dateSchema, new Date()));
  assert.ok(ok(dateSchema, "2026-03-04"));
  assert.ok(ok(dateSchema, "2026-03-04T12:00:00.000Z"));
});

test("an unparseable date is rejected with a message, not silently today", () => {
  const result = dateSchema.safeParse("not a date");
  assert.ok(!result.success);
  assert.match(result.error.issues[0].message, /valid date/i);
});

test("an empty date is rejected", () => {
  assert.ok(!ok(dateSchema, ""));
});

/* ------------------------------------------------------------- passwords -- */

test("a password needs length and three character classes", () => {
  assert.ok(ok(passwordSchema, "Password1"));
  assert.ok(!ok(passwordSchema, "Pass1"), "too short");
  assert.ok(!ok(passwordSchema, "password1"), "no uppercase");
  assert.ok(!ok(passwordSchema, "PASSWORD1"), "no lowercase");
  assert.ok(!ok(passwordSchema, "PasswordX"), "no digit");
});

test("passwords are capped at bcrypt's 72-byte input limit", () => {
  // Anything past 72 bytes is silently ignored by bcrypt, so two different
  // long passwords would hash identically.
  assert.ok(ok(passwordSchema, `Aa1${"x".repeat(69)}`));
  assert.ok(!ok(passwordSchema, `Aa1${"x".repeat(80)}`));
});

test("sign-up requires the confirmation to match, and says which field is wrong", () => {
  const result = signUpSchema.safeParse({
    name: "Ayush",
    email: "a@example.com",
    password: "Password1",
    confirmPassword: "Password2",
  });
  assert.ok(!result.success);
  assert.deepEqual(result.error.issues[0].path, ["confirmPassword"]);
});

test("sign-up normalises the email", () => {
  const result = signUpSchema.safeParse({
    name: "Ayush",
    email: "  AYUSH@Example.COM  ",
    password: "Password1",
    confirmPassword: "Password1",
  });
  assert.ok(result.success);
  assert.equal(result.data.email, "ayush@example.com");
});

test("a password change may not reuse the current password", () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: "Password1",
    newPassword: "Password1",
    confirmPassword: "Password1",
  });
  assert.ok(!result.success);
  assert.deepEqual(result.error.issues[0].path, ["newPassword"]);
});

/* ---------------------------------------------------------- transactions -- */

const validTransaction = {
  type: "EXPENSE",
  amount: 240,
  description: "Coffee",
  categoryId: "cat_1",
  date: "2026-03-04",
};

test("a well-formed transaction passes and takes its defaults", () => {
  const result = transactionSchema.safeParse(validTransaction);
  assert.ok(result.success);
  assert.deepEqual(result.data.tags, []);
  assert.equal(result.data.isPinned, false);
});

test("a transaction needs a description and a category", () => {
  assert.ok(!ok(transactionSchema, { ...validTransaction, description: "" }));
  assert.ok(!ok(transactionSchema, { ...validTransaction, description: "   " }));
  assert.ok(!ok(transactionSchema, { ...validTransaction, categoryId: "" }));
});

test("a transaction description is trimmed and length-capped", () => {
  const result = transactionSchema.safeParse({ ...validTransaction, description: "  Coffee  " });
  assert.ok(result.success);
  assert.equal(result.data.description, "Coffee");
  assert.ok(!ok(transactionSchema, { ...validTransaction, description: "x".repeat(141) }));
});

test("tags are capped so one transaction cannot carry hundreds", () => {
  assert.ok(ok(transactionSchema, { ...validTransaction, tags: ["a", "b"] }));
  assert.ok(
    !ok(transactionSchema, {
      ...validTransaction,
      tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
    }),
  );
});

/* --------------------------------------------------------------- filters -- */

test("an empty filter object yields a usable default page", () => {
  const result = transactionFilterSchema.safeParse({});
  assert.ok(result.success);
  assert.equal(result.data.type, "ALL");
  assert.equal(result.data.page, 1);
  assert.equal(result.data.pageSize, 10);
  assert.equal(result.data.sort, "date");
  assert.equal(result.data.direction, "desc");
});

test("the page size is bounded so a crafted request cannot ask for everything", () => {
  assert.ok(!ok(transactionFilterSchema, { pageSize: 5000 }));
  assert.ok(!ok(transactionFilterSchema, { pageSize: 1 }));
  assert.ok(ok(transactionFilterSchema, { pageSize: 100 }));
});

test("the page number must be a positive integer", () => {
  assert.ok(!ok(transactionFilterSchema, { page: 0 }));
  assert.ok(!ok(transactionFilterSchema, { page: -1 }));
  assert.ok(!ok(transactionFilterSchema, { page: 1.5 }));
});

test("only known sort columns are accepted", () => {
  // The value reaches Prisma's orderBy, so an unknown column must not pass.
  assert.ok(ok(transactionFilterSchema, { sort: "amount" }));
  assert.ok(!ok(transactionFilterSchema, { sort: "password" }));
});

/* --------------------------------------------------- budgets, goals, cats -- */

test("a budget month and year must be real", () => {
  assert.ok(ok(budgetSchema, { amount: 500, month: 12, year: 2026 }));
  assert.ok(!ok(budgetSchema, { amount: 500, month: 13, year: 2026 }));
  assert.ok(!ok(budgetSchema, { amount: 500, month: 0, year: 2026 }));
  assert.ok(!ok(budgetSchema, { amount: 500, month: 6, year: 1999 }));
});

test("a budget with no category is an overall budget", () => {
  assert.ok(ok(budgetSchema, { categoryId: null, amount: 500, month: 6, year: 2026 }));
  assert.ok(ok(budgetSchema, { amount: 500, month: 6, year: 2026 }));
});

test("a goal takes sensible defaults and rejects a negative balance", () => {
  const result = goalSchema.safeParse({ name: "Emergency fund", targetAmount: 5000 });
  assert.ok(result.success);
  assert.equal(result.data.currentAmount, 0);
  assert.equal(result.data.icon, "Target");
  assert.ok(!ok(goalSchema, { name: "x", targetAmount: 5000, currentAmount: -1 }));
});

test("a category needs six-digit hex colours", () => {
  const valid = {
    name: "Food",
    kind: "EXPENSE",
    icon: "Utensils",
    gradientFrom: "#7C3AED",
    gradientTo: "#38BDF8",
  };
  assert.ok(ok(categorySchema, valid));
  assert.ok(!ok(categorySchema, { ...valid, gradientFrom: "#7C3" }), "shorthand hex");
  assert.ok(!ok(categorySchema, { ...valid, gradientFrom: "purple" }), "a colour name");
  assert.ok(!ok(categorySchema, { ...valid, gradientFrom: "7C3AED" }), "no leading hash");
});

test("ordinary two-decimal amounts are not caught by the decimal check", () => {
  // The check cannot be Number.isInteger(value * 100): 12.34 * 100 is
  // 1233.9999999999998, and this list is the regression guard for that.
  for (const value of [12.34, 0.07, 1.1, 99.99, 1234.56, 0.29, 8.14, 100.05]) {
    assert.ok(ok(amountSchema, value), `${value} was wrongly rejected`);
  }
});

test("a third decimal place is rejected however it is written", () => {
  for (const value of [12.345, 0.001, 1.234, 999.999]) {
    assert.ok(!ok(amountSchema, value), `${value} was wrongly accepted`);
  }
});
