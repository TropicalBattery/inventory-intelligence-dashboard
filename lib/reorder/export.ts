import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrencyJMD, formatNumber } from "@/lib/format";
import { computeCurrentMonthsOfCover } from "@/lib/reorder/months-of-cover";
import { getStatusLabel } from "@/lib/reorder-status-ui";
import type { ReorderRecommendation } from "@/lib/types";

/** Keep export free of server-only supplier query imports (React cache / admin client). */
function resolveSupplierDisplayName(
  name: string | null | undefined,
  externalId: string | null | undefined
): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName;
  }
  const code = externalId?.trim();
  return code || "-";
}

export type ReorderExportRow = {
  sku: string;
  productName: string;
  status: string;
  abcClass: string;
  qtyAvailable: number;
  suggestedQty: number;
  monthsOfCover: string;
  supplierName: string;
  supplierCode: string;
  leadTimeDays: string;
  unitCostJmd: string;
  suggestedLineTotalJmd: string;
};

export type ReorderExportMeta = {
  filterDescription: string;
  generatedAt: Date;
  title?: string;
};

const PAGE_WIDTH = 792; // landscape letter
const PAGE_HEIGHT = 612;
const MARGIN = 36;

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildReorderExportRows(
  recommendations: ReadonlyArray<ReorderRecommendation>
): ReorderExportRow[] {
  return recommendations.map((rec) => {
    const months = computeCurrentMonthsOfCover(rec);
    const unitCost = rec.unitCost;
    const lineTotal =
      unitCost != null && Number.isFinite(unitCost) && rec.suggestedQtyRounded > 0
        ? unitCost * rec.suggestedQtyRounded
        : null;

    return {
      sku: rec.sku,
      productName: rec.name?.trim() || "-",
      status: getStatusLabel(rec.status),
      abcClass: rec.abcClass ?? "-",
      qtyAvailable: rec.quantityAvailable,
      suggestedQty: rec.suggestedQtyRounded,
      monthsOfCover:
        months === null || !Number.isFinite(months)
          ? "-"
          : months.toFixed(1),
      supplierName: resolveSupplierDisplayName(
        rec.supplierName,
        rec.supplierExternalId
      ),
      supplierCode: rec.supplierExternalId?.trim() || "-",
      leadTimeDays:
        rec.effectiveLeadTimeDays != null && rec.effectiveLeadTimeDays > 0
          ? String(Math.round(rec.effectiveLeadTimeDays))
          : rec.leadTimeDays != null && rec.leadTimeDays > 0
            ? String(Math.round(rec.leadTimeDays))
            : "-",
      unitCostJmd:
        unitCost != null && Number.isFinite(unitCost)
          ? formatCurrencyJMD(unitCost)
          : "-",
      suggestedLineTotalJmd:
        lineTotal != null ? formatCurrencyJMD(lineTotal) : "-",
    };
  });
}

const CSV_HEADERS = [
  "SKU",
  "Product Name",
  "Status",
  "ABC",
  "Qty Available",
  "Suggested Qty",
  "Months of Cover",
  "Supplier",
  "Supplier Code",
  "Lead Time Days",
  "Unit Cost (J$)",
  "Suggested Line Total (J$)",
] as const;

export function buildReorderExportCsv(
  rows: ReadonlyArray<ReorderExportRow>,
  meta?: Pick<ReorderExportMeta, "filterDescription" | "generatedAt">
): string {
  const lines: string[] = [];

  if (meta) {
    lines.push(
      escapeCsvCell(
        `Reorder export — ${meta.generatedAt.toISOString().slice(0, 19)}Z`
      )
    );
    lines.push(escapeCsvCell(meta.filterDescription));
    lines.push("");
  }

  lines.push(CSV_HEADERS.map(escapeCsvCell).join(","));

  for (const row of rows) {
    lines.push(
      [
        row.sku,
        row.productName,
        row.status,
        row.abcClass,
        row.qtyAvailable,
        row.suggestedQty,
        row.monthsOfCover,
        row.supplierName,
        row.supplierCode,
        row.leadTimeDays,
        row.unitCostJmd,
        row.suggestedLineTotalJmd,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  // UTF-8 BOM so Excel recognizes encoding
  return `\uFEFF${lines.join("\r\n")}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export async function buildReorderExportPdf(
  rows: ReadonlyArray<ReorderExportRow>,
  meta: ReorderExportMeta
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const colorText = rgb(0.12, 0.14, 0.18);
  const colorMuted = rgb(0.4, 0.44, 0.5);
  const colorHeader = rgb(0.94, 0.95, 0.97);
  const colorBorder = rgb(0.78, 0.8, 0.84);

  const columns: Array<{
    key: keyof ReorderExportRow;
    label: string;
    width: number;
    align: "left" | "right";
  }> = [
    { key: "sku", label: "SKU", width: 70, align: "left" },
    { key: "productName", label: "Product", width: 140, align: "left" },
    { key: "status", label: "Status", width: 70, align: "left" },
    { key: "abcClass", label: "ABC", width: 28, align: "left" },
    { key: "qtyAvailable", label: "Avail", width: 42, align: "right" },
    { key: "suggestedQty", label: "Sugg", width: 42, align: "right" },
    { key: "monthsOfCover", label: "Cover", width: 40, align: "right" },
    { key: "supplierName", label: "Supplier", width: 110, align: "left" },
    { key: "leadTimeDays", label: "LT d", width: 34, align: "right" },
  ];

  const contentWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const tableX = MARGIN;
  const rowHeight = 16;
  const headerHeight = 18;
  const minY = MARGIN + 28;

  const title = meta.title ?? "Reorder Action Report";
  const generatedLabel = `Generated ${meta.generatedAt.toLocaleString("en-JM")}`;
  const filterLabel = truncate(meta.filterDescription, 140);
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
    y -= 12;
    page.drawText(filterLabel, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: colorMuted,
    });
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
    for (const col of columns) {
      const labelWidth = fontBold.widthOfTextAtSize(col.label, 8);
      const textX =
        col.align === "right"
          ? x + col.width - labelWidth - 4
          : x + 4;
      page.drawText(col.label, {
        x: textX,
        y: y - 12,
        size: 8,
        font: fontBold,
        color: colorMuted,
      });
      x += col.width;
    }
    return y - headerHeight;
  }

  function drawRow(
    page: ReturnType<typeof pdfDoc.addPage>,
    row: ReorderExportRow,
    y: number
  ): number {
    let x = tableX;
    for (const col of columns) {
      const raw = row[col.key];
      const text = truncate(String(raw), col.key === "productName" ? 28 : 18);
      const size = 8;
      const textWidth = font.widthOfTextAtSize(text, size);
      const textX =
        col.align === "right" ? x + col.width - textWidth - 4 : x + 4;
      page.drawText(text, {
        x: textX,
        y: y - 12,
        size,
        font,
        color: colorText,
      });
      x += col.width;
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

export function buildReorderExportFilename(
  format: "csv" | "pdf",
  generatedAt: Date = new Date()
): string {
  const stamp = generatedAt.toISOString().slice(0, 10);
  return `reorder-action-${stamp}.${format}`;
}
