import { describe, expect, it } from "vitest";
import { DAYS_PER_MONTH, DEMAND_WINDOW_MONTHS } from "@/lib/reorder/cover-thresholds";
import {
  applyAdjustedDemandToRow,
  computeAdjustedDemandFromMonthlySales,
  demandWindowEnd,
  demandWindowStart,
  shouldShowDemandAdjustmentNote,
  type MonthlySalesRow,
} from "@/lib/reorder/demand";
import type { VwReorderInputsRow } from "@/lib/types";

const referenceDate = new Date(Date.UTC(2026, 6, 13)); // 2026-07-13

function monthIso(year: number, monthIndex0: number): string {
  return new Date(Date.UTC(year, monthIndex0, 1)).toISOString();
}

function baseInputRow(
  overrides: Partial<VwReorderInputsRow> = {}
): VwReorderInputsRow {
  return {
    tenant_id: "tropical-battery",
    sku: "SKU-001",
    name: "Test",
    item_class: null,
    category: null,
    quantity_on_hand: 0,
    quantity_available: 0,
    quantity_allocated: 0,
    effective_available: 0,
    quantity_on_order: 0,
    quantity_in_transit: 0,
    quantity_in_bond: 0,
    quantity_at_port: 0,
    quantity_in_clearing: 0,
    reorder_level: null,
    maximum_stock_level: null,
    annual_demand_units: 365,
    avg_daily_demand_units: 1,
    raw_avg_daily_demand_units: null,
    stockout_months_excluded: null,
    ordering_cost_per_order: null,
    holding_cost_per_unit_year: null,
    current_cost_local: null,
    best_supplier_external_id: null,
    best_unit_price: null,
    lead_time_days: null,
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,
    safety_stock_months: null,
    pallet_qty: null,
    container_qty: null,
    is_whitelisted: true,
    buyer_rank: null,
    purchase_rule: null,
    seasonality: null,
    ...overrides,
  };
}

describe("demand window bounds", () => {
  it("uses last 6 complete months ending before the reference month (Jul 13)", () => {
    expect(demandWindowStart(referenceDate, 6)).toEqual(
      new Date(Date.UTC(2026, 0, 1))
    );
    expect(demandWindowEnd(referenceDate)).toEqual(
      new Date(Date.UTC(2026, 6, 1))
    );
  });

  it("on the 1st of a month, window still ends with last complete month", () => {
    const firstOfJuly = new Date(Date.UTC(2026, 6, 1));
    expect(demandWindowStart(firstOfJuly, 6)).toEqual(
      new Date(Date.UTC(2026, 0, 1))
    );
    expect(demandWindowEnd(firstOfJuly)).toEqual(
      new Date(Date.UTC(2026, 6, 1))
    );
  });
});

