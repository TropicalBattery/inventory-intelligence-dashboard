import { describe, expect, it } from "vitest";
import { OVERSTOCK_MONTHS } from "@/lib/reorder/cover-thresholds";
import {
  computeExcessUnits,
  computeExcessValue,
  isOverstockRecommendation,
  selectOverstockRecommendations,
} from "@/lib/reorder/overstock";
import type { ReorderRecommendation } from "@/lib/types";

function baseRec(
  overrides: Partial<ReorderRecommendation> = {}
): ReorderRecommendation {
  return {
    tenantId: "tropical-battery",
    sku: "SKU-1",
    name: "Test",
    itemClass: "BATTERY",
    category: null,
    isActive: true,
    isWhitelisted: true,
    buyerRank: null,
    purchaseRule: null,
    quantityOnHand: 1200,
    quantityAvailable: 1200,
    quantityAllocated: 0,
    effectiveAvailable: 1200,
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
    annualDemandUnits: 1200, // 100 / month
    avgDailyDemandUnits: null,
    rawAvgDailyDemandUnits: null,
    stockoutMonthsExcluded: null,
    abcClass: null,
    turnoverRatio: null,
    unitCost: 50,
    supplierExternalId: null,
    vendorItemNumber: null,
    leadTimeDays: null,
    effectiveLeadTimeDays: null,
    leadTimeSource: null,
    effectiveLeadTimeSupplierExternalId: null,
    coverBands: {
      criticalBelow: 1,
      watchBelow: 2,
      okBelow: 6,
    },
    palletQty: null,
    containerQty: null,
    orderingCostPerOrder: null,
    holdingCostPerUnitYear: null,
    supplierUnitPrice: null,
    supplierName: null,
    supplierLeadTimeDays: null,
    eoq: null,
    safetyStock: null,
    rop: null,
    suggestedQtyRaw: 0,
    suggestedQtyRounded: 0,
    roundingUnit: "unit",
    containerCount: null,
    palletCount: null,
    status: "ok",
    dataGaps: [],
    seasonality: null,
    openPoQty: 0,
    openPoRefs: [],
    ...overrides,
  };
}

describe("overstock excess math", () => {
  it("computes excess units above OVERSTOCK_MONTHS of monthly demand", () => {
    // position 1200, avg monthly 100, threshold 6*100=600 -> excess 600
    expect(computeExcessUnits(baseRec())).toBe(600);
    expect(computeExcessValue(600, 50)).toBe(30_000);
  });

  it("returns null excess value when unit cost is missing", () => {
    expect(computeExcessValue(600, null)).toBeNull();
    expect(computeExcessValue(600, 0)).toBeNull();
    expect(computeExcessValue(null, 50)).toBeNull();
  });

  it("excludes items at or below the overstock months threshold", () => {
    // 600 on hand / 100 monthly = 6 months exactly -> not overstock (> 6)
    const atCeiling = baseRec({
      quantityOnHand: OVERSTOCK_MONTHS * 100,
      quantityAvailable: OVERSTOCK_MONTHS * 100,
    });
    expect(isOverstockRecommendation(atCeiling)).toBe(false);

    const over = baseRec({
      quantityOnHand: OVERSTOCK_MONTHS * 100 + 1,
      quantityAvailable: OVERSTOCK_MONTHS * 100 + 1,
    });
    expect(isOverstockRecommendation(over)).toBe(true);
  });

  it("selects only overstocked rows from a set", () => {
    const rows = selectOverstockRecommendations([
      baseRec({ sku: "OVER", quantityOnHand: 900, quantityAvailable: 900 }),
      baseRec({
        sku: "OK",
        quantityOnHand: 100,
        quantityAvailable: 100,
        status: "critical",
      }),
      baseRec({ sku: "ND", status: "no_demand", annualDemandUnits: null }),
    ]);

    expect(rows.map((row) => row.sku)).toEqual(["OVER"]);
  });
});
