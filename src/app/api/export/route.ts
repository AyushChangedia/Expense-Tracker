import { NextResponse } from "next/server";

import { formatDate } from "@/lib/dates";
import {
  EXPORT_COLUMNS,
  exportFilename,
  toCsv,
  type ExportRow,
} from "@/lib/import-export";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getAllTransactionsForExport } from "@/server/queries/transactions";

export const dynamic = "force-dynamic";

type Format = "csv" | "json" | "xlsx";

/**
 * Streams the signed-in user's data out as CSV, JSON, or a real .xlsx
 * workbook. Everything is scoped to the session user — there is no id
 * parameter to tamper with.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requested = (searchParams.get("format") ?? "csv").toLowerCase();
  const format: Format = ["csv", "json", "xlsx"].includes(requested)
    ? (requested as Format)
    : "csv";
  const scope = searchParams.get("scope") ?? "transactions";

  const transactions = await getAllTransactionsForExport(user.id);

  const rows: ExportRow[] = transactions.map((transaction) => ({
    date: transaction.date.toISOString().slice(0, 10),
    type: transaction.type,
    amount: Number(transaction.amount).toFixed(2),
    description: transaction.description,
    category: transaction.category.name,
    tags: transaction.tags.map((link) => link.tag.name).join(", "),
    notes: transaction.notes ?? "",
  }));

  if (format === "json") {
    // The "full" scope is the account backup: everything needed to rebuild.
    if (scope === "full") {
      const [categories, budgets, goals, recurring, tags] = await Promise.all([
        prisma.category.findMany({
          where: { userId: user.id },
          select: {
            name: true,
            slug: true,
            kind: true,
            icon: true,
            gradientFrom: true,
            gradientTo: true,
            isFavorite: true,
          },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.budget.findMany({
          where: { userId: user.id },
          select: { amount: true, month: true, year: true, category: { select: { name: true } } },
          orderBy: [{ year: "desc" }, { month: "desc" }],
        }),
        prisma.goal.findMany({
          where: { userId: user.id },
          select: {
            name: true,
            targetAmount: true,
            currentAmount: true,
            deadline: true,
            status: true,
            notes: true,
          },
        }),
        prisma.recurringTransaction.findMany({
          where: { userId: user.id },
          select: {
            description: true,
            type: true,
            amount: true,
            frequency: true,
            interval: true,
            startDate: true,
            endDate: true,
            isActive: true,
            category: { select: { name: true } },
          },
        }),
        prisma.tag.findMany({
          where: { userId: user.id },
          select: { name: true, color: true },
        }),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        profile: {
          name: user.name,
          email: user.email,
          currency: user.currency,
          dateFormat: user.dateFormat,
          locale: user.locale,
        },
        categories,
        tags,
        transactions: rows,
        budgets: budgets.map((budget) => ({
          category: budget.category?.name ?? null,
          amount: Number(budget.amount),
          month: budget.month,
          year: budget.year,
        })),
        goals: goals.map((goal) => ({
          ...goal,
          targetAmount: Number(goal.targetAmount),
          currentAmount: Number(goal.currentAmount),
          deadline: goal.deadline?.toISOString() ?? null,
        })),
        recurring: recurring.map((rule) => ({
          ...rule,
          amount: Number(rule.amount),
          category: rule.category.name,
          startDate: rule.startDate.toISOString(),
          endDate: rule.endDate?.toISOString() ?? null,
        })),
      };

      return jsonAttachment(payload, exportFilename("json", "fluxfin-backup"));
    }

    return jsonAttachment(
      { exportedAt: new Date().toISOString(), transactions: rows },
      exportFilename("json"),
    );
  }

  if (format === "xlsx") {
    // Imported lazily: ExcelJS is large and only this branch needs it.
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FluxFin";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Transactions", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Type", key: "type", width: 12 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "Description", key: "description", width: 38 },
      { header: "Category", key: "category", width: 18 },
      { header: "Tags", key: "tags", width: 22 },
      { header: "Notes", key: "notes", width: 40 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF7C3AED" },
    };
    sheet.getRow(1).alignment = { vertical: "middle" };
    sheet.getRow(1).height = 22;

    for (const transaction of transactions) {
      const row = sheet.addRow({
        date: transaction.date.toISOString().slice(0, 10),
        type: transaction.type === "INCOME" ? "Income" : "Expense",
        amount: Number(transaction.amount),
        description: transaction.description,
        category: transaction.category.name,
        tags: transaction.tags.map((link) => link.tag.name).join(", "),
        notes: transaction.notes ?? "",
      });

      row.getCell("amount").numFmt = '#,##0.00';
      row.getCell("type").font = {
        color: { argb: transaction.type === "INCOME" ? "FF16A34A" : "FFDC2626" },
        bold: true,
      };
    }

    // A summary sheet makes the workbook useful on its own.
    const summary = workbook.addWorksheet("Summary");
    const income = transactions
      .filter((item) => item.type === "INCOME")
      .reduce((acc, item) => acc + Number(item.amount), 0);
    const expenses = transactions
      .filter((item) => item.type === "EXPENSE")
      .reduce((acc, item) => acc + Number(item.amount), 0);

    summary.columns = [
      { header: "Metric", key: "metric", width: 26 },
      { header: "Value", key: "value", width: 18 },
    ];
    summary.getRow(1).font = { bold: true };
    summary.addRows([
      { metric: "Exported at", value: formatDate(new Date(), "MMM d, yyyy") },
      { metric: "Currency", value: user.currency },
      { metric: "Transactions", value: transactions.length },
      { metric: "Total income", value: Number(income.toFixed(2)) },
      { metric: "Total expenses", value: Number(expenses.toFixed(2)) },
      { metric: "Net balance", value: Number((income - expenses).toFixed(2)) },
    ]);
    summary.getColumn("value").numFmt = "#,##0.00";

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename("xlsx")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = toCsv(rows.length > 0 ? rows : []);
  const body = rows.length > 0 ? csv : EXPORT_COLUMNS.join(",");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("csv")}"`,
      "Cache-Control": "no-store",
    },
  });
}

function jsonAttachment(payload: unknown, filename: string) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
