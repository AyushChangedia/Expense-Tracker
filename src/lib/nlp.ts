import { addDays, format, startOfWeek, subDays, subWeeks } from "date-fns";

import { CATEGORY_KEYWORDS } from "@/lib/categories";
import { parseAmount } from "@/lib/currency";
import type { ParsedTransactionDraft } from "@/types";
import type { TransactionType } from "@prisma/client";

/**
 * Deterministic natural-language parser for the quick-add box.
 *
 * Turns "I spent $25 on pizza yesterday #dinner" into a transaction draft.
 * Everything here is rule-based — no network call, no API key — so the feature
 * works identically offline, in CI, and on a fresh clone.
 */

/**
 * Order matters twice over.
 *
 * Income is checked before expense so "was paid" wins over "paid". And within
 * a list a longer marker must come before any marker it contains, because the
 * match is a substring test and the matched text is then cut out of the
 * description: with "refund" ahead of "refunded", typing "Refunded 50 from
 * Amazon" removed the first six letters and left the description as
 * "Ed Amazon". `assertLongestFirst` below makes that ordering a startup
 * failure rather than something to notice in the UI months later.
 */
const INCOME_MARKERS = [
  "got paid", "was paid", "invoice paid", "client paid", "reimbursed",
  "refunded", "refund", "deposited", "received", "credited", "cashback",
  "paycheck", "dividend", "earned", "salary", "income", "bonus", "sold",
];

const EXPENSE_MARKERS = [
  "subscribed", "purchased", "topped up", "withdrew", "charged", "ordered",
  "renewed", "expense", "booked", "bought", "spent", "spend", "paid", "cost",
  "buy",
];

/**
 * Guards the invariant above: no marker may appear after one it contains.
 *
 * Cheap enough to run at module load, and it turns a silently mangled
 * description into an error the first time anyone imports this file.
 */
function assertLongestFirst(markers: string[], label: string): void {
  for (let i = 0; i < markers.length; i += 1) {
    for (let j = i + 1; j < markers.length; j += 1) {
      if (markers[j].includes(markers[i])) {
        throw new Error(
          `${label}: "${markers[j]}" contains "${markers[i]}" but is listed after it — ` +
            `the shorter one would match first and leave the remainder in the description.`,
        );
      }
    }
  }
}

assertLongestFirst(INCOME_MARKERS, "INCOME_MARKERS");
assertLongestFirst(EXPENSE_MARKERS, "EXPENSE_MARKERS");

/** Words removed from the description once the meaning has been extracted. */
const FILLER = new Set([
  "i", "ive", "just", "a", "an", "the", "some", "my", "of", "to", "at", "on",
  "for", "from", "in", "with", "and", "was", "were", "is", "am", "it", "this",
  "that", "there", "today", "yesterday", "tomorrow", "yday",
]);

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

type Extraction<T> = { value: T; consumed: string[] };

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

function extractType(text: string): Extraction<TransactionType> {
  for (const marker of INCOME_MARKERS) {
    if (text.includes(marker)) return { value: "INCOME", consumed: [marker] };
  }
  for (const marker of EXPENSE_MARKERS) {
    if (text.includes(marker)) return { value: "EXPENSE", consumed: [marker] };
  }
  return { value: "EXPENSE", consumed: [] };
}

// ---------------------------------------------------------------------------
// Amount
// ---------------------------------------------------------------------------

/**
 * Matches "$25", "25.50", "1,200", "12k", "30 dollars", "₹500", "eur 40".
 *
 * The pattern itself is greedy about what counts as a number; the filtering of
 * dates, ordinals and durations happens in extractAmount, where the
 * surrounding words are available to judge by.
 */
const AMOUNT_PATTERN = new RegExp(
  [
    // Symbol-prefixed: $25.50, ₹1,200, €12k
    String.raw`(?:[$€£₹¥]\s?\d[\d,]*(?:\.\d{1,2})?\s?[km]?)`,
    // Code-prefixed or suffixed: usd 40, 40 usd, 40 dollars, 40 bucks
    String.raw`(?:(?:usd|eur|gbp|inr|jpy|cad|aud|rs)\s?\d[\d,]*(?:\.\d{1,2})?\s?[km]?)`,
    String.raw`(?:\d[\d,]*(?:\.\d{1,2})?\s?[km]?\s?(?:usd|eur|gbp|inr|jpy|cad|aud|rs|dollars?|euros?|pounds?|rupees?|bucks))`,
    // Bare number. extractAmount decides whether it is money or a date.
    String.raw`(?:\b\d[\d,]*(?:\.\d{1,2})?\s?[km]?\b)`,
  ].join("|"),
  "gi",
);

const MONTH_ALTERNATION = MONTHS.join("|");

