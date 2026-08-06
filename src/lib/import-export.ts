import Papa from "papaparse";

import { parseAmount } from "@/lib/currency";
import { parseDateInput } from "@/lib/dates";
import { slugify } from "@/lib/utils";

/**
 * Import / export plumbing shared by the API routes and the settings UI.
 *
 * The CSV column set is deliberately the same in both directions, so a file
 * exported from FluxFin re-imports without edits.
 */

export const EXPORT_COLUMNS = [
  "date",
  "type",
  "amount",
  "description",
  "category",
  "tags",
  "notes",
] as const;

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>;

export type ParsedImportRow = {
  rowNumber: number;
  date: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  category: string;
  tags: string[];
  notes: string;
};

export type ImportIssue = {
  rowNumber: number;
  message: string;
};

export type ImportParseResult = {
  rows: ParsedImportRow[];
  issues: ImportIssue[];
  /** Column names the file actually contained, for the mapping summary. */
  detectedColumns: string[];
};

/** Header aliases so exports from other tools import without renaming columns. */
const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  transactiondate: "date",
  posteddate: "date",
  when: "date",
  type: "type",
  transactiontype: "type",
  direction: "type",
  kind: "type",
  amount: "amount",
  value: "amount",
  total: "amount",
  sum: "amount",
  debit: "debit",
  credit: "credit",
  description: "description",
  memo: "description",
  details: "description",
  name: "description",
  title: "description",
  merchant: "description",
  payee: "description",
  category: "category",
  categoryname: "category",
  tags: "tags",
  labels: "tags",
  notes: "notes",
  note: "notes",
  comment: "notes",
};

function normaliseHeader(header: string): string {
  const key = header.toLowerCase().replace(/[^a-z]/g, "");
  return HEADER_ALIASES[key] ?? key;
}

function coerceType(
  value: string | undefined,
  amount: number,
  debit?: string,
  credit?: string,
): "INCOME" | "EXPENSE" {
  const raw = (value ?? "").trim().toLowerCase();

  if (["income", "credit", "in", "deposit", "earning", "+"].includes(raw)) return "INCOME";
  if (["expense", "debit", "out", "withdrawal", "spending", "-"].includes(raw)) {
    return "EXPENSE";
  }

  // Bank exports often use separate debit/credit columns instead of a type.
  if (credit && parseAmount(credit)) return "INCOME";
  if (debit && parseAmount(debit)) return "EXPENSE";

  // A negative amount is the near-universal convention for money leaving.
  return amount < 0 ? "EXPENSE" : amount > 0 && raw === "" ? "EXPENSE" : "EXPENSE";
}

/** Turns a loose record into a validated row, or explains why it cannot. */
export function normaliseRow(
  record: Record<string, unknown>,
  rowNumber: number,
): { row?: ParsedImportRow; issue?: ImportIssue } {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    const header = normaliseHeader(key);
    // Keep the first non-empty value when two columns map to the same field.
    if (!mapped[header]) mapped[header] = String(value).trim();
  }

  const rawDescription = mapped.description ?? "";
  const rawAmount = mapped.amount ?? mapped.debit ?? mapped.credit ?? "";
  const rawDate = mapped.date ?? "";

  if (!rawDescription && !rawAmount && !rawDate) {
    return { issue: { rowNumber, message: "Row is empty" } };
  }

  if (!rawDate) {
    return { issue: { rowNumber, message: "Missing a date" } };
  }

  const date = parseDateInput(rawDate);
  if (Number.isNaN(date.getTime())) {
    return { issue: { rowNumber, message: `Could not read the date "${rawDate}"` } };
  }

  const parsedAmount = parseAmount(rawAmount);
  if (parsedAmount === null || parsedAmount === 0) {
    return { issue: { rowNumber, message: `Could not read the amount "${rawAmount}"` } };
  }

  const type = coerceType(mapped.type, parsedAmount, mapped.debit, mapped.credit);
  const amount = Math.round(Math.abs(parsedAmount) * 100) / 100;

  if (amount > 999_999_999.99) {
    return { issue: { rowNumber, message: "Amount is out of range" } };
  }

  const description = (rawDescription || "Imported transaction").slice(0, 140);

  const tags = (mapped.tags ?? "")
    .split(/[;,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    row: {
      rowNumber,
      date: date.toISOString().slice(0, 10),
      type,
      amount,
      description,
      category: (mapped.category ?? "").trim(),
      tags,
      notes: (mapped.notes ?? "").slice(0, 500),
    },
  };
}

export function parseCsv(content: string): ImportParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const rows: ParsedImportRow[] = [];
  const issues: ImportIssue[] = [];

  parsed.data.forEach((record, index) => {
    // +2 accounts for the header row and 1-based numbering, so the number
    // matches what the user sees in a spreadsheet.
    const { row, issue } = normaliseRow(record, index + 2);
    if (row) rows.push(row);
    if (issue) issues.push(issue);
  });

  for (const error of parsed.errors.slice(0, 10)) {
    issues.push({
      rowNumber: (error.row ?? 0) + 2,
      message: error.message,
    });
  }

  return {
    rows,
    issues,
    detectedColumns: parsed.meta.fields ?? [],
  };
}

export function parseJson(content: string): ImportParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    return {
      rows: [],
      issues: [{ rowNumber: 0, message: "That file is not valid JSON." }],
      detectedColumns: [],
    };
  }

  // Accept both a bare array and a FluxFin export envelope.
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { transactions?: unknown }).transactions)
      ? (payload as { transactions: unknown[] }).transactions
      : null;

  if (!records) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 0,
          message: 'Expected an array of transactions, or an object with a "transactions" array.',
        },
      ],
      detectedColumns: [],
    };
  }

  const rows: ParsedImportRow[] = [];
  const issues: ImportIssue[] = [];
  const columns = new Set<string>();

  records.forEach((record, index) => {
    if (typeof record !== "object" || record === null) {
      issues.push({ rowNumber: index + 1, message: "Entry is not an object" });
      return;
    }
    for (const key of Object.keys(record)) columns.add(key);

    const { row, issue } = normaliseRow(record as Record<string, unknown>, index + 1);
    if (row) rows.push(row);
    if (issue) issues.push(issue);
  });

  return { rows, issues, detectedColumns: Array.from(columns) };
}

export function toCsv(rows: ExportRow[]): string {
  return Papa.unparse(rows, { columns: [...EXPORT_COLUMNS] });
}

/** Matches an imported category name to an existing one, or falls back. */
export function matchCategorySlug(
  name: string,
  available: { slug: string; name: string }[],
): string | null {
  if (!name) return null;
  const slug = slugify(name);

  const bySlug = available.find((category) => category.slug === slug);
  if (bySlug) return bySlug.slug;

  const byName = available.find(
    (category) => category.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (byName) return byName.slug;

  return null;
}

export function exportFilename(extension: string, prefix = "fluxfin-transactions") {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
