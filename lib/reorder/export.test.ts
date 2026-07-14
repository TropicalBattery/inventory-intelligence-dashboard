import { describe, expect, it } from "vitest";
import {
  buildReorderExportCsv,
  buildReorderExportFilename,
  buildReorderExportRows,
  type ReorderExportRow,
} from "@/lib/reorder/export";
import { resolveCoverBands } from "@/lib/reorder/cover-thresholds";
import type { ReorderRecommendation } from "@/lib/types";

function rec(
  overrides: Partial<ReorderRecommendation> & Pick<ReorderRecommendation, "sku">
): ReorderRecommendation {
  return {
    tenantId: "tropical-battery",
    name: overrides.name ?? overrides.sku,
    itemClass: null,
    category: null,
    isActive: null,
    isWhitelisted: true,
    buyerRank: null,
    purchaseRule: null,
    quantityOnHand: 10,
    quantityAvailable: 10,
    quantityAllocated: 0,
    effectiveAvailable: 10,
    quantityOnOrder: 0,
    quantityInPipeline: 0,
    pipelineBreakdown: {
      inTransit: 0,
      inBond: 0,
      atPort: 0,
      inClearing: 0,
    },
    reorderLevel: null,
    maximumStockLevel: null,
    annualDemandUnits: 1200,
    avgDailyDemandUnits: 100 / 30.44,
    rawAvgDailyDemandUnits: null,
    stockoutMonthsExcluded: null,
    abcClass: "A",
    turnoverRatio: null,
    unitCost: 100,
    supplierExternalId: "FK020",
    vendorItemNumber: null,
    leadTimeDays: 90,
    effectiveLeadTimeDays: 90,
    leadTimeSource: "priority_vendor",
    effectiveLeadTimeSupplierExternalId: "FK020",
    coverBands: resolveCoverBands(90),
    palletQty: null,
    containerQty: null,
    orderingCostPerOrder: null,
    holdingCostPerUnitYear: null,
    supplierUnitPrice: null,
    supplierName: "Hankook Atlasbx Co. Ltd",
    supplierLeadTimeDays: null,
    eoq: null,
    safetyStock: null,
    rop: null,
    suggestedQtyRaw: 40,
    suggestedQtyRounded: 40,
    roundingUnit: "unit",
    containerCount: null,
    palletCount: null,
    status: "critical",
    dataGaps: [],
    seasonality: null,
    ...overrides,
  };
}

describe("buildReorderExportRows", () => {
  it("maps recommendation fields for board export", () => {
    const rows = buildReorderExportRows([
      rec({ sku: "DT", name: 'Battery, "Special"' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sku).toBe("DT");
    expect(rows[0]?.status).toBe("Critical");
    expect(rows[0]?.supplierName).toBe("Hankook Atlasbx Co. Ltd");
    expect(rows[0]?.supplierCode).toBe("FK020");
    expect(rows[0]?.abcClass).toBe("A");
    expect(rows[0]?.suggestedQty).toBe(40);
  });
});

describe("buildReorderExportCsv", () => {
  it("includes BOM, headers, and escapes quotes/commas", () => {
    const sample: ReorderExportRow = {
      sku: "DT",
      productName: 'Battery, "Special"',
      status: "Critical",
      abcClass: "A",
      qtyAvailable: 0,
      suggestedQty: 40,
      monthsOfCover: "0.1",
      supplierName: "Hankook",
      supplierCode: "FK020",
      leadTimeDays: "90",
      unitCostJmd: "J$100.00",
      suggestedLineTotalJmd: "J$4,000.00",
    };

    const csv = buildReorderExportCsv([sample], {
      filterDescription: "status filter: actionable",
      generatedAt: new Date("2026-07-14T12:00:00.000Z"),
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("SKU,Product Name,Status");
    expect(csv).toContain('"Battery, ""Special"""');
    expect(csv).toContain("status filter: actionable");
  });
});

describe("buildReorderExportFilename", () => {
  it("uses a dated stamp", () => {
    expect(
      buildReorderExportFilename("csv", new Date("2026-07-14T12:00:00.000Z"))
    ).toBe("reorder-action-2026-07-14.csv");
    expect(
      buildReorderExportFilename("pdf", new Date("2026-07-14T12:00:00.000Z"))
    ).toBe("reorder-action-2026-07-14.pdf");
  });
});
