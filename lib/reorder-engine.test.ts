import { describe, expect, it } from "vitest";
import {
  buildReorderRecommendation,
  calculateEOQ,
  calculateROP,
  calculateSafetyStock,
  calculateSuggestedQty,
  classifyReorderStatus,
  roundToPackSize,
} from "@/lib/reorder-engine";
import type { VwReorderInputsRow } from "@/lib/types";

function baseRow(overrides: Partial<VwReorderInputsRow> = {}): VwReorderInputsRow {
  return {
    tenant_id: "tropical-battery",
    sku: "SKU-001",
    name: "Test Battery",
    item_class: "A",
    category: "Batteries",
    quantity_on_hand: 35,
    quantity_available: 20,
    quantity_allocated: 15,
    effective_available: 25,
    quantity_on_order: 10,
    quantity_in_transit: 2,
    quantity_in_bond: 1,
    quantity_at_port: 1,
    quantity_in_clearing: 1,
    reorder_level: 50,
    maximum_stock_level: 200,
    annual_demand_units: 1200,
    avg_daily_demand_units: 10,
    current_cost_local: 100,
    best_supplier_external_id: "SUP-1",
    best_unit_price: 95,
    lead_time_days: 7,
    safety_stock_months: null,
    pallet_qty: 24,
    container_qty: 50,
    ordering_cost_per_order: 100,
    holding_cost_per_unit_year: 2,
    ...overrides,
  };
}

describe("calculateEOQ", () => {
  it("calculates EOQ with full valid inputs", () => {
    const eoq = calculateEOQ(1200, 100, 2);
    expect(eoq).toBeCloseTo(346.41, 2);
  });

  it("returns null when ordering or holding cost is missing", () => {
    expect(calculateEOQ(1200, null, 2)).toBeNull();
    expect(calculateEOQ(1200, 100, null)).toBeNull();
  });
});

describe("calculateSafetyStock", () => {
  it("uses the simple 50% lead-time demand buffer for local suppliers", () => {
    expect(calculateSafetyStock(10, 7)).toBe(35);
    expect(calculateSafetyStock(10, 59)).toBe(295);
  });

  it("uses months of demand for foreign suppliers", () => {
    expect(calculateSafetyStock(10, 60)).toBeCloseTo(913.2, 1);
    expect(calculateSafetyStock(10, 90)).toBeCloseTo(913.2, 1);
  });

  it("honors configurable safety_stock_months for foreign suppliers", () => {
    expect(calculateSafetyStock(10, 90, null, null, 6)).toBeCloseTo(1826.4, 1);
  });

  it("returns null when lead time is missing", () => {
    expect(calculateSafetyStock(10, null)).toBeNull();
  });
});

describe("calculateROP", () => {
  it("uses lead-time demand only", () => {
    expect(calculateROP(10, 7)).toBe(70);
    expect(calculateROP(10, 93)).toBe(930);
  });

  it("returns null when lead time is missing", () => {
    expect(calculateROP(10, null)).toBeNull();
  });
});

describe("calculateSuggestedQty", () => {
  it("uses EOQ when EOQ inputs are complete and stock is below ROP", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 20,
      quantityOnOrder: 10,
      quantityInPipeline: 5,
      rop: 105,
      reorderLevel: 50,
      maximumStockLevel: 200,
      eoq: 346.41,
      avgDailyDemandUnits: 10,
      leadTimeDays: 7,
      orderingCostPerOrder: 100,
      holdingCostPerUnitYear: 2,
      annualDemandUnits: 1200,
    });

    expect(result.suggestedQty).toBe(346.41);
    expect(result.dataGaps).toEqual([]);
  });

  it("returns zero when effective stock meets ROP", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 80,
      quantityOnOrder: 20,
      quantityInPipeline: 10,
      rop: 105,
      reorderLevel: 50,
      maximumStockLevel: 200,
      eoq: 346.41,
      avgDailyDemandUnits: 10,
      leadTimeDays: 7,
      orderingCostPerOrder: 100,
      holdingCostPerUnitYear: 2,
      annualDemandUnits: 1200,
    });

    expect(result.suggestedQty).toBe(0);
  });

  it("uses lead-time coverage when EOQ and sane reorder_level are unavailable", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 0,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      rop: 105,
      reorderLevel: 5274,
      maximumStockLevel: null,
      eoq: null,
      avgDailyDemandUnits: 10,
      leadTimeDays: 7,
      orderingCostPerOrder: null,
      holdingCostPerUnitYear: null,
      annualDemandUnits: 1200,
    });

    expect(result.suggestedQty).toBe(105);
    expect(
      result.dataGaps.some((gap) => gap.includes("lead-time coverage"))
    ).toBe(true);
  });

  it("uses sane reorder_level when EOQ is unavailable and demand exists", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 10,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      rop: null,
      reorderLevel: 40,
      maximumStockLevel: null,
      eoq: null,
      avgDailyDemandUnits: 5,
      leadTimeDays: null,
      orderingCostPerOrder: null,
      holdingCostPerUnitYear: null,
      annualDemandUnits: null,
    });

    expect(result.suggestedQty).toBe(40);
    expect(result.dataGaps.some((gap) => gap.includes("reorder_level"))).toBe(
      true
    );
  });

  it("returns zero when reorder_level exceeds sanity cap (96L928 pattern)", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 0,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      rop: null,
      reorderLevel: 5274,
      maximumStockLevel: 0,
      eoq: null,
      avgDailyDemandUnits: 0.29315,
      leadTimeDays: null,
      orderingCostPerOrder: null,
      holdingCostPerUnitYear: null,
      annualDemandUnits: 107,
    });

    expect(result.suggestedQty).toBe(0);
    expect(
      result.dataGaps.some((gap) =>
        gap.includes("Insufficient demand, cost, or lead time")
      )
    ).toBe(true);
  });

  it("returns zero when cost inputs and reorder_level are missing", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 0,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      rop: null,
      reorderLevel: 0,
      maximumStockLevel: 0,
      eoq: null,
      avgDailyDemandUnits: 0,
      leadTimeDays: null,
      orderingCostPerOrder: null,
      holdingCostPerUnitYear: null,
      annualDemandUnits: 0,
    });

    expect(result.suggestedQty).toBe(0);
    expect(
      result.dataGaps.some((gap) =>
        gap.includes("Insufficient demand, cost, or lead time")
      )
    ).toBe(true);
  });
});

