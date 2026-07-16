import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatNumber } from "@/lib/format";
import {
  downloadBytesFile,
  downloadTextFile,
} from "@/lib/listing/download-client";

export type ExportColumnDef<Row> = {
  key: string;
  header: string;
  align?: "left" | "right";
  /** Format a cell; return value is sanitized (null/NaN → "-"). */
  format?: (value: unknown, row: Row) => string | number | null | undefined;
  /** Optional PDF column width in points. */
  width?: number;
};

export type ExportCsvMeta = {
  preamble?: string[];
};

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Never emit NaN or raw null/undefined — use "-". */
export function formatExportValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return String(value);
  }
  const text = String(value);
  if (text.trim().length === 0 || text === "NaN" || text === "null") {
    return "-";
  }
  return text;
}

function cellText<Row>(column: ExportColumnDef<Row>, row: Row): string {
  const record = row as Record<string, unknown>;
  const raw = record[column.key];
  if (column.format) {
    return formatExportValue(column.format(raw, row));
  }
  return formatExportValue(raw);
}

export function buildExportCsv<Row>(
  columns: ReadonlyArray<ExportColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
  meta?: ExportCsvMeta
): string {
  const lines: string[] = [];

  if (meta?.preamble) {
    for (const line of meta.preamble) {
      lines.push(escapeCsvCell(line));
    }
    if (meta.preamble.length > 0) {
      lines.push("");
    }
  }

  lines.push(columns.map((column) => escapeCsvCell(column.header)).join(","));

  for (const row of rows) {
    lines.push(
      columns.map((column) => escapeCsvCell(cellText(column, row))).join(",")
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

/**
 * Build a CSV and trigger a browser download.
 * Operates on the rows you pass (caller supplies the filtered set).
 */
export function exportRowsToCsv<Row>(
  columns: ReadonlyArray<ExportColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
  filename: string,
  meta?: ExportCsvMeta
): void {
  const csv = buildExportCsv(columns, rows, meta);
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 36;

export async function buildExportPdf<Row>(
  title: string,
  columns: ReadonlyArray<ExportColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
  options?: {
    subtitle?: string;
    generatedAt?: Date;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const colorText = rgb(0.12, 0.14, 0.18);
  const colorMuted = rgb(0.4, 0.44, 0.5);
  const colorHeader = rgb(0.94, 0.95, 0.97);
  const colorBorder = rgb(0.78, 0.8, 0.84);

  const availableWidth = PAGE_WIDTH - MARGIN * 2;
  const explicitWidths = columns.map((column) => column.width ?? 0);
  const explicitTotal = explicitWidths.reduce((sum, width) => sum + width, 0);
  const unsetCount = explicitWidths.filter((width) => width <= 0).length;
  const remaining = Math.max(0, availableWidth - explicitTotal);
  const fallbackWidth =
    unsetCount > 0 ? Math.max(40, remaining / unsetCount) : 0;

  const layout = columns.map((column) => ({
    ...column,
    width: column.width && column.width > 0 ? column.width : fallbackWidth,
    align: column.align ?? "left",
  }));

  const contentWidth = layout.reduce((sum, column) => sum + column.width, 0);
  const tableX = MARGIN;
  const rowHeight = 16;
  const headerHeight = 18;
  const minY = MARGIN + 28;
  const generatedAt = options?.generatedAt ?? new Date();
  const generatedLabel = `Generated ${generatedAt.toLocaleString("en-JM")}`;
  const subtitle = options?.subtitle
    ? truncate(options.subtitle, 140)
    : undefined;
  const countLabel = `${formatNumber(rows.length)} item(s)`;

  function addPage() {
    return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  function drawHeaderBlock(
    page: ReturnType<typeof pdfDoc.addPage>,
    startY: number
  ): number {
    page.drawText(title, {
      x: MARGIN,
      y: startY,
      size: 14,
      font: fontBold,
      color: colorText,
    });
    page.drawText(countLabel, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(countLabel, 10),
      y: startY,
      size: 10,
      font,
      color: colorMuted,
    });

    let y = startY - 16;
    page.drawText(generatedLabel, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: colorMuted,
    });
    if (subtitle) {
      y -= 12;
      page.drawText(subtitle, {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: colorMuted,
      });
    }
    return y - 14;
  }

  function drawTableHeader(
    page: ReturnType<typeof pdfDoc.addPage>,
    y: number
  ): number {
    page.drawRectangle({
      x: tableX,
      y: y - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: colorHeader,
      borderColor: colorBorder,
      borderWidth: 0.5,
    });

    let x = tableX;
    for (const column of layout) {
      const labelWidth = fontBold.widthOfTextAtSize(column.header, 8);
      const textX =
        column.align === "right"
          ? x + column.width - labelWidth - 4
          : x + 4;
      page.drawText(column.header, {
        x: textX,
        y: y - 12,
        size: 8,
        font: fontBold,
        color: colorMuted,
      });
      x += column.width;
    }
    return y - headerHeight;
  }

  function drawRow(
    page: ReturnType<typeof pdfDoc.addPage>,
    row: Row,
    y: number
  ): number {
    let x = tableX;
    for (const column of layout) {
      const maxChars = Math.max(6, Math.floor(column.width / 4.2));
      const text = truncate(cellText(column, row), maxChars);
      const size = 8;
      const textWidth = font.widthOfTextAtSize(text, size);
      const textX =
        column.align === "right"
          ? x + column.width - textWidth - 4
          : x + 4;
      page.drawText(text, {
        x: textX,
        y: y - 12,
        size,
        font,
        color: colorText,
      });
      x += column.width;
    }
    page.drawLine({
      start: { x: tableX, y: y - rowHeight },
      end: { x: tableX + contentWidth, y: y - rowHeight },
      thickness: 0.4,
      color: colorBorder,
    });
    return y - rowHeight;
  }

  let page = addPage();
  let y = drawHeaderBlock(page, PAGE_HEIGHT - MARGIN);
  y = drawTableHeader(page, y);

  if (rows.length === 0) {
    page.drawText("No rows match the current filters.", {
      x: MARGIN,
      y: y - 24,
      size: 10,
      font,
      color: colorMuted,
    });
  } else {
    for (const row of rows) {
      if (y - rowHeight < minY) {
        page = addPage();
        y = PAGE_HEIGHT - MARGIN;
        y = drawTableHeader(page, y);
      }
      y = drawRow(page, row, y);
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((p, index) => {
    const label = `Page ${index + 1} of ${pages.length}  ·  Tropical Battery`;
    p.drawText(label, {
      x: MARGIN,
      y: 18,
      size: 8,
      font,
      color: colorMuted,
    });
  });

  return pdfDoc.save();
}

/**
 * Build a PDF and trigger a browser download.
 */
export async function exportRowsToPdf<Row>(
  title: string,
  columns: ReadonlyArray<ExportColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
  filename: string,
  options?: {
    subtitle?: string;
    generatedAt?: Date;
  }
): Promise<void> {
  const bytes = await buildExportPdf(title, columns, rows, options);
  downloadBytesFile(filename, bytes, "application/pdf");
}

export function buildDatedExportFilename(
  prefix: string,
  format: "csv" | "pdf",
  generatedAt: Date = new Date()
): string {
  const stamp = generatedAt.toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${format}`;
}
