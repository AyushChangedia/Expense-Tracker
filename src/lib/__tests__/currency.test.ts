import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencySymbol,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  parseAmount,
} from "@/lib/currency";

/* ------------------------------------------------------------- symbols -- */

test("every curated currency has a code, label and symbol", () => {
  for (const entry of CURRENCIES) {
    assert.match(entry.code, /^[A-Z]{3}$/, `${entry.label} has a malformed code`);
    assert.ok(entry.label.length > 0);
    assert.ok(entry.symbol.length > 0);
  }
});

test("currency codes are unique", () => {
  const codes = CURRENCIES.map((c) => c.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("the default currency is one of the curated options", () => {
  assert.ok(CURRENCIES.some((c) => c.code === DEFAULT_CURRENCY));
});

test("curated symbols come from the list, not from Intl", () => {
  assert.equal(currencySymbol("INR"), "₹");
  assert.equal(currencySymbol("USD"), "$");
  assert.equal(currencySymbol("CAD"), "CA$");
});

test("an uncurated but real currency still resolves a symbol", () => {
  // Intl fills the gap for anything outside the curated dozen.
  assert.equal(typeof currencySymbol("SEK"), "string");
  assert.ok(currencySymbol("SEK").length > 0);
});

test("an unknown code falls back to the code itself rather than throwing", () => {
  assert.equal(currencySymbol("NOTACURRENCY"), "NOTACURRENCY");
});

/* ----------------------------------------------------------- formatting -- */

test("a plain amount formats with two decimals", () => {
  assert.equal(formatCurrency(1234.5, { currency: "USD" }), "$1,234.50");
});

test("a negative amount uses a real minus sign, not a hyphen", () => {
  const out = formatCurrency(-40, { currency: "USD" });
  assert.ok(out.startsWith("−"), `expected a U+2212 minus, got ${out}`);
  assert.ok(out.includes("40.00"));
});

test("signed formatting marks positives explicitly", () => {
  assert.ok(formatCurrency(40, { currency: "USD", signed: true }).startsWith("+"));
  assert.ok(formatCurrency(-40, { currency: "USD", signed: true }).startsWith("−"));
});

test("zero is never signed, in either direction", () => {
  // A "+$0.00" delta reads as a gain that did not happen.
  const out = formatCurrency(0, { currency: "USD", signed: true });
  assert.equal(out, "$0.00");
});

test("compact only kicks in from five figures up", () => {
  // Below the threshold, compact must not change anything.
  assert.equal(
    formatCurrency(9999, { currency: "USD", compact: true }),
    formatCurrency(9999, { currency: "USD" }),
  );
  assert.match(formatCurrency(12_500, { currency: "USD", compact: true }), /12\.5K/);
});

test("an explicit maximumFractionDigits above the default is honoured", () => {
  assert.equal(
    formatCurrency(1234.5678, { currency: "USD", maximumFractionDigits: 3 }),
    "$1,234.568",
  );
});

test("a non-finite amount formats as zero instead of NaN", () => {
  // Reaching the DOM as "$NaN" is worse than being wrong quietly.
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(formatCurrency(bad, { currency: "USD" }), "$0.00");
  }
});

test("an invalid currency code falls back instead of throwing", () => {
  const out = formatCurrency(12, { currency: "NOTACURRENCY" });
  assert.ok(out.includes("12.00"));
});

test("locale changes the grouping, not the amount", () => {
  const us = formatCurrency(1234.5, { currency: "EUR", locale: "en-US" });
  const de = formatCurrency(1234.5, { currency: "EUR", locale: "de-DE" });
  assert.notEqual(us, de);
  assert.ok(us.includes("1,234.50"));
});

test("compact number labels stay short", () => {
  assert.equal(formatCompactNumber(340), "340");
  assert.equal(formatCompactNumber(1200), "1.2K");
  assert.equal(formatCompactNumber(1_100_000), "1.1M");
});

test("percentages carry an explicit + but no explicit −", () => {
  // The minus is already there in the number.
  assert.equal(formatPercent(12.34), "+12.3%");
  assert.equal(formatPercent(-12.34), "-12.3%");
  assert.equal(formatPercent(0), "0.0%");
});

test("a non-finite percentage renders as an em dash", () => {
  // percentChange returns null for "no baseline"; NaN must not reach the UI.
  assert.equal(formatPercent(Number.NaN), "—");
  assert.equal(formatPercent(Number.POSITIVE_INFINITY), "—");
});

/* -------------------------------------------------------------- parsing -- */

test("plain numbers parse", () => {
  assert.equal(parseAmount("25"), 25);
  assert.equal(parseAmount("25.50"), 25.5);
});

test("currency symbols and grouping are stripped", () => {
  assert.equal(parseAmount("$1,234.50"), 1234.5);
  assert.equal(parseAmount("₹1,200"), 1200);
  assert.equal(parseAmount("  £99.99  "), 99.99);
});

test("k and m suffixes multiply", () => {
  assert.equal(parseAmount("12k"), 12_000);
  assert.equal(parseAmount("12.5k"), 12_500);
  assert.equal(parseAmount("1.5m"), 1_500_000);
  assert.equal(parseAmount("2 k"), 2000);
});

test("a comma is a decimal separator when it is not grouping three digits", () => {
  // "1,50" is €1.50 in most of Europe; "1,500" is 1500 everywhere.
  assert.equal(parseAmount("1,50"), 1.5);
  assert.equal(parseAmount("1,500"), 1500);
});

test("with both separators present, the last one is the decimal point", () => {
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseAmount("1,234.50"), 1234.5);
});

test("a space-grouped European amount parses", () => {
  assert.equal(parseAmount("1 234,50"), 1234.5);
});

test("negatives survive", () => {
  assert.equal(parseAmount("-45.20"), -45.2);
  assert.equal(parseAmount("-$45.20"), -45.2);
});

test("nothing numeric returns null rather than zero or NaN", () => {
  // Returning 0 would silently import a free transaction.
  for (const junk of ["", "   ", "abc", "$", "--", "n/a"]) {
    assert.equal(parseAmount(junk), null, `expected null for ${JSON.stringify(junk)}`);
  }
});

test("a non-string input returns null", () => {
  assert.equal(parseAmount(null as unknown as string), null);
  assert.equal(parseAmount(undefined as unknown as string), null);
  assert.equal(parseAmount(42 as unknown as string), null);
});
