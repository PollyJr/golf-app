import "server-only";

type Cell = string | number | boolean | null | undefined;

// Spreadsheets run formulas in cells that start with these characters.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A CSV download that opens correctly in Excel with Dutch regional settings:
 * semicolon separated, with a byte-order mark so accents survive.
 */
export function csvResponse(filename: string, header: string[], rows: Cell[][]): Response {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(";"));
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