describe("computeAdjustedDemandFromMonthlySales", () => {
  it("uses selling months only within complete months (excludes current month)", () => {
    // Jul-2026 window = Jan–Jun. Three selling months in Feb–Apr; Jul ignored.
    const rows: MonthlySalesRow[] = [
      { salesMonth: monthIso(2026, 1), units: 100 }, // Feb
      { salesMonth: monthIso(2026, 2), units: 100 }, // Mar
      { salesMonth: monthIso(2026, 3), units: 100 }, // Apr
      { salesMonth: monthIso(2026, 6), units: 500 }, // Jul (excluded)
      { salesMonth: monthIso(2025, 6), units: 0 }, // Jul 2025 (outside)
      { salesMonth: monthIso(2025, 7), units: 0 },
    ];

    const adjusted = computeAdjustedDemandFromMonthlySales(rows, {
      referenceDate,
    });

    expect(adjusted).not.toBeNull();
    expect(adjusted!.avgDailyDemandUnits).toBeCloseTo(
      300 / (3 * DAYS_PER_MONTH),
      2
    );
    expect(adjusted!.avgDailyDemandUnits).toBeCloseTo(3.29, 2);
    expect(adjusted!.avgDailyDemandUnits).not.toBeCloseTo(0.82, 1);
    expect(adjusted!.stockoutMonthsExcluded).toBe(DEMAND_WINDOW_MONTHS - 3);
    expect(adjusted!.annualDemandUnits).toBeCloseTo(
      adjusted!.avgDailyDemandUnits * 365,
      5
    );
  });

  it("ignores July rows for AW-095 Jan–Jun fixture (~12.38 daily)", () => {
    const rows: MonthlySalesRow[] = [
      { salesMonth: monthIso(2026, 0), units: 671 }, // Jan
      { salesMonth: monthIso(2026, 1), units: 299 }, // Feb
      { salesMonth: monthIso(2026, 2), units: 401 }, // Mar
      { salesMonth: monthIso(2026, 3), units: 506 }, // Apr
      { salesMonth: monthIso(2026, 4), units: 247 }, // May
      { salesMonth: monthIso(2026, 5), units: 138 }, // Jun
      { salesMonth: monthIso(2026, 6), units: 90 }, // Jul — ignored
    ];

    const adjusted = computeAdjustedDemandFromMonthlySales(rows, {
      referenceDate,
    });

    expect(adjusted).not.toBeNull();
    expect(adjusted!.avgDailyDemandUnits).toBeCloseTo(
      2262 / (6 * DAYS_PER_MONTH),
      5
    );
    expect(adjusted!.avgDailyDemandUnits).toBeCloseTo(12.39, 1);
    expect(adjusted!.stockoutMonthsExcluded).toBe(0);
  });

  it("marks stockoutMonthsExcluded 0 when every complete month had sales", () => {
    const rows: MonthlySalesRow[] = [
      { salesMonth: monthIso(2026, 0), units: 100 },
      { salesMonth: monthIso(2026, 1), units: 100 },
      { salesMonth: monthIso(2026, 2), units: 100 },
      { salesMonth: monthIso(2026, 3), units: 100 },
      { salesMonth: monthIso(2026, 4), units: 100 },
      { salesMonth: monthIso(2026, 5), units: 100 },
      // no July sales
    ];

    const adjusted = computeAdjustedDemandFromMonthlySales(rows, {
      referenceDate,
    });

    expect(adjusted).not.toBeNull();
    expect(adjusted!.stockoutMonthsExcluded).toBe(0);
    expect(
      shouldShowDemandAdjustmentNote({
        avgDailyDemandUnits: adjusted!.avgDailyDemandUnits,
        rawAvgDailyDemandUnits: adjusted!.avgDailyDemandUnits,
        stockoutMonthsExcluded: adjusted!.stockoutMonthsExcluded,
      })
    ).toBe(false);
  });

  it("returns null for sporadic demand (fewer than 3 selling months)", () => {
    const rows: MonthlySalesRow[] = [
      { salesMonth: monthIso(2026, 5), units: 50 }, // Jun only
    ];

    expect(
      computeAdjustedDemandFromMonthlySales(rows, { referenceDate })
    ).toBeNull();
  });

  it("matches steady seller pace across all complete window months", () => {
    const rows: MonthlySalesRow[] = [
      { salesMonth: monthIso(2026, 0), units: 100 }, // Jan
      { salesMonth: monthIso(2026, 1), units: 100 },
      { salesMonth: monthIso(2026, 2), units: 100 },
      { salesMonth: monthIso(2026, 3), units: 100 },
      { salesMonth: monthIso(2026, 4), units: 100 },
      { salesMonth: monthIso(2026, 5), units: 100 }, // Jun
      { salesMonth: monthIso(2026, 6), units: 999 }, // Jul ignored
    ];

    const adjusted = computeAdjustedDemandFromMonthlySales(rows, {
      referenceDate,
    });

    expect(adjusted).not.toBeNull();
    expect(adjusted!.avgDailyDemandUnits).toBeCloseTo(
      600 / (6 * DAYS_PER_MONTH),
      2
    );
    expect(adjusted!.stockoutMonthsExcluded).toBe(0);
  });
});

describe("applyAdjustedDemandToRow", () => {
  it("overrides avg daily and annual when adjustment applies", () => {
    const rows: MonthlySalesRow[] = [
      { salesMonth: monthIso(2026, 1), units: 100 },
      { salesMonth: monthIso(2026, 2), units: 100 },
      { salesMonth: monthIso(2026, 3), units: 100 },
    ];

    const result = applyAdjustedDemandToRow(
      baseInputRow({
        avg_daily_demand_units: 0.82,
        annual_demand_units: 300,
      }),
      rows,
      { referenceDate }
    );

    expect(result.raw_avg_daily_demand_units).toBe(0.82);
    expect(result.avg_daily_demand_units).toBeCloseTo(3.29, 2);
    expect(result.annual_demand_units).toBeCloseTo(
      result.avg_daily_demand_units! * 365,
      5
    );
    expect(result.stockout_months_excluded).toBe(3);
  });

  it("keeps item_costing when adjustment returns null", () => {
    const result = applyAdjustedDemandToRow(
      baseInputRow({
        avg_daily_demand_units: 1.5,
        annual_demand_units: 547.5,
      }),
      [{ salesMonth: monthIso(2026, 6), units: 10 }],
      { referenceDate }
    );

    expect(result.avg_daily_demand_units).toBe(1.5);
    expect(result.annual_demand_units).toBe(547.5);
    expect(result.raw_avg_daily_demand_units).toBeNull();
    expect(result.stockout_months_excluded).toBeNull();
  });
});

describe("shouldShowDemandAdjustmentNote", () => {
  it("shows when adjusted differs from raw by more than 25%", () => {
    expect(
      shouldShowDemandAdjustmentNote({
        avgDailyDemandUnits: 3.29,
        rawAvgDailyDemandUnits: 0.82,
        stockoutMonthsExcluded: 3,
      })
    ).toBe(true);
  });

  it("hides when change is within 25%", () => {
    expect(
      shouldShowDemandAdjustmentNote({
        avgDailyDemandUnits: 1.1,
        rawAvgDailyDemandUnits: 1,
        stockoutMonthsExcluded: 1,
      })
    ).toBe(false);
  });

  it("hides when stockoutMonthsExcluded is 0", () => {
    expect(
      shouldShowDemandAdjustmentNote({
        avgDailyDemandUnits: 12.38,
        rawAvgDailyDemandUnits: 5,
        stockoutMonthsExcluded: 0,
      })
    ).toBe(false);
  });
});
