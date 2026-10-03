import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { RecurrenceFrequency } from "@prisma/client";

/**
 * Transactions are calendar-day facts, not instants. Storing every date at
 * 00:00:00 UTC means a transaction dated "March 3" is March 3 for every
 * viewer, and month boundaries in SQL never straddle a timezone offset.
 */
export function toUtcDay(value: Date | string): Date {
  const date = typeof value === "string" ? parseDateInput(value) : value;
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
  );
}

/** Read a UTC-stored day back as a local-calendar Date for display. */
export function fromUtcDay(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0,
  );
}

/**
 * Parse a user-supplied date, or return null when it cannot be read.
 *
 * Use this anywhere the input might be wrong and the caller needs to say so —
 * an imported file, a URL parameter. `parseDateInput` is the lenient wrapper
 * for the UI, where falling back to today is the friendly answer.
 *
 * "2026-03-04" is treated as a plain calendar day and never shifted. Beyond
 * that, `new Date()` is used but its results are checked: it happily accepts
 * "2026-13-45" and rolls it forward to 14 February 2027, which is not a date
 * anybody typed, so day-only strings are range-checked against the month they
 * claim to be in.
 */
export function tryParseDateInput(value: string): Date | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  const isoDayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDayOnly) {
    const [, y, m, d] = isoDayOnly.map(Number);
    if (m < 1 || m > 12) return null;
    const lastDay = new Date(y, m, 0).getDate();
    if (d < 1 || d > lastDay) return null;
    return new Date(y, m - 1, d);
  }

  const parsed = trimmed.includes("T") ? parseISO(trimmed) : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Accepts "2026-03-04" (treated as a plain calendar day, never shifted) as
 * well as anything `Date` can parse, falling back to **today** when the value
 * cannot be read.
 *
 * That fallback is right for a form field and wrong for a file: use
 * `tryParseDateInput` wherever a bad value should be reported rather than
 * quietly turned into now.
 */
export function parseDateInput(value: string): Date {
  return tryParseDateInput(value) ?? new Date();
}

/** The `yyyy-MM-dd` key used by the calendar grid and chart buckets. */
export function dayKey(value: Date | string): string {
  return format(fromUtcDay(value), "yyyy-MM-dd");
}

export const DATE_FORMATS = [
  { value: "MMM d, yyyy", label: "Mar 4, 2026" },
  { value: "d MMM yyyy", label: "4 Mar 2026" },
  { value: "MM/dd/yyyy", label: "03/04/2026" },
  { value: "dd/MM/yyyy", label: "04/03/2026" },
  { value: "yyyy-MM-dd", label: "2026-03-04" },
];

export function formatDate(value: Date | string, pattern = "MMM d, yyyy"): string {
  try {
    return format(fromUtcDay(value), pattern);
  } catch {
    return format(fromUtcDay(value), "MMM d, yyyy");
  }
}

/** "Today", "Yesterday", "3 days ago", then an absolute date. */
export function relativeDay(value: Date | string, pattern = "MMM d, yyyy"): string {
  const date = fromUtcDay(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === -1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < -1 && diffDays > -7) return `In ${Math.abs(diffDays)} days`;
  return formatDate(value, pattern);
}

export function relativeTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Inclusive-start, exclusive-end UTC range covering a calendar month. */
export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function currentMonthKey(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function monthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const shifted = addMonths(new Date(year, month - 1, 1), delta);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}

/** The last `count` months ending with the current one, oldest first. */
export function lastNMonths(count: number, reference = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = subMonths(startOfMonth(reference), count - 1 - index);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: format(date, "MMM"),
      longLabel: format(date, "MMM yyyy"),
      start: new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)),
      end: new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 1)),
    };
  });
}

/**
 * The bucket a stored date belongs to: "2026-3".
 *
 * Read in UTC, because every month boundary in this file is built in UTC —
 * monthRange and lastNMonths both use Date.UTC. Reading the row locally instead
 * would put a transaction stored at midnight on the 1st into the previous
 * month's bucket for anyone west of Greenwich, and the totals would not add up
 * to the month range they were fetched with.
 *
 * Unpadded, to match the keys the bucket lists are built with.
 */
export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
}

