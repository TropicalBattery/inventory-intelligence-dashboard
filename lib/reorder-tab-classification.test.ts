import { describe, expect, it } from "vitest";
import {
  buildReorderTabCounts,
  classifyRecommendationsByTab,
  classifyRecommendationTab,
} from "@/lib/reorder-tab-classification";
import type { ReorderRecommendation } from "@/lib/types";

function rec(
  overrides: Partial<ReorderRecommendation> & Pick<ReorderRecommendation, "sku">
): ReorderRecommendation {
  return {
    tenantId: "tropical-battery",
    name: overrides.name ?? overrides.sku,
    itemClass: overrides.itemClass ?? null,
    category: null,
    isActive: null,
    quantityOnHand: 0,
    quantityAvailable: 0,
    quantityOnOrder: 0,
    quantityInPipeline: 0,
    pipelineBreakdown: {
      inTransit: 0,
      inBond: 0,
      atPort: 0,
      inClearing: 0,
    },
    reorderLevel: 0,
    maximumStockLevel: 0,
    annualDemandUnits: 0,
    avgDailyDemandUnits: 0,
    unitCost: 0,
    supplierExternalId: null,
    vendorItemNumber: null,
    leadTimeDays: null,
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
    ...overrides,
  };
}

describe("classifyRecommendationTab", () => {
  it("routes reorderable battery classes to reorder tab", () => {
    expect(
      classifyRecommendationTab(rec({ sku: "A", itemClass: "BATTERY" }))
    ).toBe("reorder");
  });

  it("routes tyre classes to non-stock tab", () => {
    expect(
      classifyRecommendationTab(rec({ sku: "B", itemClass: "GY-TYRE" }))
    ).toBe("nonstock");
  });

  it("routes blank classes to unclassified tab", () => {
    expect(
      classifyRecommendationTab(rec({ sku: "C", itemClass: null }))
    ).toBe("unclassified");
  });
});

describe("classifyRecommendationsByTab", () => {
  it("partitions recommendations into three buckets", () => {
    const classified = classifyRecommendationsByTab([
      rec({ sku: "BAT-1", itemClass: "BATT-VRLA", status: "critical" }),
      rec({ sku: "TYRE-1", itemClass: "HANKOOK", status: "critical" }),
      rec({ sku: "UNK-1", itemClass: "UNKNOWN", status: "ok" }),
    ]);

    expect(classified.reorderAction.map((row) => row.sku)).toEqual(["BAT-1"]);
    expect(classified.nonStock.map((row) => row.sku)).toEqual(["TYRE-1"]);
    expect(classified.unclassified.map((row) => row.sku)).toEqual(["UNK-1"]);

    const counts = buildReorderTabCounts(classified);
    expect(counts.reorderActionTotal).toBe(1);
    expect(counts.reorderActionNeedAttention).toBe(1);
    expect(counts.nonStockTotal).toBe(1);
    expect(counts.unclassifiedTotal).toBe(1);
  });
});
