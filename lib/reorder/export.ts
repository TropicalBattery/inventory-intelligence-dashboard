import { formatCurrencyJMD, formatNumber } from "@/lib/format";
import {
  buildDatedExportFilename,
  buildExportCsv,
  buildExportPdf,
  type ExportColumnDef,
} from "@/lib/listing/export";
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

const REORDER_EXPORT_COLUMNS: ExportColumnDef<ReorderExportRow>[] = [
  { key: "sku", header: "SKU", width: 70 },
  { key: "productName", header: "Product Name", width: 140 },
  { key: "status", header: "Status", width: 70 },
  { key: "abcClass", header: "ABC", width: 28 },
  {
    key: "qtyAvailable",
    header: "Qty Available",
    align: "right",
    width: 42,
    format: (value) =>
      typeof value === "number" ? formatNumber(value) : formatExportCell(value),
  },
  {
    key: "suggestedQty",
    header: "Suggested Qty",
    align: "right",
    width: 42,
    format: (value) =>
      typeof value === "number" ? formatNumber(value) : formatExportCell(value),
  },
  { key: "monthsOfCover", header: "Months of Cover", align: "right", width: 40 },
  { key: "supplierName", header: "Supplier", width: 110 },
  { key: "supplierCode", header: "Supplier Code", width: 60 },
  { key: "leadTimeDays", header: "Lead Time Days", align: "right", width: 34 },
  { key: "unitCostJmd", header: "Unit Cost (J$)", align: "right" },
  { key: "suggestedLineTotalJmd", header: "Suggested Line Total (J$)", align: "right" },
];

const PDF_COLUMNS: ExportColumnDef<ReorderExportRow>[] = [
  { key: "sku", header: "SKU", width: 70 },
  { key: "productName", header: "Product", width: 140 },
  { key: "status", header: "Status", width: 70 },
  { key: "abcClass", header: "ABC", width: 28 },
  {
    key: "qtyAvailable",
    header: "Avail",
    align: "right",
    width: 42,
    format: (value) =>
      typeof value === "number" ? formatNumber(value) : formatExportCell(value),
  },
  {
    key: "suggestedQty",
    header: "Sugg",
    align: "right",
    width: 42,
    format: (value) =>
      typeof value === "number" ? formatNumber(value) : formatExportCell(value),
  },
  { key: "monthsOfCover", header: "Cover", align: "right", width: 40 },
  { key: "supplierName", header: "Supplier", width: 110 },
  { key: "leadTimeDays", header: "LT d", align: "right", width: 34 },
];

function formatExportCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
}

export function buildReorderExportCsv(
  rows: ReadonlyArray<ReorderExportRow>,
  meta?: Pick<ReorderExportMeta, "filterDescription" | "generatedAt">
): string {
  return buildExportCsv(REORDER_EXPORT_COLUMNS, rows, {
    preamble: meta
      ? [
          `Reorder export — ${meta.generatedAt.toISOString().slice(0, 19)}Z`,
          meta.filterDescription,
        ]
      : undefined,
  });
}

export async function buildReorderExportPdf(
  rows: ReadonlyArray<ReorderExportRow>,
  meta: ReorderExportMeta
): Promise<Uint8Array> {
  return buildExportPdf(
    meta.title ?? "Reorder Action Report",
    PDF_COLUMNS,
    rows,
    {
      subtitle: meta.filterDescription,
      generatedAt: meta.generatedAt,
    }
  );
}

export function buildReorderExportFilename(
  format: "csv" | "pdf",
  generatedAt: Date = new Date()
): string {
  return buildDatedExportFilename("reorder-action", format, generatedAt);
}
