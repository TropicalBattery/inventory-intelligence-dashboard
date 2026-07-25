/**
 * Parse the human-maintained "Containers Expected" workbook.
 *
 * Final column mapping used (0-based indices, confirmed against the
 * described sheet layout — re-verify when a real latest.xlsx lands):
 *   A/0  supplier_invoice
 *   B/1  quote_ref
 *   C/2  container_count (numeric only; ignore text like "CNTR")
 *   D/3  unused / spacer
 *   E/4  container_size (e.g. 20FT, 40FT)
 *   F/5  eta_port (ISO date string or "TBA")
 *   G/6  eta_warehouse
 *   H/7  bl_number
 *   I/8  container_numbers
 */

export type ParsedInboundContainer = {
  supplier: string;
  supplierInvoice: string | null;
  quoteRef: string | null;
  containerCount: number | null;
  containerSize: string | null;
  etaPort: string | null;
  etaWarehouse: string | null;
  blNumber: string | null;
  containerNumbers: string | null;
  sourceMonth: string | null;
};

export type ParseInboundContainersResult = {
  rows: ParsedInboundContainer[];
  sourceMonth: string | null;
  skippedRows: number;
  sheetName: string;
};

const KNOWN_SUPPLIERS = [
  "Yigit Aku",
  "Freezetone Products",
  "Leoch Battery",
  "Clarios",
  "Atlas",
  "Ecuador",
  "American Battery",
] as const;

/** Known sheet suppliers — used by the in-app add form dropdown. */
export const KNOWN_INBOUND_SUPPLIERS: readonly string[] = KNOWN_SUPPLIERS;

const SKIP_PREFIXES = ["TOTAL", "EXPECTED", "SUPPLIER"];

const SOURCE_MONTH_RE =
  /(?:for|of)\s+([A-Za-z]+\s+\d{4})/i;

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function isBlank(value: unknown): boolean {
  return cellText(value) === "";
}

function formatDateOnly(value: Date): string | null {
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  // Use the calendar day as shown in the sheet (local components), not UTC,
  // so Excel/SheetJS midnight local dates do not shift backwards.
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function coerceEta(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return formatDateOnly(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // SheetJS may return Excel serial dates when cellDates is false.
    // Excel epoch: days since 1899-12-30.
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + value * 86400000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime()) && value > 20000 && value < 80000) {
      return d.toISOString().slice(0, 10);
    }
  }

  const text = cellText(value);
  if (!text) {
    return null;
  }

  if (/^tba$/i.test(text)) {
    return "TBA";
  }

  // Already ISO-like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateOnly(parsed);
  }

  return text;
}

function coerceContainerCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = cellText(value);
  if (!text || /[a-zA-Z]/.test(text)) {
    return null;
  }
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function matchesKnownSupplier(text: string): boolean {
  const lower = text.toLowerCase();
  return KNOWN_SUPPLIERS.some(
    (name) => lower === name.toLowerCase() || lower.includes(name.toLowerCase())
  );
}

