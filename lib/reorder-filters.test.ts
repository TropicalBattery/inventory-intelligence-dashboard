import { describe, expect, it } from "vitest";
import {
  countInactiveRecommendations,
  filterVisibleRecommendations,
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
    status: "inactive",
    dataGaps: [],
    ...overrides,
  };
}

describe("reorder filters", () => {
  it("counts inactive recommendations", () => {
    const recommendations = [
      makeRec({ sku: "A", status: "inactive" }),
      makeRec({ sku: "B", status: "critical" }),
      makeRec({ sku: "C", status: "inactive" }),
    ];

    expect(countInactiveRecommendations(recommendations)).toBe(2);
  });

  it("hides inactive items unless the toggle is enabled", () => {
    const recommendations = [
      makeRec({ sku: "A", status: "inactive" }),
      makeRec({ sku: "B", status: "reorder" }),
    ];

    expect(filterVisibleRecommendations(recommendations, false)).toHaveLength(1);
    expect(filterVisibleRecommendations(recommendations, true)).toHaveLength(2);
  });

  it("treats only critical and reorder as actionable", () => {
    expect(isActionableReorderStatus("critical")).toBe(true);
    expect(isActionableReorderStatus("reorder")).toBe(true);
    expect(isActionableReorderStatus("ok")).toBe(false);
    expect(isActionableReorderStatus("inactive")).toBe(false);
  });
});