/**
 * Is this bare number part of a date rather than an amount?
 *
 * The test has to look at the surrounding text, not at the number. "2026" is
 * a year in "march 3 2026" and 2026 rupees in "deposited 2026 cheque", and
 * nothing about the digits themselves separates the two. Rejecting every
 * 1900-2099 number outright — which is what this used to do — quietly threw
 * away the amount on any transaction between 1,900 and 2,099, a range most
 * people's rent sits in.
 */
function looksLikeDatePart(digits: string, text: string): boolean {
  const beforeMonth = String.raw`\b${digits}\s*(?:st|nd|rd|th)?\s*(?:of\s+)?(?:${MONTH_ALTERNATION})\b`;
  const afterMonth = String.raw`\b(?:${MONTH_ALTERNATION})\s+\d{1,2}(?:st|nd|rd|th)?,?\s*${digits}\b`;
  const asDayOfMonth = String.raw`\b(?:${MONTH_ALTERNATION})\s+${digits}\b`;
  // 3/4/2026 and 2026-03-04, from either side of the separator.
  const inNumericDate = String.raw`\b${digits}\s*[/-]|[/-]\s*${digits}\b`;

  return new RegExp(
    [beforeMonth, afterMonth, asDayOfMonth, inNumericDate].join("|"),
  ).test(text);
}

function extractAmount(text: string): Extraction<number | null> {
  const matches = Array.from(text.matchAll(AMOUNT_PATTERN)).map((m) => m[0]);

  for (const raw of matches) {
    const trimmed = raw.trim();
    const digitsOnly = trimmed.replace(/[^0-9]/g, "");

    // Skip things that are clearly part of a date rather than an amount. Only
    // bare numbers are ambiguous — "$2026" is unambiguously money.
    const isBare = !/[$€£₹¥]|usd|eur|gbp|inr|jpy|cad|aud|rs|dollar|euro|pound|rupee|buck/i.test(trimmed);
    if (isBare) {
      if (new RegExp(`${digitsOnly}\\s*(st|nd|rd|th)\\b`).test(text)) continue; // ordinal
      if (new RegExp(`${digitsOnly}\\s*(days?|weeks?|months?|years?|hours?)\\b`).test(text)) {
        continue; // "3 days ago"
      }
      if (looksLikeDatePart(digitsOnly, text)) continue;
    }

    const value = parseAmount(trimmed);
    if (value !== null && value > 0) {
      return { value: Math.round(value * 100) / 100, consumed: [trimmed] };
    }
  }

  return { value: null, consumed: [] };
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

function extractDate(text: string, today = new Date()): Extraction<Date> {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const simple: [RegExp, Date][] = [
    [/\btoday\b/, base],
    [/\b(yesterday|yday)\b/, subDays(base, 1)],
    [/\btomorrow\b/, addDays(base, 1)],
    [/\bday before yesterday\b/, subDays(base, 2)],
  ];
  for (const [pattern, value] of simple) {
    const match = text.match(pattern);
    if (match) return { value, consumed: [match[0]] };
  }

  // "3 days ago", "2 weeks ago", "a week ago"
  const ago = text.match(/\b(?:(\d+)|a|an)\s+(day|week|month|year)s?\s+ago\b/);
  if (ago) {
    const count = ago[1] ? Number.parseInt(ago[1], 10) : 1;
    const unit = ago[2];
    const value =
      unit === "day"
        ? subDays(base, count)
        : unit === "week"
          ? subWeeks(base, count)
          : unit === "month"
            ? new Date(base.getFullYear(), base.getMonth() - count, base.getDate())
            : new Date(base.getFullYear() - count, base.getMonth(), base.getDate());
    return { value, consumed: [ago[0]] };
  }

  // "last monday" / "on friday" / "this tuesday"
  const weekday = text.match(
    new RegExp(`\\b(last|this|on|next)?\\s*(${WEEKDAYS.join("|")})\\b`),
  );
  if (weekday) {
    const targetIndex = WEEKDAYS.indexOf(weekday[2]);
    const qualifier = weekday[1];
    if (qualifier === "next") {
      const startNext = addDays(startOfWeek(base, { weekStartsOn: 0 }), 7);
      return { value: addDays(startNext, targetIndex), consumed: [weekday[0].trim()] };
    }
    // Default to the most recent occurrence, including today.
    let cursor = base;
    for (let i = 0; i < 7; i += 1) {
      if (cursor.getDay() === targetIndex) break;
      cursor = subDays(cursor, 1);
    }
    return { value: cursor, consumed: [weekday[0].trim()] };
  }

  // "on march 3", "3 march", "march 3rd 2026"
  const monthDay = text.match(
    new RegExp(
      `\\b(?:(${MONTHS.join("|")})\\s+(\\d{1,2})|(\\d{1,2})\\s+(${MONTHS.join("|")}))(?:\\s*,?\\s*(\\d{4}))?\\b`,
    ),
  );
  if (monthDay) {
    const monthName = monthDay[1] ?? monthDay[4];
    const day = Number.parseInt(monthDay[2] ?? monthDay[3], 10);
    const year = monthDay[5] ? Number.parseInt(monthDay[5], 10) : base.getFullYear();
    const monthIndex = MONTHS.indexOf(monthName);
    if (monthIndex >= 0 && day >= 1 && day <= 31) {
      let value = new Date(year, monthIndex, day);
      // Without an explicit year, a future date almost certainly means last year.
      if (!monthDay[5] && value.getTime() > base.getTime()) {
        value = new Date(year - 1, monthIndex, day);
      }
      return { value, consumed: [monthDay[0]] };
    }
  }

  // Numeric: 3/4/2026, 2026-03-04, 3-4
  const numeric = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (numeric) {
    const value = new Date(
      Number.parseInt(numeric[1], 10),
      Number.parseInt(numeric[2], 10) - 1,
      Number.parseInt(numeric[3], 10),
    );
    if (!Number.isNaN(value.getTime())) {
      return { value, consumed: [numeric[0]] };
    }
  }

  const slashed = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashed) {
    const month = Number.parseInt(slashed[1], 10);
    const day = Number.parseInt(slashed[2], 10);
    let year = slashed[3] ? Number.parseInt(slashed[3], 10) : base.getFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { value: new Date(year, month - 1, day), consumed: [slashed[0]] };
    }
  }

  // "last week" / "last month" as a coarse fallback.
  const lastPeriod = text.match(/\blast\s+(week|month)\b/);
  if (lastPeriod) {
    const value =
      lastPeriod[1] === "week"
        ? subWeeks(base, 1)
        : new Date(base.getFullYear(), base.getMonth() - 1, base.getDate());
    return { value, consumed: [lastPeriod[0]] };
  }

  return { value: base, consumed: [] };
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

