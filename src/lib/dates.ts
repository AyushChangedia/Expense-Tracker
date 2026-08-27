import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
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
 * Accepts "2026-03-04" (treated as a plain calendar day, never shifted) as
 * well as anything `Date` can parse.
 */
export function parseDateInput(value: string): Date {
  const isoDayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isoDayOnly) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = value.includes("T") ? parseISO(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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
 * Advances a recurrence by one cycle.
 *
 * `anchorDay` is the day-of-month the rule was created on, and month and year
 * steps re-anchor to it. Without it a sequence walked one step at a time
 * decays: `addMonths` clamps Jan 31 to Feb 28 correctly, but the next step
 * starts from the 28th, so a rule due on the 31st pays on the 28th for the
 * rest of its life. Clamping is only right when it applies to the original
 * day each time, not to whatever the last clamp produced.
 *
 * Callers stepping through a sequence must pass it. Omitting it keeps the old
 * single-step behaviour, which is correct for a one-off "what comes next".
 */
export function advanceRecurrence(
  date: Date,
  frequency: RecurrenceFrequency,
  interval = 1,
  anchorDay?: number,
): Date {
  const step = Math.max(1, interval);
  switch (frequency) {
    case "DAILY":
      return addDays(date, step);
    case "WEEKLY":
      return addWeeks(date, step);
    case "YEARLY":
      return applyAnchorDay(addYears(date, step), anchorDay);
    case "MONTHLY":
    default:
      return applyAnchorDay(addMonths(date, step), anchorDay);
  }
}

/** Re-seat a date on its anchor day, clamped to the length of its own month. */
function applyAnchorDay(date: Date, anchorDay?: number): Date {
  if (!anchorDay || anchorDay < 1) return date;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const target = Math.min(anchorDay, lastDay);
  if (date.getDate() === target) return date;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    target,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
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
