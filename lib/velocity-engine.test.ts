import { describe, expect, it } from "vitest";
import {
  buildVelocityDiagnostic,
  calculateDaysOfCover,
  classifyTrend,
  detectMismatch,
  projectStockoutDate,
} from "@/lib/velocity-engine";
import type { ReorderRecommendation, VwSalesVelocityRow } from "@/lib/types";

function baseVelocityRow(
  overrides: Partial<VwSalesVelocityRow> = {}
): VwSalesVelocityRow {
  return {
    tenant_id: "tropical-battery",
    sku: "SKU-001",
    units_sold_last_30d: 90,
    units_sold_31_60d: 60,
    units_sold_61_90d: 30,
    units_sold_trailing_12m: 720,
    avg_monthly_last_3m: 60,
    avg_monthly_trailing_12m: 60,
    velocity_trend_pct: 0,
    last_sale_date: "2026-06-01T00:00:00.000Z",
    days_since_last_sale: 11,
    ...overrides,
  };
}

function baseReorderRow(
  overrides: Partial<ReorderRecommendation> = {}
): ReorderRecommendation {
  return {
    tenantId: "tropical-battery",
    sku: "SKU-001",
    name: "Test Battery",
    itemClass: "A",
    category: "Batteries",
    isActive: true,
    quantityOnHand: 40,
    quantityAvailable: 40,
    quantityAllocated: 0,
    effectiveAvailable: 40,
    quantityOnOrder: 0,
    quantityInPipeline: 0,
    pipelineBreakdown: {
      inTransit: 0,
      inBond: 0,
      atPort: 0,
      inClearing: 0,
    },
    reorderLevel: 50,
    maximumStockLevel: 200,
    annualDemandUnits: 720,
    avgDailyDemandUnits: 2,
    unitCost: 100,
    supplierExternalId: "SUP-1",
    vendorItemNumber: "V-100",
    leadTimeDays: 14,
    palletQty: 24,
    containerQty: 50,
    orderingCostPerOrder: 100,
    holdingCostPerUnitYear: 2,
    supplierUnitPrice: 95,
    supplierName: "Acme Supply",
    supplierLeadTimeDays: 10,
    eoq: 100,
    safetyStock: 10,
    rop: 50,
    suggestedQtyRaw: 60,
    suggestedQtyRounded: 60,
    roundingUnit: "unit",
    containerCount: null,
    palletCount: null,
    status: "reorder_needed",
    dataGaps: [],
    ...overrides,
  };
}

describe("classifyTrend", () => {
  it("returns unknown when trend percent is null", () => {
    expect(classifyTrend(null)).toBe("unknown");
  });

  it("classifies accelerating, stable, and decelerating trends", () => {
    expect(classifyTrend(20)).toBe("accelerating");
    expect(classifyTrend(5)).toBe("stable");
    expect(classifyTrend(-20)).toBe("decelerating");
  });
});

describe("calculateDaysOfCover", () => {
  it("calculates days of cover from recent monthly velocity", () => {
    expect(calculateDaysOfCover(60, 60)).toBe(30);
  });

  it("returns null when recent sales rate is zero", () => {
    expect(calculateDaysOfCover(50, 0)).toBeNull();
  });
});

describe("detectMismatch", () => {
  it("flags accelerating trend with insufficient cover as high severity", () => {
    const flags = detectMismatch({
      velocityTrend: "accelerating",
      daysOfCover: 10,
      quantityAvailable: 20,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      leadTimeDays: 14,
      avgMonthlyLast3m: 60,
      unitsSoldLast30d: 90,
      unitsSold31To60d: 60,
    });

    expect(
      flags.some((flag) => flag.type === "accelerating_insufficient_cover")
    ).toBe(true);
    expect(flags.find((flag) => flag.type === "accelerating_insufficient_cover")?.severity).toBe(
      "high"
    );
  });

  it("flags decelerating trend with excess incoming stock as medium severity", () => {
    const flags = detectMismatch({
      velocityTrend: "decelerating",
      daysOfCover: 45,
      quantityAvailable: 30,
      quantityOnOrder: 80,
      quantityInPipeline: 50,
      leadTimeDays: 14,
      avgMonthlyLast3m: 30,
      unitsSoldLast30d: 20,
      unitsSold31To60d: 25,
    });

    expect(
      flags.some((flag) => flag.type === "decelerating_excess_incoming")
    ).toBe(true);
    expect(flags.find((flag) => flag.type === "decelerating_excess_incoming")?.severity).toBe(
      "medium"
    );
  });

  it("detects dead or slow-moving stock", () => {
    const flags = detectMismatch({
      velocityTrend: "unknown",
      daysOfCover: null,
      quantityAvailable: 25,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      leadTimeDays: 14,
      avgMonthlyLast3m: 0,
      unitsSoldLast30d: 0,
      unitsSold31To60d: 0,
    });

    expect(flags.some((flag) => flag.type === "dead_or_slow_moving_stock")).toBe(
      true
    );
  });

  it("returns no flags for stable trend with adequate cover", () => {
    const flags = detectMismatch({
      velocityTrend: "stable",
      daysOfCover: 30,
      quantityAvailable: 60,
      quantityOnOrder: 20,
      quantityInPipeline: 10,
      leadTimeDays: 14,
      avgMonthlyLast3m: 60,
      unitsSoldLast30d: 60,
      unitsSold31To60d: 55,
    });

    expect(flags).toEqual([]);
  });
});

describe("projectStockoutDate", () => {
  it("projects stockout date from days of cover", () => {
    const referenceDate = new Date("2026-06-01T12:00:00.000Z");
    const stockoutDate = projectStockoutDate(10, referenceDate);

    expect(stockoutDate?.toISOString().slice(0, 10)).toBe("2026-06-11");
  });

  it("returns null when days of cover is unavailable", () => {
    expect(projectStockoutDate(null)).toBeNull();
  });
});

describe("buildVelocityDiagnostic", () => {
  it("combines velocity and reorder context into a diagnostic", () => {
    const diagnostic = buildVelocityDiagnostic(
      baseVelocityRow({ velocity_trend_pct: 25 }),
      baseReorderRow({ quantityAvailable: 10, leadTimeDays: 14 }),
      new Date("2026-06-12T00:00:00.000Z")
    );

    expect(diagnostic.trend).toBe("accelerating");
    expect(diagnostic.daysOfCover).toBeCloseTo(5, 1);
    expect(diagnostic.mismatchFlags.length).toBeGreaterThan(0);
    expect(diagnostic.unitsSoldLast30d).toBe(90);
    expect(diagnostic.avgMonthlyLast3m).toBe(60);
  });

  it("avoids divide by zero when recent sales are absent", () => {
    const diagnostic = buildVelocityDiagnostic(
      baseVelocityRow({
        units_sold_last_30d: 0,
        units_sold_31_60d: 0,
        units_sold_61_90d: 0,
        avg_monthly_last_3m: 0,
        velocity_trend_pct: null,
      }),
      baseReorderRow({ quantityAvailable: 15 })
    );

    expect(diagnostic.daysOfCover).toBeNull();
    expect(diagnostic.projectedStockoutDate).toBeNull();
    expect(
      diagnostic.mismatchFlags.some(
        (flag) => flag.type === "dead_or_slow_moving_stock"
      )
    ).toBe(true);
  });
});
