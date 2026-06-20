import { describe, expect, it } from "vitest";
import {
  countNoDemandRecommendations,
  filterMainRecommendations,
  isActionableReorderStatus,
} from "@/lib/reorder-filters";
import type { ReorderRecommendation } from "@/lib/types";

function makeRec(
  overrides: Partial<ReorderRecommendation>
): ReorderRecommendation {
  return {
    tenantId: "tropical-battery",
    sku: "SKU-1",
    name: "Test",
    itemClass: null,
    category: null,
    isActive: true,
    quantityOnHand: 0,
    quantityAvailable: 0,
    quantityAllocated: 0,
    effectiveAvailable: 0,
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
    annualDemandUnits: null,
    avgDailyDemandUnits: null,
    unitCost: null,
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
    status: "no_demand",
    dataGaps: [],
    ...overrides,
  };
}

describe("reorder filters", () => {
  it("counts no-demand recommendations", () => {
    const recommendations = [
      makeRec({ sku: "A", status: "no_demand" }),
      makeRec({ sku: "B", status: "critical" }),
      makeRec({ sku: "C", status: "no_demand" }),
    ];

    expect(countNoDemandRecommendations(recommendations)).toBe(2);
  });

  it("hides no-demand items from the main table", () => {
    const recommendations = [
      makeRec({ sku: "A", status: "no_demand" }),
      makeRec({ sku: "B", status: "reorder_needed" }),
    ];

    expect(filterMainRecommendations(recommendations)).toHaveLength(1);
  });

  it("treats critical and watch as actionable", () => {
    expect(isActionableReorderStatus("critical")).toBe(true);
    expect(isActionableReorderStatus("watch")).toBe(true);
    expect(isActionableReorderStatus("reorder_needed")).toBe(false);
    expect(isActionableReorderStatus("ok")).toBe(false);
    expect(isActionableReorderStatus("no_demand")).toBe(false);
  });
});
