import { NextResponse } from "next/server";

import {
  normaliseRow,
  parseCsv,
  parseJson,
  type ImportIssue,
  type ImportParseResult,
  type ParsedImportRow,
} from "@/lib/import-export";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Parses an uploaded CSV / JSON / XLSX file and returns a preview.
 *
 * Nothing is written here — the client shows the preview, the user confirms,
 * and `commitImport` does the insert after re-validating every row.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a file to import." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a file to import." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Files up to 8 MB can be imported." },
      { status: 413 },
    );
  }

  const name = file.name.toLowerCase();
  let result: ImportParseResult;

  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      result = await parseWorkbook(file);
    } else if (name.endsWith(".json")) {
      result = parseJson(await file.text());
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      result = parseCsv(await file.text());
    } else {
      return NextResponse.json(
        { error: "Supported formats are CSV, JSON, and Excel (.xlsx)." },
        { status: 415 },
      );
    }
  } catch (error) {
    console.error("Import parse failed:", error);
    return NextResponse.json(
      { error: "We could not read that file. Check the format and try again." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    fileName: file.name,
    rows: result.rows,
    issues: result.issues.slice(0, 50),
    issueCount: result.issues.length,
    detectedColumns: result.detectedColumns,
    summary: summarise(result.rows),
  });
}

async function parseWorkbook(file: File): Promise<ImportParseResult> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      rows: [],
      issues: [{ rowNumber: 0, message: "That workbook has no sheets." }],
      detectedColumns: [],
    };
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: ParsedImportRow[] = [];
  const issues: ImportIssue[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;

      const value = cell.value;
      if (value instanceof Date) {
        record[header] = value.toISOString().slice(0, 10);
      } else if (value !== null && typeof value === "object" && "result" in value) {
        // Formula cell — take the computed result.
        record[header] = (value as { result?: unknown }).result ?? "";
      } else if (value !== null && typeof value === "object" && "text" in value) {
        record[header] = (value as { text?: unknown }).text ?? "";
      } else {
        record[header] = value ?? "";
      }
    });

    const { row: parsed, issue } = normaliseRow(record, rowNumber);
    if (parsed) rows.push(parsed);
    if (issue) issues.push(issue);
  });

  return {
    rows,
    issues,
    detectedColumns: headers.filter(Boolean),
  };
}

function summarise(rows: ParsedImportRow[]) {
  const income = rows
    .filter((row) => row.type === "INCOME")
    .reduce((acc, row) => acc + row.amount, 0);
  const expenses = rows
    .filter((row) => row.type === "EXPENSE")
    .reduce((acc, row) => acc + row.amount, 0);

  const dates = rows.map((row) => row.date).sort();

  return {
    count: rows.length,
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    categories: Array.from(
      new Set(rows.map((row) => row.category).filter(Boolean)),
    ).slice(0, 20),
  };
}
