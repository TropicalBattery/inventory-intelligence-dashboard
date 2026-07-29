import { describe, expect, it } from "vitest";
import {
  detectExceptions,
  hasConflictingRules,
  hasMissingSupplierData,
  isStaleDemand,
  summarizeExceptions,
  STALE_DEMAND_DAYS,
  type NegativeStockRow,
  type StaleDemandRow,
} from "@/lib/exceptions/detect";
import type { ReorderRecommendation } from "@/lib/types";

function rec(
  overrides: Partial<ReorderRecommendation> &
    Pick<ReorderRecommendation, "sku">
): ReorderRecommendation {
  return {
    tenantId: "tropical-battery",
    name: overrides.name ?? overrides.sku,
    itemClass: null,
    category: null,
    unitOfMeasure: null,
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
    annualDemandUnits: 100,
    avgDailyDemandUnits: 1,
    rawAvgDailyDemandUnits: null,
    stockoutMonthsExcluded: null,
    abcClass: null,
    turnoverRatio: null,
    unitCost: 10,
    supplierExternalId: "SUP-1",
    vendorItemNumber: null,
    leadTimeDays: 14,
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
    orderingCostPerOrder: 10,
    holdingCostPerUnitYear: 1,
    supplierUnitPrice: 10,
    supplierName: null,
    supplierLeadTimeDays: null,
    eoq: 10,
    safetyStock: 1,
    rop: 5,
    suggestedQtyRaw: 5,
    suggestedQtyRounded: 5,
    roundingUnit: "unit",
    containerCount: null,
    palletCount: null,
    status: "ok",
    dataGaps: [],
    suggestedQtyZeroReason: null,
    seasonality: null,
    openPoQty: 0,
    openPoRefs: [],
    inbound: null,
    ...overrides,
  };
}

describe("hasMissingSupplierData", () => {
  it("flags whitelisted demand SKUs with no lead time / supplier", () => {
    expect(
      hasMissingSupplierData(
        rec({
          sku: "A",
          supplierExternalId: null,
          leadTimeDays: null,
          dataGaps: ["No lead_time_days - ROP not calculated"],
        })
      )
    ).toBe(true);
  });

  it("ignores non-whitelisted and no-demand SKUs", () => {
    expect(
      hasMissingSupplierData(
        rec({
          sku: "B",
          isWhitelisted: false,
          supplierExternalId: null,
          leadTimeDays: null,
        })
      )
    ).toBe(false);
    expect(
      hasMissingSupplierData(
        rec({
          sku: "C",
          annualDemandUnits: 0,
          supplierExternalId: null,
          leadTimeDays: null,
        })
      )
    ).toBe(false);
  });
});

describe("hasConflictingRules", () => {
  it("flags whitelist + discontinue / do_not_buy dual membership", () => {
    expect(
      hasConflictingRules(
        rec({
          sku: "D",
          purchaseRule: { ruleType: "discontinue", lockedVendorId: null },

        })
      )
    ).toBe(true);
    expect(
      hasConflictingRules(
        rec({
          sku: "E",
          purchaseRule: { ruleType: "do_not_buy", lockedVendorId: null },

        })
      )
    ).toBe(true);
    expect(
      hasConflictingRules(
        rec({
          sku: "F",
          purchaseRule: {
            ruleType: "vendor_lock",
            lockedVendorId: "V1",
          },

        })
      )
    ).toBe(false);
  });
});

describe("isStaleDemand 90-day boundary", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  it("is not stale at exactly 90 days", () => {
    const lastSalesDate = new Date(now);
    lastSalesDate.setUTCDate(lastSalesDate.getUTCDate() - STALE_DEMAND_DAYS);
    expect(
      isStaleDemand(
        {
          sku: "S",
          quantityOnHand: 5,
          lastSalesDate: lastSalesDate.toISOString(),
        },
        now
      )
    ).toBe(false);
  });

  it("is stale at 91 days with stock held", () => {
    const lastSalesDate = new Date(now);
    lastSalesDate.setUTCDate(
      lastSalesDate.getUTCDate() - (STALE_DEMAND_DAYS + 1)
    );
    expect(
      isStaleDemand(
        {
          sku: "S",
          quantityOnHand: 5,
          lastSalesDate: lastSalesDate.toISOString(),
        },
        now
      )
    ).toBe(true);
  });

  it("requires positive on-hand", () => {
    const lastSalesDate = new Date(now);
    lastSalesDate.setUTCDate(
      lastSalesDate.getUTCDate() - (STALE_DEMAND_DAYS + 10)
    );
    expect(
      isStaleDemand(
        {
          sku: "S",
          quantityOnHand: 0,
          lastSalesDate: lastSalesDate.toISOString(),
        },
        now
      )
    ).toBe(false);
  });
});

describe("detectExceptions", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  it("aggregates one SKU with multiple exception types", () => {
    const lastSalesDate = new Date(now);
    lastSalesDate.setUTCDate(
      lastSalesDate.getUTCDate() - (STALE_DEMAND_DAYS + 5)
    );

    const groups = detectExceptions({
      now,
      recommendations: [
        rec({
          sku: "MULTI",
          name: "Multi issue",
          quantityOnHand: 12,
          supplierExternalId: null,
          leadTimeDays: null,
          dataGaps: ["No lead_time_days - ROP not calculated"],
          purchaseRule: { ruleType: "do_not_buy", lockedVendorId: null },

        }),
      ],
      negativeStockRows: [
        {
          sku: "MULTI",
          locationCode: "W/H",
          quantityOnHand: -3,
          quantityAvailable: -3,
        } satisfies NegativeStockRow,
      ],
      staleDemandRows: [
        {
          sku: "MULTI",
          quantityOnHand: 12,
          lastSalesDate: lastSalesDate.toISOString(),
        } satisfies StaleDemandRow,
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].severity).toBe("high");
    expect(groups[0].exceptions.map((e) => e.type).sort()).toEqual([
      "conflicting_rules",
      "missing_supplier_data",
      "negative_stock",
      "stale_demand",
    ]);
  });

  it("keeps negative stock catalogue-wide and conflicts whitelist-scoped", () => {
    const groups = detectExceptions({
      now,
      recommendations: [
        rec({
          sku: "WL",
          isWhitelisted: true,
          purchaseRule: { ruleType: "discontinue", lockedVendorId: null },

        }),
        rec({
          sku: "OFF",
          isWhitelisted: false,
          purchaseRule: { ruleType: "discontinue", lockedVendorId: null },

        }),
      ],
      negativeStockRows: [
        {
          sku: "OFF-CATALOGUE",
          locationCode: "GROVE",
          quantityOnHand: -17958,
          quantityAvailable: -17958,
        },
      ],
      staleDemandRows: [],
    });

    const skus = groups.map((g) => g.sku).sort();
    expect(skus).toEqual(["OFF-CATALOGUE", "WL"]);
    expect(
      groups.find((g) => g.sku === "OFF")?.exceptions.some(
        (e) => e.type === "conflicting_rules"
      )
    ).toBeUndefined();
  });

  it("summarizes type counts without NaN on empty", () => {
    expect(summarizeExceptions([])).toEqual({
      totalSkus: 0,
      negativeStock: 0,
      missingSupplierData: 0,
      staleDemand: 0,
      conflictingRules: 0,
    });
  });
});