describe("classifyReorderStatus", () => {
  const activeSignals = {
    annualDemandUnits: 1200,
    reorderLevel: 50,
    quantityOnHand: 10,
    quantityOnOrder: 5,
    unitCost: 100,
  };

  it("marks stockouts as critical when activity signals exist", () => {
    expect(
      classifyReorderStatus({
        ...activeSignals,
        quantityAvailable: 0,
        quantityOnOrder: 50,
        quantityInPipeline: 20,
        rop: 100,
        reorderLevel: 40,
        suggestedQty: 80,
      })
    ).toBe("critical");
  });

  it("marks healthy stock as ok when no reorder is suggested", () => {
    expect(
      classifyReorderStatus({
        ...activeSignals,
        quantityAvailable: 80,
        quantityOnOrder: 20,
        quantityInPipeline: 10,
        rop: 100,
        reorderLevel: 40,
        suggestedQty: 0,
      })
    ).toBe("ok");
  });

  it("returns inactive when all activity metrics are zero", () => {
    expect(
      classifyReorderStatus({
        quantityAvailable: 0,
        quantityOnOrder: 0,
        quantityInPipeline: 0,
        rop: null,
        reorderLevel: 0,
        suggestedQty: 0,
        annualDemandUnits: 0,
        quantityOnHand: 0,
        unitCost: 0,
      })
    ).toBe("inactive");
  });
});

describe("roundToPackSize", () => {
  it("rounds up to container multiples", () => {
    const result = roundToPackSize({
      suggestedQty: 165,
      containerQty: 50,
      palletQty: 24,
    });

    expect(result.roundedQty).toBe(200);
    expect(result.roundingUnit).toBe("container");
    expect(result.containerCount).toBe(4);
  });

  it("rounds up to pallet multiples when container is not set", () => {
    const result = roundToPackSize({
      suggestedQty: 25,
      containerQty: null,
      palletQty: 24,
    });

    expect(result.roundedQty).toBe(48);
    expect(result.roundingUnit).toBe("pallet");
    expect(result.palletCount).toBe(2);
  });

  it("rounds up to whole units when no pack size is set", () => {
    const result = roundToPackSize({
      suggestedQty: 12.2,
      containerQty: null,
      palletQty: null,
    });

    expect(result.roundedQty).toBe(13);
    expect(result.roundingUnit).toBe("unit");
  });

  it("returns zero when suggested quantity is zero", () => {
    expect(
      roundToPackSize({
        suggestedQty: 0,
        containerQty: 50,
        palletQty: 24,
      })
    ).toEqual({ roundedQty: 0, roundingUnit: "unit" });
  });
});

