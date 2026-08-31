import Papa from "papaparse";

import { parseAmount } from "@/lib/currency";
import { parseDateInput, toUtcDay } from "@/lib/dates";
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

const INCOME_WORDS = [
  "income", "credit", "cr", "in", "deposit", "earning", "earnings",
  "received", "inflow", "+",
];

const EXPENSE_WORDS = [
  "expense", "debit", "dr", "out", "withdrawal", "spending", "spend",
  "payment", "outflow", "-",
];

/**
 * Decide whether an imported row is money in or money out.
 *
 * The order is deliberate, strongest signal first:
 *
 *   1. an explicit type word, if we recognise it
 *   2. separate debit / credit columns, which bank exports use instead
 *   3. the sign of the amount
 *
 * Step 3 needs `signedFile`, because direction-by-sign is a property of the
 * file rather than of the row. A positive 900 is income in a statement that
 * writes -45.20 for a card payment, and an expense in a plain list of what
 * somebody spent, where nothing is ever negative. One row cannot tell those
 * apart, so the callers below look at every amount before mapping any of
 * them, and an unsigned file still defaults to an expense.
 */
function coerceType(
  value: string | undefined,
  amount: number,
  debit?: string,
  credit?: string,
  signedFile = false,
): "INCOME" | "EXPENSE" {
  const raw = (value ?? "").trim().toLowerCase();

  if (INCOME_WORDS.includes(raw)) return "INCOME";
  if (EXPENSE_WORDS.includes(raw)) return "EXPENSE";

  // Bank exports often use separate debit/credit columns instead of a type.
  if (credit && parseAmount(credit) !== null) return "INCOME";
  if (debit && parseAmount(debit) !== null) return "EXPENSE";

  if (amount < 0) return "EXPENSE";
  return signedFile ? "INCOME" : "EXPENSE";
}

/**
 * Does this file use signs to mean direction?
 *
 * One negative amount anywhere is enough: a file that writes -45.20 for a card
 * payment is using the convention, so its positive rows are money arriving.
 */
function usesSignedAmounts(records: Record<string, unknown>[]): boolean {
  return records.some((record) => {
    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined) continue;
      if (normaliseHeader(key) !== "amount") continue;
      const parsed = parseAmount(String(value).trim());
      if (parsed !== null && parsed < 0) return true;
    }
    return false;
  });
}

/** Turns a loose record into a validated row, or explains why it cannot. */
export function normaliseRow(
  record: Record<string, unknown>,
  rowNumber: number,
  signedFile = false,
): { row?: ParsedImportRow; issue?: ImportIssue } {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    const header = normaliseHeader(key);
    // Keep the first non-empty value when two columns map to the same field.
    if (!mapped[header]) mapped[header] = unmaskCsvCell(String(value).trim());
  }

  const rawDescription = mapped.description ?? "";
  // First *non-empty* of the three, not first defined: a bank export has both
  // a debit and a credit column on every row with one of them blank, and `??`
  // stops at the empty string, so every credit row was read as having no
  // amount at all and dropped with "Could not read the amount".
  const rawAmount = [mapped.amount, mapped.debit, mapped.credit].find(
    (value) => value !== undefined && value !== "",
  ) ?? "";
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

  const type = coerceType(
    mapped.type,
    parsedAmount,
    mapped.debit,
    mapped.credit,
    signedFile,
  );
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
      // toUtcDay first: parseDateInput returns local midnight, and calling
      // toISOString on that shifts the day backwards anywhere *ahead* of UTC.
      // A row dated 2026-03-04 imported in Kolkata became 2026-03-03.
      date: toUtcDay(date).toISOString().slice(0, 10),
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
  const signedFile = usesSignedAmounts(parsed.data);

  parsed.data.forEach((record, index) => {
    // +2 accounts for the header row and 1-based numbering, so the number
    // matches what the user sees in a spreadsheet.
    const { row, issue } = normaliseRow(record, index + 2, signedFile);
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
  const signedFile = usesSignedAmounts(
    records.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null),
  );

  records.forEach((record, index) => {
    if (typeof record !== "object" || record === null) {
      issues.push({ rowNumber: index + 1, message: "Entry is not an object" });
      return;
    }
    for (const key of Object.keys(record)) columns.add(key);

    const { row, issue } = normaliseRow(
      record as Record<string, unknown>,
      index + 1,
      signedFile,
    );
    if (row) rows.push(row);
    if (issue) issues.push(issue);
  });

  return { rows, issues, detectedColumns: Array.from(columns) };
}

/**
 * Characters that make a spreadsheet treat a cell as a formula.
 *
 * Excel, LibreOffice and Google Sheets all evaluate a cell beginning with one
 * of these on open. A tab or carriage return counts because they are stripped
 * before the leading character is examined.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutralise CSV formula injection (CWE-1236) in one exported cell.
 *
 * Descriptions and notes are free text, and in a finance app a good deal of it
 * arrives from outside: an imported bank statement carries whatever the payer
 * typed in the reference field. A description of
 * `=HYPERLINK("http://evil","Click")` is inert in the app and a live link the
 * moment the export is opened in a spreadsheet, which is the one thing an
 * export is for.
 *
 * The guard is a leading apostrophe, which spreadsheets read as "treat the
 * rest as text" and do not display. `unmaskCsvCell` reverses it on import, so
 * the round trip this module promises still holds exactly.
 */
export function maskCsvCell(value: string): string {
  if (!value) return value;
  return FORMULA_TRIGGERS.includes(value[0]) ? `'${value}` : value;
}

/** Undo maskCsvCell, so an exported file re-imports to the same values. */
export function unmaskCsvCell(value: string): string {
  if (value.length < 2 || value[0] !== "'") return value;
  return FORMULA_TRIGGERS.includes(value[1]) ? value.slice(1) : value;
}

export function toCsv(rows: ExportRow[]): string {
  const masked = rows.map((row) => {
    const out = {} as ExportRow;
    for (const column of EXPORT_COLUMNS) out[column] = maskCsvCell(row[column] ?? "");
    return out;
  });
  return Papa.unparse(masked, { columns: [...EXPORT_COLUMNS] });
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
