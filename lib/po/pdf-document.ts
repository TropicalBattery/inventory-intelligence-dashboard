import fs from "fs";
import path from "path";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { stripAiPreamble } from "@/lib/ai/strip-preamble";
import {
  getPoCompanyProfile,
  getPoPdfFooterLabel,
} from "@/lib/po/config";
import type { PurchaseOrderDocument } from "@/lib/types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const FOOTER_HEIGHT = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLOR_TEXT = rgb(0.12, 0.14, 0.18);
const COLOR_MUTED = rgb(0.4, 0.44, 0.5);
const COLOR_BORDER = rgb(0.78, 0.8, 0.84);
const COLOR_HEADER_FILL = rgb(0.94, 0.95, 0.97);
const COLOR_NOTES_FILL = rgb(0.97, 0.98, 0.99);

type TableColumn = {
  label: string;
  x: number;
  width: number;
  align: "left" | "right";
};

const TABLE_COLUMNS: TableColumn[] = [
  { label: "SKU", x: MARGIN + 6, width: 72, align: "left" },
  { label: "Vendor Item #", x: MARGIN + 82, width: 72, align: "left" },
  { label: "Description", x: MARGIN + 158, width: 170, align: "left" },
  { label: "Qty", x: MARGIN + 334, width: 36, align: "right" },
  { label: "Unit Cost", x: MARGIN + 376, width: 68, align: "right" },
  { label: "Line Total", x: MARGIN + 450, width: 68, align: "right" },
];

