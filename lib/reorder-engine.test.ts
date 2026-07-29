import { describe, expect, it } from "vitest";
import {
  buildReorderRecommendation,
  calculateEOQ,
  calculateROP,
  calculateSafetyStock,
  calculateSuggestedQty,
  classifyReorderStatus,
  computeTurnoverRatio,
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
    unit_of_measure: null,
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
    raw_avg_daily_demand_units: null,
    stockout_months_excluded: null,
    current_cost_local: 100,
    best_supplier_external_id: "SUP-1",
    best_unit_price: 95,
    lead_time_days: 7,
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,
    safety_stock_months: null,
    pallet_qty: 24,
    container_qty: 50,
    ordering_cost_per_order: 100,
    holding_cost_per_unit_year: 2,
    is_whitelisted: true,
    buyer_rank: null,
    purchase_rule: null,
    seasonality: null,
    ...overrides,
  };
}

describe("computeTurnoverRatio", () => {
  it("divides annual demand by on-hand quantity", () => {
    expect(computeTurnoverRatio(1200, 200)).toBe(6);
    expect(computeTurnoverRatio(100, 16)).toBe(6.25);
  });

  it("returns null when stock is zero or negative", () => {
    expect(computeTurnoverRatio(1200, 0)).toBeNull();
    expect(computeTurnoverRatio(1200, -5)).toBeNull();
  });

  it("returns null when demand is missing or zero", () => {
    expect(computeTurnoverRatio(null, 50)).toBeNull();
    expect(computeTurnoverRatio(0, 50)).toBeNull();
    expect(computeTurnoverRatio(undefined, 50)).toBeNull();
  });
});

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
    expect(result.suggestedQtyZeroReason).toBeNull();
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
    expect(result.suggestedQtyZeroReason).toBe("already_covered");
  });

  it("uses lead-time coverage when EOQ and sane reorder_level are unavailable", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 0,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      rop: 105,
      reorderLevel: 2000,
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

  it("treats dirty 5274 sentinel as unset and uses demand-based default", () => {
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

    // 0.29315 * 30.44 * 3 ≈ 26.77
    expect(result.suggestedQty).toBeCloseTo(26.77, 1);
    expect(
      result.dataGaps.some((gap) => gap.includes("default reorder level"))
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
        gap.includes("No demand data - suggested quantity not calculated")
      )
    ).toBe(true);
    expect(result.suggestedQtyZeroReason).toBe("no_demand");
  });

  it("uses default reorder level when GP reorder_level is 0 and demand exists", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 0,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      rop: null,
      reorderLevel: 0,
      maximumStockLevel: 0,
      eoq: null,
      avgDailyDemandUnits: 12.161643,
      leadTimeDays: null,
      orderingCostPerOrder: null,
      holdingCostPerUnitYear: null,
      annualDemandUnits: 4439,
    });

    expect(result.suggestedQty).toBeCloseTo(1110.6, 1);
    expect(
      result.dataGaps.some((gap) => gap.includes("Using default reorder level"))
    ).toBe(true);
    expect(result.suggestedQtyZeroReason).toBeNull();
  });

  it("reports missing cost/lead time when demand exists but no qty basis", () => {
    const result = calculateSuggestedQty({
      quantityAvailable: 0,
      quantityOnOrder: 0,
      quantityInPipeline: 0,
      rop: null,
      reorderLevel: null,
      maximumStockLevel: 0,
      eoq: null,
      avgDailyDemandUnits: null,
      leadTimeDays: null,
      orderingCostPerOrder: null,
      holdingCostPerUnitYear: null,
      annualDemandUnits: 1200,
    });

    expect(result.suggestedQty).toBe(0);
    expect(
      result.dataGaps.some((gap) =>
        gap.includes(
          "Demand known but missing cost and lead time inputs - suggested quantity not calculated"
        )
      )
    ).toBe(true);
    expect(result.suggestedQtyZeroReason).toBe("no_target");
  });
});

