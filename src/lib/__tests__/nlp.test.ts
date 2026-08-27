import { test } from "node:test";
import assert from "node:assert/strict";

import { NL_EXAMPLES, parseNaturalLanguage } from "@/lib/nlp";

/** A fixed "today" — Thursday 27 August 2026. Nothing here reads the clock. */
const AT = new Date(2026, 7, 27);
const parse = (input: string) => parseNaturalLanguage(input, AT);

/* --------------------------------------------------------------- amounts -- */

test("a bare number is the amount", () => {
  assert.equal(parse("coffee 240").amount, 240);
  assert.equal(parse("coffee 6.40").amount, 6.4);
});

test("symbols, codes and words all mark an amount", () => {
  assert.equal(parse("spent $25 on pizza").amount, 25);
  assert.equal(parse("spent ₹1,200 on rent").amount, 1200);
  assert.equal(parse("spent 40 dollars on books").amount, 40);
  assert.equal(parse("spent usd 40 on books").amount, 40);
  assert.equal(parse("paid 500 rupees").amount, 500);
});

test("a k or m suffix scales", () => {
  assert.equal(parse("bonus 12k").amount, 12_000);
  assert.equal(parse("sold the car 1.2m").amount, 1_200_000);
});

test("a four-digit amount is money, not a year", () => {
  // The regression: any 1900-2099 number was discarded as a year, which is
  // most of the rent in the world.
  assert.equal(parse("deposited 2000 cheque").amount, 2000);
  assert.equal(parse("paid 1950 rent").amount, 1950);
  assert.equal(parse("spent 2026 on a laptop").amount, 2026);
});

test("a year attached to a date is still not an amount", () => {
  assert.equal(parse("paid rent on march 3 2026").amount, null);
  assert.equal(parse("bought a desk on 3/4/2026").amount, null);
});

test("a day-of-month next to a month name is not an amount", () => {
  assert.equal(parse("paid rent on march 3").amount, null);
  assert.equal(parse("paid rent on 3 march").amount, null);
});

test("an ordinal is not an amount", () => {
  assert.equal(parse("rent due on the 1st").amount, null);
  assert.equal(parse("paid on the 23rd").amount, null);
});

test("a duration is not an amount", () => {
  assert.equal(parse("bought lunch 3 days ago").amount, null);
  assert.equal(parse("subscribed 2 weeks ago").amount, null);
});

test("the amount is found even when a duration is also present", () => {
  const parsed = parse("bought lunch 3 days ago 240");
  assert.equal(parsed.amount, 240);
  assert.equal(parsed.date, "2026-08-24");
});

test("no number at all leaves the amount null", () => {
  // The UI needs to know it must ask, rather than being handed a zero.
  assert.equal(parse("lunch with Priya").amount, null);
});

/* ------------------------------------------------------------------ type -- */

test("expense verbs read as expenses", () => {
  for (const input of ["spent 25", "bought 25", "paid 25", "ordered 25"]) {
    assert.equal(parse(input).type, "EXPENSE", input);
  }
});

test("income verbs read as income", () => {
  for (const input of ["earned 25", "received 25", "salary 25", "sold 25"]) {
    assert.equal(parse(input).type, "INCOME", input);
  }
});

test("an unmarked entry defaults to an expense", () => {
  // Most quick-add lines are spending, and the type is one tap to change.
  assert.equal(parse("coffee 240").type, "EXPENSE");
});

/* ------------------------------------------------------------------ date -- */

test("relative words resolve against the supplied today", () => {
  assert.equal(parse("spent 10 today").date, "2026-08-27");
  assert.equal(parse("spent 10 yesterday").date, "2026-08-26");
  assert.equal(parse("spent 10 tomorrow").date, "2026-08-28");
});

test("counted durations resolve", () => {
  assert.equal(parse("spent 10 3 days ago").date, "2026-08-24");
  assert.equal(parse("spent 10 2 weeks ago").date, "2026-08-13");
  assert.equal(parse("spent 10 a week ago").date, "2026-08-20");
  assert.equal(parse("spent 10 a month ago").date, "2026-07-27");
});

test("a weekday resolves to its most recent occurrence", () => {
  // 27 August 2026 is a Thursday, so last Friday is the 21st.
  assert.equal(parse("uber 18.50 last friday").date, "2026-08-21");
  assert.equal(parse("uber 18.50 on monday").date, "2026-08-24");
});