/** The same key, from a year and a month already in hand. */
export function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function weekRange(reference = new Date(), weekStartsOn: 0 | 1 = 0) {
  const start = startOfWeek(reference, { weekStartsOn });
  const end = endOfWeek(reference, { weekStartsOn });
  return {
    start: toUtcDay(start),
    end: addDays(toUtcDay(end), 1),
    days: eachDayOfInterval({ start, end }),
  };
}

export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 0) {
  const first = new Date(year, month - 1, 1);
  const start = startOfWeek(startOfMonth(first), { weekStartsOn });
  const end = endOfWeek(endOfMonth(first), { weekStartsOn });
  return eachDayOfInterval({ start, end });
}

/**
 * Re-read a value that is already a stored UTC day as that same UTC day.
 *
 * `toUtcDay` converts a *local* calendar date to UTC midnight, so applying it
 * to a value that is already UTC midnight walks the day backwards anywhere
 * west of Greenwich: in New York, `new Date(Date.UTC(2026, 0, 15))` is 7pm on
 * the 14th locally, and `toUtcDay` faithfully returns the 14th. The two cases
 * are indistinguishable by type — both are a `Date` — so they need separate
 * functions, and a value coming out of the database needs this one.
 */
export function utcDayOf(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

/** Days in the month a UTC-midnight date falls in. */
function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Advances a recurrence by one cycle, in UTC.
 *
 * Recurrence cursors come from the database, where every date is a calendar
 * day stored at midnight UTC, so the arithmetic is done on UTC components.
 * date-fns `addMonths` and friends read *local* components, which is correct
 * for a date the user picked in a calendar widget and wrong for one that came
 * out of a column — and the difference only shows up in deployments west of
 * Greenwich, where it moves every recurring rule a day earlier per run.
 *
 * `anchorDay` is the day-of-month the rule was created on, and month and year
 * steps re-anchor to it. Without it a sequence walked one step at a time
 * decays: clamping Jan 31 to Feb 28 is right, but the next step then starts
 * from the 28th, so a rule due on the 31st pays on the 28th for the rest of
 * its life. Clamping is only right when it applies to the original day each
 * time, not to whatever the last clamp produced.
 *
 * Callers stepping through a sequence must pass it. Omitting it keeps the
 * plain single-step clamp, which is correct for a one-off "what comes next".
 */
export function advanceRecurrence(
  date: Date,
  frequency: RecurrenceFrequency,
  interval = 1,
  anchorDay?: number,
): Date {
  const step = Math.max(1, interval);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  switch (frequency) {
    case "DAILY":
      return new Date(Date.UTC(year, month, day + step));
    case "WEEKLY":
      return new Date(Date.UTC(year, month, day + step * 7));
    case "YEARLY":
      return utcMonthStep(year, month, day, step * 12, anchorDay);
    case "MONTHLY":
    default:
      return utcMonthStep(year, month, day, step, anchorDay);
  }
}

/**
 * Step whole months in UTC, landing on `anchorDay` (or the original day when
 * there is no anchor), clamped to the length of the month it lands in.
 */
function utcMonthStep(
  year: number,
  month: number,
  day: number,
  months: number,
  anchorDay?: number,
): Date {
  const targetMonth = month + months;
  // Normalise so a month index outside 0-11 rolls the year over before the
  // month length is measured.
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalisedMonth = ((targetMonth % 12) + 12) % 12;

  const wanted = anchorDay && anchorDay >= 1 ? anchorDay : day;
  const clamped = Math.min(wanted, daysInUtcMonth(targetYear, normalisedMonth));
  return new Date(Date.UTC(targetYear, normalisedMonth, clamped));
}

export function frequencyLabel(
  frequency: RecurrenceFrequency,
  interval = 1,
): string {
  if (interval <= 1) {
    return { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly" }[
      frequency
    ];
  }
  const unit = { DAILY: "days", WEEKLY: "weeks", MONTHLY: "months", YEARLY: "years" }[
    frequency
  ];
  return `Every ${interval} ${unit}`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayLabels(weekStartsOn: 0 | 1 = 0): string[] {
  return weekStartsOn === 1
    ? [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]]
    : WEEKDAY_LABELS;
}