describe("classifyReorderStatus", () => {
  const base = {
    quantityOnOrder: 0,
    quantityInPipeline: 0,
    rop: null,
    reorderLevel: null,
    suggestedQty: 0,
    annualDemandUnits: 1200, // 100 units / month
    quantityOnHand: 100,
    unitCost: 100,
  };

  it("marks stockouts as critical when demand exists", () => {
    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 0,
        quantityOnHand: 0,
        quantityAllocated: 0,
        quantityInPipeline: 50,
      })
    ).toBe("critical");
  });

  it("marks under 1 month of cover as critical", () => {
    // position = 40 → 0.4 months
    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 40,
        quantityOnHand: 40,
        quantityAllocated: 0,
        quantityInPipeline: 0,
      })
    ).toBe("critical");
  });

  it("marks 1-2 months of cover as watch", () => {
    // position = 150 → 1.5 months
    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 150,
        quantityOnHand: 150,
        quantityAllocated: 0,
        quantityInPipeline: 0,
      })
    ).toBe("watch");
  });

  it("marks 2-6 months of cover as reorder_needed", () => {
    // position = 300 → 3 months
    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 300,
        quantityOnHand: 300,
        quantityAllocated: 0,
        quantityInPipeline: 0,
      })
    ).toBe("reorder_needed");
  });

  it("marks 6+ months of cover as ok", () => {
    // position = 700 → 7 months
    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 700,
        quantityOnHand: 700,
        quantityAllocated: 0,
        quantityInPipeline: 0,
      })
    ).toBe("ok");
  });

  it("returns no_demand when there is no demand signal", () => {
    expect(
      classifyReorderStatus({
        quantityAvailable: 0,
        quantityOnOrder: 0,
        quantityInPipeline: 0,
        rop: null,
        reorderLevel: 40,
        suggestedQty: 0,
        annualDemandUnits: 0,
        quantityOnHand: 0,
        unitCost: 100,
      })
    ).toBe("no_demand");
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
    expect(recommendation.status).toBe("critical");
    expect(recommendation.turnoverRatio).toBeCloseTo(1200 / 35, 2);
    expect(recommendation.suggestedQtyZeroReason).toBeNull();
  });

  it("sets blocked_rule over already_covered when purchase rule blocks buys", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        // Position well above ROP so calc would be already_covered
        quantity_available: 80,
        quantity_on_order: 20,
        effective_available: 80,
        purchase_rule: { ruleType: "do_not_buy", lockedVendorId: null },
      })
    );

    expect(recommendation.suggestedQtyRaw).toBe(0);
    expect(recommendation.suggestedQtyZeroReason).toBe("blocked_rule");
  });

  it("does not set a zero reason for vendor_lock with a real suggested qty", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        purchase_rule: {
          ruleType: "vendor_lock",
          lockedVendorId: "SUP-1",
        },
      })
    );

    expect(recommendation.suggestedQtyRaw).toBeGreaterThan(0);
    expect(recommendation.suggestedQtyZeroReason).toBeNull();
  });

  it("uses months-of-demand safety stock for foreign suppliers", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        lead_time_days: 90,
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,        safety_stock_months: 3,
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
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,        maximum_stock_level: null,
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
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,        container_qty: null,
        pallet_qty: null,
      })
    );

    expect(recommendation.reorderLevel).toBeNull();
    expect(recommendation.suggestedQtyRaw).toBeCloseTo(26.77, 1);
    expect(recommendation.suggestedQtyRounded).toBeGreaterThan(0);
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
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,      })
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
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,      })
    );

    expect(recommendation.reorderLevel).toBeNull();
    expect(recommendation.suggestedQtyRaw).toBe(0);
    expect(recommendation.suggestedQtyRounded).toBe(0);
    expect(
      recommendation.dataGaps.some((gap) =>
        gap.includes("No demand data - suggested quantity not calculated")
      )
    ).toBe(true);
  });

  it("uses default reorder level when GP reorder_level is 0 but demand exists (AW-095)", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        sku: "AW-095",
        quantity_on_hand: 570,
        quantity_available: 484,
        quantity_allocated: 86,
        effective_available: 484,
        quantity_on_order: 0,
        quantity_in_transit: 0,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
        reorder_level: 0,
        maximum_stock_level: 0,
        annual_demand_units: 4439,
        avg_daily_demand_units: 12.161643,
        ordering_cost_per_order: null,
        holding_cost_per_unit_year: null,
        lead_time_days: null,
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,        container_qty: null,
        pallet_qty: null,
      })
    );

    expect(recommendation.reorderLevel).toBeNull();
    expect(recommendation.suggestedQtyRaw).toBeCloseTo(1110.6, 1);
    expect(recommendation.suggestedQtyRounded).toBeGreaterThan(0);
    expect(
      recommendation.dataGaps.some((gap) =>
        gap.includes("Using default reorder level")
      )
    ).toBe(true);
  });

  it("returns ok status when months of cover is 6 or more", () => {
    const recommendation = buildReorderRecommendation(
      baseRow({
        quantity_on_hand: 700,
        quantity_available: 700,
        quantity_allocated: 0,
        effective_available: 700,
        quantity_on_order: 0,
        quantity_in_transit: 0,
        quantity_in_bond: 0,
        quantity_at_port: 0,
        quantity_in_clearing: 0,
        annual_demand_units: 1200,
      })
    );

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

  it("returns no_demand for all-zero GP master items without inventory activity", () => {
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

    expect(recommendation.status).toBe("no_demand");
  });

  it("returns no_demand for zero-stock items with reorder level but no demand", () => {
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
    effective_lead_time_days: null,
    lead_time_source: null,
    effective_lead_time_supplier_external_id: null,      })
    );

    expect(recommendation.status).toBe("no_demand");
  });

  it("returns no_demand for service-style items with no demand or stock signals", () => {
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

    expect(recommendation.status).toBe("no_demand");
  });
});