function extractCategory(
  text: string,
  type: TransactionType,
): { slug: string | null; score: number } {
  let best: { slug: string; score: number } | null = null;

  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      // Word-boundary match so "gas" does not fire inside "gasket".
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (!pattern.test(text)) continue;

      // Longer keywords are more specific, so they win ties.
      let score = keyword.length;

      // A category on the wrong side of the ledger is a weak signal at best.
      const incomeSlugs = ["salary", "freelance", "business"];
      const isIncomeSlug = incomeSlugs.includes(slug);
      if (isIncomeSlug !== (type === "INCOME")) score -= 6;

      if (!best || score > best.score) best = { slug, score };
    }
  }

  if (!best || best.score <= 0) return { slug: null, score: 0 };
  return { slug: best.slug, score: best.score };
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

function extractDescription(original: string, consumed: string[]): string {
  let working = ` ${original} `;

  for (const chunk of consumed) {
    if (!chunk) continue;
    working = working.replace(
      new RegExp(chunk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      " ",
    );
  }

  // Strip hashtags — they become tags, not part of the description.
  working = working.replace(/#[\w-]+/g, " ");

  const words = working
    .split(/\s+/)
    .map((word) => word.replace(/^[^\w$]+|[^\w%]+$/g, ""))
    .filter(Boolean)
    .filter((word) => !FILLER.has(word.toLowerCase()));

  if (words.length === 0) return "";

  const phrase = words.join(" ").trim();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function extractTags(original: string): string[] {
  const matches = original.match(/#[\w-]+/g) ?? [];
  return Array.from(
    new Set(matches.map((tag) => tag.slice(1).toLowerCase()).filter(Boolean)),
  ).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseNaturalLanguage(
  input: string,
  today = new Date(),
): ParsedTransactionDraft {
  const original = input.trim();
  const lower = original.toLowerCase();

  const type = extractType(lower);
  const amount = extractAmount(lower);
  const date = extractDate(lower, today);
  const category = extractCategory(lower, type.value);

  const consumed = [...type.consumed, ...amount.consumed, ...date.consumed];
  const description = extractDescription(original, consumed);

  // Confidence is a blunt but honest signal: it drives the hint shown under
  // the input, not any silent behaviour.
  let confidence = 0;
  if (amount.value !== null) confidence += 0.45;
  if (category.slug) confidence += 0.25;
  if (date.consumed.length > 0) confidence += 0.15;
  if (description.length > 2) confidence += 0.15;

  return {
    type: type.value,
    amount: amount.value,
    description: description || (category.slug ? category.slug : "Transaction"),
    date: format(date.value, "yyyy-MM-dd"),
    categorySlug: category.slug,
    categoryId: null,
    tags: extractTags(original),
    confidence: Math.min(1, Math.round(confidence * 100) / 100),
  };
}

/** Example prompts shown in the quick-add UI. */
export const NL_EXAMPLES = [
  "I spent $25 on pizza yesterday",
  "Paid 1200 rent on the 1st",
  "Received 4500 salary today",
  "Bought coffee for 6.40 #morning",
  "Uber 18.50 last friday",
  "Netflix subscription 15.99",
];
