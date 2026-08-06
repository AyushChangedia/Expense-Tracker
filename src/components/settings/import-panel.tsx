"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/page-header";
import { usePreferences } from "@/components/providers/preferences-provider";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { commitImport } from "@/server/actions/import-export";
import type { ParsedImportRow } from "@/lib/import-export";

type Preview = {
  fileName: string;
  rows: ParsedImportRow[];
  issues: { rowNumber: number; message: string }[];
  issueCount: number;
  detectedColumns: string[];
  summary: {
    count: number;
    income: number;
    expenses: number;
    from: string | null;
    to: string | null;
    categories: string[];
  };
};

/**
 * Two-step import: upload for a server-side preview, then confirm.
 *
 * The preview is only a convenience — `commitImport` re-validates every row,
 * so nothing here is a trust boundary.
 */
export function ImportPanel() {
  const router = useRouter();
  const { formatMoney, dateFormat } = usePreferences();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setPreview(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/import/preview", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "We could not read that file.");
        return;
      }

      if (!data.rows || data.rows.length === 0) {
        toast.error(
          data.issueCount > 0
            ? `No usable rows found — ${data.issues[0]?.message ?? "check the format"}.`
            : "That file has no rows we could read.",
        );
        return;
      }

      setPreview(data as Preview);
    } catch {
      toast.error("The upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;

    setImporting(true);
    const result = await commitImport(preview.rows, { createMissingCategories: true });
    setImporting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const { imported, skipped, categoriesCreated } = result.data;
    toast.success(
      `Imported ${imported} ${imported === 1 ? "transaction" : "transactions"}` +
        (skipped > 0 ? `, ${skipped} skipped` : "") +
        (categoriesCreated.length > 0
          ? ` · created ${categoriesCreated.length} new ${
              categoriesCreated.length === 1 ? "category" : "categories"
            }`
          : ""),
    );

    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="glass glow-border p-5 sm:p-6"
    >
      <SectionHeading
        title="Import transactions"
        description="CSV, Excel, or JSON. Column names are matched loosely, so most bank exports work as-is."
        className="mb-5"
      />

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300",
                dragging
                  ? "border-primary/60 bg-primary/[0.06]"
                  : "border-white/[0.10] hover:border-white/[0.18]",
              )}
            >
              <div className="relative mb-4">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/25 blur-2xl"
                />
                <div className="relative grid size-14 place-items-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-primary/20 to-cyan/10">
                  {uploading ? (
                    <Loader2 className="size-6 animate-spin text-primary-200" />
                  ) : (
                    <FileUp className="size-6 text-primary-200" strokeWidth={1.6} />
                  )}
                </div>
              </div>

              <p className="text-sm font-medium text-white">
                {uploading ? "Reading your file…" : "Drop a file here"}
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                CSV, XLSX, or JSON up to 8 MB. You will see a preview before
                anything is saved.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,.json,.xlsx,.xls"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />

              <Button
                type="button"
                variant="secondary"
                className="mt-5"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="size-4" />
                Choose a file
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs font-medium text-white">Expected columns</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                <code className="font-mono text-[11px] text-primary-200">
                  date, description, amount, type, category, tags, notes
                </code>
                . Only <code className="font-mono text-[11px]">date</code>,{" "}
                <code className="font-mono text-[11px]">description</code>, and{" "}
                <code className="font-mono text-[11px]">amount</code> are required —
                common aliases like <em>memo</em>, <em>payee</em>, and separate
                debit/credit columns are recognised too.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-white">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  {preview.fileName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {preview.summary.count} rows ready
                  {preview.summary.from && preview.summary.to
                    ? ` · ${formatDate(preview.summary.from, dateFormat)} → ${formatDate(
                        preview.summary.to,
                        dateFormat,
                      )}`
                    : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="shrink-0 rounded-lg p-1.5 text-subtle transition-colors hover:bg-white/[0.08] hover:text-white"
                aria-label="Discard this import"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Rows", value: String(preview.summary.count) },
                { label: "Income", value: formatMoney(preview.summary.income) },
                { label: "Expenses", value: formatMoney(preview.summary.expenses) },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-subtle">
                    {stat.label}
                  </p>
                  <p className="tabular mt-0.5 text-sm font-semibold text-white">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {preview.issueCount > 0 ? (
              <div className="rounded-xl border border-warning/25 bg-warning/[0.06] p-3.5">
                <p className="flex items-center gap-2 text-xs font-medium text-warning">
                  <AlertTriangle className="size-3.5" />
                  {preview.issueCount} {preview.issueCount === 1 ? "row" : "rows"} will
                  be skipped
                </p>
                <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto">
                  {preview.issues.slice(0, 6).map((issue, index) => (
                    <li key={index} className="text-[11px] text-muted-foreground">
                      Row {issue.rowNumber}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* First few rows, so the mapping can be eyeballed. */}
            <div className="overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="max-h-64 overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-white/[0.06]">
                      {["Date", "Description", "Category", "Amount"].map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className={cn(
                            "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle",
                            header === "Amount" && "text-right",
                          )}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 25).map((row, index) => (
                      <tr key={index} className="border-b border-white/[0.04] last:border-0">
                        <td className="tabular px-3 py-2 text-muted-foreground">
                          {row.date}
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-white">
                          {row.description}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.category || (
                            <span className="text-subtle">uncategorised</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "tabular px-3 py-2 text-right font-medium",
                            row.type === "INCOME" ? "text-success" : "text-danger",
                          )}
                        >
                          {row.type === "INCOME" ? "+" : "−"}
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.rows.length > 25 ? (
                <p className="border-t border-white/[0.06] px-3 py-2 text-[11px] text-subtle">
                  Showing the first 25 of {preview.rows.length} rows
                </p>
              ) : null}
            </div>

            {preview.summary.categories.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-subtle">Categories found:</span>
                {preview.summary.categories.slice(0, 10).map((category) => (
                  <Badge key={category} variant="secondary" className="text-[10px]">
                    {category}
                  </Badge>
                ))}
                <span className="text-[11px] text-subtle">
                  — any that do not exist yet will be created.
                </span>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setPreview(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleConfirm()} loading={importing}>
                Import {preview.summary.count}{" "}
                {preview.summary.count === 1 ? "row" : "rows"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