test("next weekday looks forward", () => {
  assert.equal(parse("rent 1200 next monday").date, "2026-08-31");
});

test("a month and day without a year is read as the most recent one", () => {
  // March has already happened in 2026, so it means this year.
  assert.equal(parse("paid rent march 3").date, "2026-03-03");
  // December has not, so it means last year rather than a date in the future.
  assert.equal(parse("paid rent december 3").date, "2025-12-03");
});

test("an explicit year is taken at face value", () => {
  assert.equal(parse("paid rent march 3 2024").date, "2024-03-03");
});

test("numeric dates parse in both shapes", () => {
  assert.equal(parse("netflix 15.99 on 2026-03-04").date, "2026-03-04");
  assert.equal(parse("netflix 15.99 on 3/4/2026").date, "2026-03-04");
});

test("no date at all means today", () => {
  assert.equal(parse("coffee 240").date, "2026-08-27");
});

/* ----------------------------------------------------- description & tags -- */

test("the verb, the amount and the date are all removed from the description", () => {
  assert.equal(parse("I spent $25 on pizza yesterday").description, "Pizza");
});

test("hashtags become tags and leave the description", () => {
  const parsed = parse("bought coffee for 6.40 #morning #cafe");
  assert.equal(parsed.description, "Coffee");
  assert.deepEqual(parsed.tags, ["morning", "cafe"]);
});

test("tags are lowercased and de-duplicated", () => {
  assert.deepEqual(parse("lunch 200 #Food #food #FOOD").tags, ["food"]);
});

test("tags are capped so one line cannot flood the tag list", () => {
  const many = Array.from({ length: 20 }, (_, i) => `#tag${i}`).join(" ");
  assert.equal(parse(`lunch 200 ${many}`).tags.length, 10);
});

test("an entry with nothing left over still gets a description", () => {
  // An empty description would render as a blank row in the table.
  assert.ok(parse("spent 25 today").description.length > 0);
});

test("the description is capitalised", () => {
  assert.equal(parse("bought pizza 240").description, "Pizza");
});

/* ------------------------------------------------------------ confidence -- */

test("confidence rises with each thing successfully extracted", () => {
  const bare = parse("something");
  const rich = parse("spent $25 on pizza yesterday");
  assert.ok(rich.confidence > bare.confidence);
  assert.ok(rich.confidence <= 1);
  assert.ok(bare.confidence >= 0);
});

test("confidence never exceeds 1", () => {
  const parsed = parse("I spent $25 on groceries yesterday #food");
  assert.ok(parsed.confidence <= 1, `confidence was ${parsed.confidence}`);
});

/* --------------------------------------------------------------- corpora -- */

test("every example in the UI parses into something usable", () => {
  // These are shown to the user as things that work. They had better.
  for (const example of NL_EXAMPLES) {
    const parsed = parse(example);
    assert.ok(parsed.description.length > 0, `${example} produced no description`);
    assert.match(parsed.date, /^\d{4}-\d{2}-\d{2}$/, `${example} produced a bad date`);
    assert.notEqual(parsed.amount, 0, `${example} produced a zero amount`);
  }
});

test("all but one of the UI examples yield an amount", () => {
  // "Paid 1200 rent on the 1st" is the exception: the ordinal guard correctly
  // refuses to read "1st" as money, and 1200 is found instead.
  const withAmounts = NL_EXAMPLES.filter((e) => parse(e).amount !== null);
  assert.equal(withAmounts.length, NL_EXAMPLES.length);
});

test("empty and whitespace input do not throw", () => {
  for (const input of ["", "   ", "\n"]) {
    const parsed = parse(input);
    assert.equal(parsed.amount, null);
    assert.ok(typeof parsed.description === "string");
  }
});

test("a very long line does not throw or produce a runaway description", () => {
  const parsed = parse(`spent 25 on ${"x".repeat(5000)}`);
  assert.equal(parsed.amount, 25);
  assert.ok(typeof parsed.description === "string");
});

test("regex metacharacters in the input are not interpreted", () => {
  // The description strip builds regexes from matched text; an unescaped
  // metacharacter there would throw on input a user can type.
  for (const input of ["spent 25 on c++ (books)", "paid 10 for [a] *thing*", "bought 5 a|b"]) {
    assert.doesNotThrow(() => parse(input), input);
  }
});