describe("buildReorderRecommendation", () => {
  it("builds a full recommendation with known calculated values", () => {
    const recommendation = buildReorderRecommendation(baseRow());

    expect(recommendation.eoq).toBeCloseTo(346.41, 2);
    expect(recommendation.safetyStock).toBe(35);
    expect(recommendation.rop).toBe(70);
    expect(recommendation.suggestedQtyRaw).toBeCloseTo(346.41, 2);
    expect(recommendation.suggestedQtyRounded).toBe(350);
    expect(recommendation.roundingUnit).toBe("container");
    expect(recommendation.containerCount).toBe(7);
    expect(recommendation.status).toBe("reorder");
  });

  it("uses months-of-demand safety stock for foreign suppliers", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        lead_time_days: 90,
        safety_stock_months: 3,
      })
    );

    expect(recommendation.safetyStock).toBeCloseTo(913.2, 1);
    expect(recommendation.rop).toBe(900);
  });

  it("records EOQ data gaps when ordering or holding cost is missing", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        ordering_cost_per_order: null,
        holding_cost_per_unit_year: null,
        maximum_stock_level: null,
      })
    );

    expect(recommendation.eoq).toBeNull();
    expect(
      recommendation.dataGaps.some((gap) =>
        gap.includes("EOQ not calculated")
      )
    ).toBe(true);
    expect(recommendation.suggestedQtyRaw).toBe(50);
  });

  it("uses reorder_level as target when lead time and EOQ are missing", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        lead_time_days: null,
        maximum_stock_level: null,
        ordering_cost_per_order: null,
        holding_cost_per_unit_year: null,
      })
    );

    expect(recommendation.rop).toBeNull();
    expect(recommendation.safetyStock).toBeNull();
    expect(
      recommendation.dataGaps.some((gap) => gap.includes("No lead_time_days"))
    ).toBe(true);
    expect(recommendation.suggestedQtyRaw).toBe(50);
  });

  it("returns zero suggested qty for anomalous reorder_level without cost or lead time (96L928 pattern)", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        sku: "96L928",
        quantity_on_hand: 0,
        quantity_available: 0,
        quantity_on_order: 0,
        quantity_in_transit: 0,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
        reorder_level: 5274,
        maximum_stock_level: 0,
        annual_demand_units: 107,
        avg_daily_demand_units: 0.29315,
        ordering_cost_per_order: null,
        holding_cost_per_unit_year: null,
        lead_time_days: null,
        container_qty: null,
        pallet_qty: null,
      })
    );

    expect(recommendation.suggestedQtyRaw).toBe(0);
    expect(recommendation.suggestedQtyRounded).toBe(0);
  });

  it("returns zero when only anomalous reorder_level exists without demand inputs (96807L pattern)", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        sku: "96807L",
        quantity_on_hand: 0,
        quantity_available: 0,
        quantity_on_order: 0,
        quantity_in_transit: 0,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
        reorder_level: 200,
        maximum_stock_level: 100,
        annual_demand_units: 0,
        avg_daily_demand_units: 0,
        ordering_cost_per_order: null,
        holding_cost_per_unit_year: null,
        lead_time_days: null,
      })
    );

    expect(recommendation.suggestedQtyRaw).toBe(0);
    expect(recommendation.suggestedQtyRounded).toBe(0);
  });

  it("returns zero suggested quantity when reorder_level and cost inputs are absent", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        reorder_level: 0,
        maximum_stock_level: 0,
        annual_demand_units: 0,
        avg_daily_demand_units: 0,
        ordering_cost_per_order: null,
        holding_cost_per_unit_year: null,
        lead_time_days: null,
      })
    );

    expect(recommendation.suggestedQtyRaw).toBe(0);
    expect(recommendation.suggestedQtyRounded).toBe(0);
  });

  it("returns ok status when effective stock is above ROP", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        quantity_on_hand: 100,
        quantity_available: 80,
        quantity_allocated: 20,
        effective_available: 90,
        quantity_on_order: 20,
        quantity_in_transit: 10,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
      })
    );

    expect(recommendation.suggestedQtyRaw).toBe(0);
    expect(recommendation.status).toBe("ok");
  });

  it("returns critical status when quantity available is zero with demand history", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        quantity_on_hand: 0,
        quantity_available: 0,
        quantity_on_order: 100,
        quantity_in_transit: 50,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
        annual_demand_units: 500,
      })
    );

    expect(recommendation.status).toBe("critical");
  });

  it("returns inactive for all-zero GP master items without inventory activity", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        sku: "08500BSER",
        name: "REBATE",
        quantity_on_hand: 0,
        quantity_available: 0,
        quantity_on_order: 0,
        quantity_in_transit: 0,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
        reorder_level: 0,
        maximum_stock_level: 0,
        annual_demand_units: 0,
        avg_daily_demand_units: 0,
        current_cost_local: 0,
      })
    );

    expect(recommendation.status).toBe("inactive");
  });

  it("returns inactive for service-style items with no demand or stock signals", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        sku: "08620TSER",
        name: "WHEEL BALANCING",
        quantity_on_hand: 0,
        quantity_available: 0,
        quantity_on_order: 0,
        quantity_in_transit: 0,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
        reorder_level: 0,
        annual_demand_units: 0,
        current_cost_local: null,
      })
    );

    expect(recommendation.status).toBe("inactive");
  });
});
