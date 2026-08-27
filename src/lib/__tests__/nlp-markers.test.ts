import { test } from "node:test";
import assert from "node:assert/strict";

import { parseNaturalLanguage } from "@/lib/nlp";

const AT = new Date(2026, 7, 27);
const parse = (input: string) => parseNaturalLanguage(input, AT);

/**
 * A marker is matched as a substring and then cut out of the text, so a
 * shorter marker listed before a longer one it is contained in leaves the
 * remainder behind. "refund" ahead of "refunded" turned "Refunded 50 from
 * Amazon" into the description "Ed Amazon".
 */

test("a longer marker is not shadowed by a shorter one it contains", () => {
  const parsed = parse("Refunded 50 from Amazon");
  assert.equal(parsed.type, "INCOME");
  assert.equal(parsed.description, "Amazon");
  assert.equal(parsed.amount, 50);
});

test("no stray fragment survives from any income marker", () => {
  const cases: [string, string][] = [
    ["Refunded 50 from Amazon", "Amazon"],
    ["Reimbursed 120 for travel", "Travel"],
    ["Received 900 from Ravi", "Ravi"],
    ["Credited 300 interest", "Interest"],
    ["Deposited 850 cheque", "Cheque"],
    ["Earned 750 consulting", "Consulting"],
  ];
  for (const [input, expected] of cases) {
    const parsed = parse(input);
    assert.equal(parsed.description, expected, `${input} produced "${parsed.description}"`);
    assert.equal(parsed.type, "INCOME", `${input} was not read as income`);
  }
});

test("no stray fragment survives from any expense marker", () => {
  const cases: [string, string][] = [
    ["Subscribed to Netflix 15.99", "Netflix"],
    ["Purchased a chair 3400", "Chair"],
    ["Topped up metro card 200", "Metro card"],
    ["Renewed domain 1200", "Domain"],
    ["Withdrew 5000 cash", "Cash"],
    ["Ordered lunch 240", "Lunch"],
    ["Booked flights 8400", "Flights"],
  ];
  for (const [input, expected] of cases) {
    const parsed = parse(input);
    assert.equal(parsed.description, expected, `${input} produced "${parsed.description}"`);
    assert.equal(parsed.type, "EXPENSE", `${input} was not read as an expense`);
  }
});

test("income still wins over expense when both could match", () => {
  // "was paid" and "client paid" both contain "paid", an expense marker.
  assert.equal(parse("I was paid 4500 salary").type, "INCOME");
  assert.equal(parse("Client paid 12000 invoice").type, "INCOME");
  assert.equal(parse("Invoice paid 12000").type, "INCOME");
  // A bare "paid" is still an expense.
  assert.equal(parse("Paid 1200 rent").type, "EXPENSE");
});

test("a description never begins with a fragment of the verb that was cut", () => {
  // A blunt catch-all for the class of bug: two letters left over from a
  // chopped word read as a word, and nothing else notices.
  const inputs = [
    "Refunded 50 from Amazon",
    "Reimbursed 120 for travel",
    "Subscribed to Netflix 15.99",
    "Purchased a chair 3400",
    "Renewed domain 1200",
  ];
  for (const input of inputs) {
    const first = parse(input).description.split(" ")[0].toLowerCase();
    assert.ok(
      first.length > 2,
      `${input} left "${first}" at the front of the description`,
    );
  }
});

test("the marker lists themselves are ordered longest-containing-first", () => {
  // The module asserts this at load time, so importing it at all proves the
  // lists are consistent. This test exists to say so out loud, and to fail
  // loudly rather than as an obscure import error if someone adds a marker.
  assert.doesNotThrow(() => parse("spent 10"));
});
