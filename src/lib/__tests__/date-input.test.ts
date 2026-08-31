import { test } from "node:test";
import assert from "node:assert/strict";

import { parseDateInput, tryParseDateInput } from "@/lib/dates";
import { normaliseRow, parseCsv } from "@/lib/import-export";

const day = (d: Date | null) =>
  d === null ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ----------------------------------------------------------- the parser -- */

test("real dates parse, in every shape the app accepts", () => {
  assert.equal(day(tryParseDateInput("2026-03-04")), "2026-03-04");
  assert.equal(day(tryParseDateInput("2026-03-04T15:30:00.000Z")), day(new Date("2026-03-04T15:30:00.000Z")));
  assert.equal(day(tryParseDateInput("March 4, 2026")), "2026-03-04");
  assert.equal(day(tryParseDateInput("  2026-03-04  ")), "2026-03-04");
});

test("a leap day parses in a leap year and is refused in a common one", () => {
  assert.equal(day(tryParseDateInput("2024-02-29")), "2024-02-29");
  assert.equal(tryParseDateInput("2026-02-29"), null);
});

test("an out-of-range month or day is refused, not rolled forward", () => {
  // `new Date("2026-13-45")` is 14 February 2027 — a date nobody typed, and
  // the one the importer used to store.
  assert.equal(tryParseDateInput("2026-13-45"), null);
  assert.equal(tryParseDateInput("2026-00-10"), null);
  assert.equal(tryParseDateInput("2026-03-00"), null);
  assert.equal(tryParseDateInput("2026-04-31"), null, "April has 30 days");
});

test("unreadable text returns null rather than today", () => {
  for (const junk of ["", "   ", "not a date", "hello", "n/a", "-"]) {
    assert.equal(tryParseDateInput(junk), null, JSON.stringify(junk));
  }
});

test("parseDateInput keeps its lenient contract for form fields", () => {
  // The UI wants a usable default; only the strict variant reports failure.
  assert.equal(day(parseDateInput("2026-03-04")), "2026-03-04");
  assert.equal(day(parseDateInput("nonsense")), day(new Date()));
});

/* --------------------------------------------------------- the importer -- */

test("a row with an unreadable date is rejected instead of dated today", () => {
  // The regression: parseDateInput never returns an invalid Date, so the
  // importer's `Number.isNaN(date.getTime())` branch could not fire and the
  // "Could not read the date" message was unreachable. Every bad row imported
  // silently, stamped with the moment of the import.
  for (const bad of ["not a date", "hello", "2026-13-45", "2026-02-30"]) {
    const { row, issue } = normaliseRow({ date: bad, description: "Coffee", amount: "240" }, 2);
    assert.equal(row, undefined, `${bad} was imported as ${row?.date}`);
    assert.match(issue!.message, /could not read the date/i);
    assert.ok(issue!.message.includes(bad), "the message should quote the value back");
  }
});

test("the rejected row is reported without stopping the good ones", () => {
  const result = parseCsv(
    [
      "date,description,amount",
      "2026-03-01,First,100",
      "wobble,Broken,200",
      "2026-03-03,Third,300",
    ].join("\n"),
  );
  assert.deepEqual(result.rows.map((r) => r.description), ["First", "Third"]);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].rowNumber, 3);
});

test("a whole file of unreadable dates imports nothing at all", () => {
  // Previously this imported every row, all dated today — a silent, complete
  // corruption of the file's meaning.
  const result = parseCsv(
    ["date,description,amount", "junk,A,100", "junk,B,200"].join("\n"),
  );
  assert.equal(result.rows.length, 0);
  assert.equal(result.issues.length, 2);
});

test("good dates still import untouched", () => {
  const result = parseCsv(
    ["date,description,amount", "2026-03-04,Coffee,240", "March 4 2026,Tea,120"].join("\n"),
  );
  assert.equal(result.issues.length, 0, JSON.stringify(result.issues));
  assert.deepEqual(result.rows.map((r) => r.date), ["2026-03-04", "2026-03-04"]);
});