function isAllCapsWords(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/**
 * A supplier header row: non-empty first cell, empty count + size cells,
 * and either a known supplier name or all-caps text-only first cell.
 */
export function isSupplierHeaderRow(row: unknown[]): boolean {
  const first = cellText(row[0]);
  if (!first) {
    return false;
  }

  const upper = first.toUpperCase();
  if (SKIP_PREFIXES.some((p) => upper.startsWith(p))) {
    return false;
  }

  const count = coerceContainerCount(row[2]);
  const size = cellText(row[4]);
  if (count !== null || size) {
    return false;
  }

  // Supplier headers typically have only the first cell filled.
  const filledBeyondFirst = row.slice(1).filter((c) => !isBlank(c)).length;
  if (filledBeyondFirst > 1) {
    return false;
  }

  if (matchesKnownSupplier(first)) {
    return true;
  }

  // All-caps text-only first cell (no digits) treated as header.
  if (
    !/\d/.test(first) &&
    isAllCapsWords(first) &&
    /^[A-Za-z\s.&'/()-]+$/.test(first)
  ) {
    return true;
  }

  // Mixed-case name with no digits and only first cell filled.
  if (
    !/\d/.test(first) &&
    filledBeyondFirst === 0 &&
    /[A-Za-z]{3,}/.test(first)
  ) {
    return true;
  }

  return false;
}

function shouldSkipByPrefix(invoice: string): boolean {
  const upper = invoice.toUpperCase();
  return SKIP_PREFIXES.some((p) => upper.startsWith(p));
}

function extractSourceMonth(rows: unknown[][]): string | null {
  for (const row of rows.slice(0, 8)) {
    for (const cell of row) {
      const text = cellText(cell);
      if (!text) continue;
      if (/expected\s+containers/i.test(text) || /containers\/pallets/i.test(text)) {
        const match = text.match(SOURCE_MONTH_RE);
        if (match?.[1]) {
          return match[1].trim().toUpperCase();
        }
        // Fallback: trailing MONTH YEAR
        const trailing = text.match(/([A-Z]{3,9}\s+\d{4})\s*$/i);
        if (trailing?.[1]) {
          return trailing[1].trim().toUpperCase();
        }
      }
    }
  }
  return null;
}

/**
 * Parse order (strict):
 *   1. supplier header  -> set currentSupplier, continue
 *   2. empty col A      -> skip (subtotals / blanks / grand totals)
 *   3. Total/Expected/SUPPLIER prefix -> skip
 *   4. otherwise        -> real container row (requires currentSupplier)
 *
 * Column map (0-based): A=0 invoice, B=1 quote, C=2 count,
 * D=3 unused, E=4 size, F=5 eta_port, G=6 eta_whse, H=7 BL, I=8 containers.
 */
export function parseInboundContainersSheet(
  sheetRows: unknown[][],
  sheetName: string
): ParseInboundContainersResult {
  const sourceMonth = extractSourceMonth(sheetRows);
  const rows: ParsedInboundContainer[] = [];
  let skippedRows = 0;
  let currentSupplier: string | null = null;

  for (const rawRow of sheetRows) {
    const row = Array.isArray(rawRow) ? rawRow : [];

    // 1. Supplier header — must run BEFORE the empty-col-A guard.
    if (isSupplierHeaderRow(row)) {
      currentSupplier = cellText(row[0]);
      skippedRows += 1;
      continue;
    }

    // 2. No col A = not a container (subtotals put the number in col E).
    const invoice = String(row[0] ?? "").trim();
    if (!invoice) {
      if (row.some((c) => !isBlank(c))) {
        skippedRows += 1;
      }
      continue;
    }

    // 3. Title / total / column-header prefix rows.
    if (shouldSkipByPrefix(invoice)) {
      skippedRows += 1;
      continue;
    }

    if (!currentSupplier) {
      skippedRows += 1;
      continue;
    }

    rows.push({
      supplier: currentSupplier,
      supplierInvoice: invoice,
      quoteRef: cellText(row[1]) || null,
      containerCount: coerceContainerCount(row[2]),
      containerSize: cellText(row[4]) || null,
      etaPort: coerceEta(row[5]),
      etaWarehouse: coerceEta(row[6]),
      blNumber: cellText(row[7]) || null,
      containerNumbers: cellText(row[8]) || null,
      sourceMonth,
    });
  }

  return { rows, sourceMonth, skippedRows, sheetName };
}

export function pickInboundWorksheet(
  workbook: { SheetNames: string[]; Sheets: Record<string, unknown> }
): { name: string; sheet: unknown } {
  const preferred = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() === "containers expected tbl"
  );
  const name = preferred ?? workbook.SheetNames[0];
  if (!name) {
    throw new Error("Workbook has no worksheets");
  }
  return { name, sheet: workbook.Sheets[name] };
}