function formatCurrency(value: number): string {
  return `J$${value.toLocaleString("en-JM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCostValue(value: number | null): string {
  if (value === null) {
    return "Cost TBD";
  }

  return formatCurrency(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-JM", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en-JM", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = words[0] ?? "";

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  lines.push(current);
  return lines;
}

function drawTextAligned(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  font: PDFFont,
  align: "left" | "right",
  color: RGB = COLOR_TEXT
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  const drawX = align === "right" ? x + width - textWidth : x;

  page.drawText(text, {
    x: drawX,
    y,
    size,
    font,
    color,
  });
}

function drawHorizontalRule(page: PDFPage, y: number) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: COLOR_BORDER,
  });
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  pageNumber: number,
  pageCount: number,
  generatedAt: Date
) {
  const footerY = 28;
  const footerText = `${getPoPdfFooterLabel()} | Generated ${formatTimestamp(generatedAt)} | Page ${pageNumber} of ${pageCount}`;

  page.drawText(footerText, {
    x: MARGIN,
    y: footerY,
    size: 8,
    font,
    color: COLOR_MUTED,
  });
}

async function loadLogo(pdfDoc: PDFDocument) {
  const logoPath = path.join(process.cwd(), "public", "tbc-header-logo.png");

  if (!fs.existsSync(logoPath)) {
    return null;
  }

  const logoBytes = fs.readFileSync(logoPath);
  return pdfDoc.embedPng(logoBytes);
}

function drawDocumentHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  logo: Awaited<ReturnType<typeof loadLogo>>
) {
  const company = getPoCompanyProfile();
  let cursorY = PAGE_HEIGHT - MARGIN;

  if (logo) {
    const logoWidth = 110;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    page.drawImage(logo, {
      x: MARGIN,
      y: cursorY - logoHeight + 8,
      width: logoWidth,
      height: logoHeight,
    });
  }

  const companyLines = [
    company.name,
    company.addressLine1,
    company.addressLine2,
    company.phone,
  ];

  let companyY = PAGE_HEIGHT - MARGIN - 4;
  for (const line of companyLines) {
    const lineWidth = fonts.regular.widthOfTextAtSize(line, 10);
    page.drawText(line, {
      x: PAGE_WIDTH - MARGIN - lineWidth,
      y: companyY,
      size: 10,
      font: fonts.regular,
      color: COLOR_TEXT,
    });
    companyY -= 13;
  }

  cursorY = Math.min(cursorY - 72, companyY - 8);
  drawHorizontalRule(page, cursorY);
  return cursorY - 18;
}

function drawTitleAndInfoBox(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  po: PurchaseOrderDocument,
  startY: number
): number {
  page.drawText("PURCHASE ORDER", {
    x: MARGIN,
    y: startY,
    size: 20,
    font: fonts.bold,
    color: COLOR_TEXT,
  });

  const boxWidth = 190;
  const boxHeight = 58;
  const boxX = PAGE_WIDTH - MARGIN - boxWidth;
  const boxY = startY - 8;

  page.drawRectangle({
    x: boxX,
    y: boxY - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  const infoRows = [
    { label: "PO Number", value: po.poNumber },
    { label: "Date", value: formatDate(po.poDate) },
    { label: "Status", value: po.status },
  ];

  let infoY = boxY - 16;
  for (const row of infoRows) {
    page.drawText(row.label, {
      x: boxX + 10,
      y: infoY,
      size: 8,
      font: fonts.bold,
      color: COLOR_MUTED,
    });
    page.drawText(row.value, {
      x: boxX + 90,
      y: infoY,
      size: 10,
      font: fonts.regular,
      color: COLOR_TEXT,
    });
    infoY -= 16;
  }

  return startY - 78;
}

function drawSupplierSection(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  po: PurchaseOrderDocument,
  startY: number
): number {
  page.drawText("Supplier", {
    x: MARGIN,
    y: startY,
    size: 12,
    font: fonts.bold,
    color: COLOR_TEXT,
  });

  let cursorY = startY - 18;
  page.drawText(po.supplierName ?? po.supplierExternalId ?? "Supplier not specified", {
    x: MARGIN,
    y: cursorY,
    size: 11,
    font: fonts.regular,
    color: COLOR_TEXT,
  });
  cursorY -= 14;

  if (po.supplierEmail) {
    page.drawText(`Email: ${po.supplierEmail}`, {
      x: MARGIN,
      y: cursorY,
      size: 10,
      font: fonts.regular,
      color: COLOR_MUTED,
    });
    cursorY -= 13;
  }

  const addressText = po.supplierAddress?.trim() || "Address on file";
  for (const line of wrapText(addressText, fonts.regular, 10, CONTENT_WIDTH)) {
    page.drawText(line, {
      x: MARGIN,
      y: cursorY,
      size: 10,
      font: fonts.regular,
      color: COLOR_MUTED,
    });
    cursorY -= 12;
  }

  drawHorizontalRule(page, cursorY - 6);
  return cursorY - 20;
}

function drawTableHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  y: number
): number {
  const headerHeight = 22;

  page.drawRectangle({
    x: MARGIN,
    y: y - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: COLOR_HEADER_FILL,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  for (const column of TABLE_COLUMNS) {
    drawTextAligned(
      page,
      column.label,
      column.x,
      y - 15,
      column.width,
      9,
      fonts.bold,
      column.align,
      COLOR_TEXT
    );
  }

  return y - headerHeight;
}

function drawLineRow(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  line: PurchaseOrderDocument["lines"][number],
  topY: number
): number {
  const description = line.description ?? line.sku;
  const descriptionLines = wrapText(
    description,
    fonts.regular,
    9,
    TABLE_COLUMNS[2].width
  );
  const rowHeight = Math.max(18, descriptionLines.length * 11 + 6);

  page.drawRectangle({
    x: MARGIN,
    y: topY - rowHeight,
    width: CONTENT_WIDTH,
    height: rowHeight,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  const textY = topY - 13;
  page.drawText(line.sku.slice(0, 18), {
    x: TABLE_COLUMNS[0].x,
    y: textY,
    size: 9,
    font: fonts.regular,
    color: COLOR_TEXT,
  });
  page.drawText((line.vendorItemNumber ?? "-").slice(0, 16), {
    x: TABLE_COLUMNS[1].x,
    y: textY,
    size: 9,
    font: fonts.regular,
    color: COLOR_TEXT,
  });

  let descriptionY = textY;
  for (const descriptionLine of descriptionLines) {
    page.drawText(descriptionLine, {
      x: TABLE_COLUMNS[2].x,
      y: descriptionY,
      size: 9,
      font: fonts.regular,
      color: COLOR_TEXT,
    });
    descriptionY -= 11;
  }

  drawTextAligned(
    page,
    String(line.quantityOrdered),
    TABLE_COLUMNS[3].x,
    textY,
    TABLE_COLUMNS[3].width,
    9,
    fonts.regular,
    "right"
  );
  drawTextAligned(
    page,
    formatCostValue(line.unitCost),
    TABLE_COLUMNS[4].x,
    textY,
    TABLE_COLUMNS[4].width,
    9,
    fonts.regular,
    "right"
  );
  drawTextAligned(
    page,
    formatCostValue(line.lineTotal),
    TABLE_COLUMNS[5].x,
    textY,
    TABLE_COLUMNS[5].width,
    9,
    fonts.regular,
    "right"
  );

  return topY - rowHeight;
}

function drawTotalsSection(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  po: PurchaseOrderDocument,
  startY: number
): number {
  const boxWidth = 250;
  const boxHeight = 34;
  const boxX = PAGE_WIDTH - MARGIN - boxWidth;
  const boxY = startY - boxHeight;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  const totalLabel = po.hasUnknownLineCosts
    ? "Partial Total (some costs unavailable):"
    : "Grand Total:";
  const totalValue = formatCurrency(po.totalAmount ?? 0);

  page.drawText(totalLabel, {
    x: boxX + 10,
    y: boxY + 18,
    size: 10,
    font: fonts.bold,
    color: COLOR_TEXT,
  });

  const valueWidth = fonts.bold.widthOfTextAtSize(totalValue, 12);
  page.drawText(totalValue, {
    x: boxX + boxWidth - valueWidth - 10,
    y: boxY + 6,
    size: 12,
    font: fonts.bold,
    color: COLOR_TEXT,
  });

  return boxY - 24;
}

function drawNotesSection(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  memo: string,
  startY: number
): number {
  page.drawText("Notes", {
    x: MARGIN,
    y: startY,
    size: 12,
    font: fonts.bold,
    color: COLOR_TEXT,
  });

  const cleanedMemo = stripAiPreamble(memo);
  const memoLines = wrapText(cleanedMemo, fonts.regular, 10, CONTENT_WIDTH - 24);
  const boxHeight = Math.max(48, memoLines.length * 12 + 20);
  const boxY = startY - 16 - boxHeight;

  page.drawRectangle({
    x: MARGIN,
    y: boxY,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: COLOR_NOTES_FILL,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  let memoY = boxY + boxHeight - 16;
  for (const line of memoLines) {
    page.drawText(line, {
      x: MARGIN + 12,
      y: memoY,
      size: 10,
      font: fonts.regular,
      color: COLOR_TEXT,
    });
    memoY -= 12;
  }

  return boxY - 12;
}

export async function buildPurchaseOrderPdf(
  po: PurchaseOrderDocument
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: font, bold: fontBold };
  const logo = await loadLogo(pdfDoc);
  const generatedAt = new Date();

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);

  let y = drawDocumentHeader(page, fonts, logo);
  y = drawTitleAndInfoBox(page, fonts, po, y);
  y = drawSupplierSection(page, fonts, po, y);
  y = drawTableHeader(page, fonts, y);

  const minY = MARGIN + FOOTER_HEIGHT + 120;

  for (const line of po.lines) {
    const estimatedRowHeight = 24;
    if (y - estimatedRowHeight < minY) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(page);
      y = PAGE_HEIGHT - MARGIN;
      y = drawTableHeader(page, fonts, y);
    }

    y = drawLineRow(page, fonts, line, y);
  }

  if (y - 60 < minY) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  }

  y = drawTotalsSection(page, fonts, po, y);

  if (po.memo?.trim()) {
    if (y - 80 < minY) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(page);
      y = PAGE_HEIGHT - MARGIN;
    }

    y = drawNotesSection(page, fonts, po.memo, y);
  }

  const pageCount = pages.length;
  pages.forEach((currentPage, index) => {
    drawFooter(currentPage, font, index + 1, pageCount, generatedAt);
  });

  return pdfDoc.save();
}
