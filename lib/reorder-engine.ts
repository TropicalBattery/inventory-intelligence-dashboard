import { parsePipelineBreakdown } from "@/lib/pipeline-breakdown";
import type {
  ClassifyReorderStatusInput,
  PackSizeInput,
  PackSizeResult,
  ReorderRecommendation,
  ReorderStatus,
  SuggestedQtyInput,
  VwReorderInputsRow,
} from "@/lib/types";

/** Excludes GP ORDRPNTQTY bulk-set anomalies (e.g. 5,274) until source data is fixed. */
export const REORDER_LEVEL_SANITY_CAP = 1000;

function isPositiveNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && value > 0;
}

function isNonNegativeNumber(
  value: number | null | undefined
): value is number {
  return value !== null && value !== undefined && value >= 0;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateEOQ(
  annualDemand: number | null,
  orderingCost: number | null,
  holdingCost: number | null
): number | null {
  if (
    !isPositiveNumber(annualDemand) ||
    !isPositiveNumber(orderingCost) ||
    !isPositiveNumber(holdingCost)
  ) {
    return null;
  }

  const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
  return roundToTwoDecimals(eoq);
}

/**
 * Simple pilot safety stock: 50% of lead-time demand.
 *
 * Future enhancement: when demandStdDev and serviceLevelZ are provided, use
 * safetyStock = serviceLevelZ * demandStdDev * sqrt(leadTimeDays) instead of
 * the simple buffer formula below.
 */
export function calculateSafetyStock(
  avgDailyDemand: number | null,
  leadTimeDays: number | null,
  demandStdDev?: number | null,
  serviceLevelZ?: number | null
): number | null {
  if (demandStdDev != null && serviceLevelZ != null && isPositiveNumber(leadTimeDays)) {
    return roundToTwoDecimals(
      serviceLevelZ * demandStdDev * Math.sqrt(leadTimeDays)
    );
  }

  if (!isPositiveNumber(avgDailyDemand) || !isPositiveNumber(leadTimeDays)) {
    return null;
  }

  return roundToTwoDecimals(avgDailyDemand * leadTimeDays * 0.5);
}

export function calculateROP(
  avgDailyDemand: number | null,
  leadTimeDays: number | null,
  safetyStock: number | null
): number | null {
  if (!isPositiveNumber(avgDailyDemand) || !isPositiveNumber(leadTimeDays)) {
    return null;
  }

  const stockComponent = isNonNegativeNumber(safetyStock) ? safetyStock : 0;
  return roundToTwoDecimals(avgDailyDemand * leadTimeDays + stockComponent);
}

export function hasMeaningfulSuggestedQtyBasis(
  input: Pick<
    SuggestedQtyInput,
    | "annualDemandUnits"
    | "orderingCostPerOrder"
    | "holdingCostPerUnitYear"
    | "reorderLevel"
    | "avgDailyDemandUnits"
    | "leadTimeDays"
  >
): boolean {
  const hasEoqInputs =
    isPositiveNumber(input.annualDemandUnits) &&
    isPositiveNumber(input.orderingCostPerOrder) &&
    isPositiveNumber(input.holdingCostPerUnitYear);

  const hasSaneReorderLevelWithDemand =
    isPositiveNumber(input.reorderLevel) &&
    input.reorderLevel < REORDER_LEVEL_SANITY_CAP &&
    isPositiveNumber(input.avgDailyDemandUnits);

  const hasLeadTimeCoverageInputs =
    isPositiveNumber(input.avgDailyDemandUnits) &&
    isPositiveNumber(input.leadTimeDays);

  return hasEoqInputs || hasSaneReorderLevelWithDemand || hasLeadTimeCoverageInputs;
}

function hasCalculableEoq(input: SuggestedQtyInput): boolean {
  return (
    input.eoq !== null &&
    input.eoq !== undefined &&
    input.eoq > 0 &&
    isPositiveNumber(input.annualDemandUnits) &&
    isPositiveNumber(input.orderingCostPerOrder) &&
    isPositiveNumber(input.holdingCostPerUnitYear)
  );
}

function hasSaneReorderLevelWithDemand(input: SuggestedQtyInput): boolean {
  return (
    isPositiveNumber(input.reorderLevel) &&
    input.reorderLevel < REORDER_LEVEL_SANITY_CAP &&
    isPositiveNumber(input.avgDailyDemandUnits)
  );
}

function hasLeadTimeCoverageInputs(input: SuggestedQtyInput): boolean {
  return (
    isPositiveNumber(input.avgDailyDemandUnits) &&
    isPositiveNumber(input.leadTimeDays)
  );
}

function resolveSuggestedQtyTarget(input: SuggestedQtyInput): {
  target: number | null;
  dataGaps: string[];
} {
  const dataGaps: string[] = [];

  if (hasCalculableEoq(input)) {
    return { target: input.eoq!, dataGaps };
  }

  if (hasSaneReorderLevelWithDemand(input)) {
    dataGaps.push("Using reorder_level as suggested quantity (EOQ unavailable)");
    return { target: input.reorderLevel!, dataGaps };
  }

  if (hasLeadTimeCoverageInputs(input)) {
    dataGaps.push(
      "Using lead-time coverage estimate (avg_daily_demand x lead_time x 1.5)"
    );
    return {
      target: roundToTwoDecimals(
        input.avgDailyDemandUnits! * input.leadTimeDays! * 1.5
      ),
      dataGaps,
    };
  }

  dataGaps.push(
    "Insufficient demand, cost, or lead time inputs to calculate a suggested quantity"
  );
  return { target: null, dataGaps };
}

function resolveReorderThreshold(input: SuggestedQtyInput): number | null {
  if (isPositiveNumber(input.rop)) {
    return input.rop;
  }

  if (hasSaneReorderLevelWithDemand(input)) {
    return input.reorderLevel!;
  }

  return null;
}

export function calculateSuggestedQty(
  input: SuggestedQtyInput
): { suggestedQty: number; dataGaps: string[] } {
  const { target, dataGaps } = resolveSuggestedQtyTarget(input);

  if (target === null || target <= 0) {
    return { suggestedQty: 0, dataGaps };
  }

  const effectiveStock =
    input.quantityAvailable + input.quantityOnOrder + input.quantityInPipeline;

  const reorderThreshold = resolveReorderThreshold(input);

  if (reorderThreshold !== null && effectiveStock >= reorderThreshold) {
    return { suggestedQty: 0, dataGaps };
  }

  return { suggestedQty: roundToTwoDecimals(target), dataGaps };
}

export function roundToPackSize(input: PackSizeInput): PackSizeResult {
  if (input.suggestedQty <= 0) {
    return { roundedQty: 0, roundingUnit: "unit" };
  }

  if (isPositiveNumber(input.containerQty)) {
    const multiples = Math.ceil(input.suggestedQty / input.containerQty);
    const roundedQty = multiples * input.containerQty;
    return {
      roundedQty,
      roundingUnit: "container",
      containerCount: multiples,
    };
  }

  if (isPositiveNumber(input.palletQty)) {
    const multiples = Math.ceil(input.suggestedQty / input.palletQty);
    const roundedQty = multiples * input.palletQty;
    return {
      roundedQty,
      roundingUnit: "pallet",
      palletCount: multiples,
    };
  }

  return {
    roundedQty: Math.ceil(input.suggestedQty),
    roundingUnit: "unit",
  };
}

export function hasReorderActivitySignals(
  input: Pick<
    ClassifyReorderStatusInput,
    | "annualDemandUnits"
    | "reorderLevel"
    | "quantityOnHand"
    | "quantityOnOrder"
    | "unitCost"
  >
): boolean {
  return (
    isPositiveNumber(input.annualDemandUnits) ||
    isPositiveNumber(input.reorderLevel) ||
    isPositiveNumber(input.quantityOnHand) ||
    isPositiveNumber(input.quantityOnOrder) ||
    isPositiveNumber(input.unitCost)
  );
}

export function classifyReorderStatus(
  input: ClassifyReorderStatusInput
): ReorderStatus {
  if (!hasReorderActivitySignals(input)) {
    return "inactive";
  }

  if (
    input.quantityAvailable <= 0 ||
    input.quantityAvailable + input.quantityOnOrder <= 0
  ) {
    return "critical";
  }

  if (input.suggestedQty > 0) {
    return "reorder";
  }

  return "ok";
}

function resolveLeadTimeDays(row: VwReorderInputsRow): {
  leadTimeDays: number | null;
  dataGaps: string[];
} {
  if (isPositiveNumber(row.lead_time_days)) {
    return { leadTimeDays: row.lead_time_days, dataGaps: [] };
  }

  return {
    leadTimeDays: null,
    dataGaps: ["No lead_time_days - ROP not calculated"],
  };
}

function resolveQuantityInPipeline(row: VwReorderInputsRow): number {
  const breakdown = parsePipelineBreakdown(
    row as unknown as Record<string, unknown>
  );

  return (
    breakdown.inTransit +
    breakdown.inBond +
    breakdown.atPort +
    breakdown.inClearing
  );
}

export function buildReorderRecommendation(
  row: VwReorderInputsRow
): ReorderRecommendation {
  const dataGaps: string[] = [];

  const quantityOnHand = row.quantity_on_hand ?? 0;
  const quantityAvailable = row.quantity_available ?? 0;
  const quantityOnOrder = row.quantity_on_order ?? 0;
  const pipelineBreakdown = parsePipelineBreakdown(
    row as unknown as Record<string, unknown>
  );
  const quantityInPipeline = resolveQuantityInPipeline(row);

  const { leadTimeDays, dataGaps: leadTimeGaps } = resolveLeadTimeDays(row);
  dataGaps.push(...leadTimeGaps);

  const eoq = calculateEOQ(
    row.annual_demand_units,
    row.ordering_cost_per_order,
    row.holding_cost_per_unit_year
  );

  if (eoq === null) {
    if (
      row.ordering_cost_per_order === null &&
      row.holding_cost_per_unit_year === null
    ) {
      dataGaps.push(
        "No ordering_cost_per_order or holding_cost_per_unit_year - EOQ not calculated"
      );
    } else if (
      row.annual_demand_units === null ||
      row.ordering_cost_per_order === null ||
      row.holding_cost_per_unit_year === null
    ) {
      dataGaps.push(
        "Missing EOQ inputs - EOQ not calculated"
      );
    } else if (
      (row.annual_demand_units ?? 0) <= 0 ||
      (row.ordering_cost_per_order ?? 0) <= 0 ||
      (row.holding_cost_per_unit_year ?? 0) <= 0
    ) {
      dataGaps.push(
        "Invalid EOQ inputs (zero or negative) - EOQ not calculated"
      );
    }
  }

  const safetyStock = calculateSafetyStock(
    row.avg_daily_demand_units,
    leadTimeDays
  );

  if (safetyStock === null && leadTimeDays !== null) {
    dataGaps.push("No avg_daily_demand_units - safety stock not calculated");
  }

  const rop = calculateROP(
    row.avg_daily_demand_units,
    leadTimeDays,
    safetyStock
  );

  const { suggestedQty: suggestedQtyRaw, dataGaps: suggestedQtyGaps } =
    calculateSuggestedQty({
      quantityAvailable,
      quantityOnOrder,
      quantityInPipeline,
      rop,
      reorderLevel: row.reorder_level,
      maximumStockLevel: row.maximum_stock_level,
      eoq,
      avgDailyDemandUnits: row.avg_daily_demand_units,
      leadTimeDays,
      orderingCostPerOrder: row.ordering_cost_per_order,
      holdingCostPerUnitYear: row.holding_cost_per_unit_year,
      annualDemandUnits: row.annual_demand_units,
    });
  dataGaps.push(...suggestedQtyGaps);

  const packSize = roundToPackSize({
    suggestedQty: suggestedQtyRaw,
    palletQty: row.pallet_qty,
    containerQty: row.container_qty,
  });

  const status = classifyReorderStatus({
    quantityAvailable,
    quantityOnOrder,
    quantityInPipeline,
    quantityOnHand,
    rop,
    reorderLevel: row.reorder_level,
    suggestedQty: suggestedQtyRaw,
    annualDemandUnits: row.annual_demand_units,
    unitCost: row.current_cost_local,
  });

  return {
    tenantId: row.tenant_id,
    sku: row.sku,
    name: row.name,
    itemClass: row.item_class,
    category: row.category,
    isActive: null,
    quantityOnHand,
    quantityAvailable,
    quantityOnOrder,
    quantityInPipeline,
    pipelineBreakdown,
    reorderLevel: row.reorder_level,
    maximumStockLevel: row.maximum_stock_level,
    annualDemandUnits: row.annual_demand_units,
    avgDailyDemandUnits: row.avg_daily_demand_units,
    unitCost: row.current_cost_local,
    supplierExternalId: row.best_supplier_external_id,
    vendorItemNumber: null,
    leadTimeDays,
    palletQty: row.pallet_qty,
    containerQty: row.container_qty,
    orderingCostPerOrder: row.ordering_cost_per_order,
    holdingCostPerUnitYear: row.holding_cost_per_unit_year,
    supplierUnitPrice: row.best_unit_price,
    supplierName: null,
    supplierLeadTimeDays: null,
    eoq,
    safetyStock,
    rop,
    suggestedQtyRaw,
    suggestedQtyRounded: packSize.roundedQty,
    roundingUnit: packSize.roundingUnit,
    containerCount: packSize.containerCount ?? null,
    palletCount: packSize.palletCount ?? null,
    status,
    dataGaps,
  };
}

export function formatRoundingInfo(rec: ReorderRecommendation): string {
  if (rec.suggestedQtyRounded <= 0) {
    return "-";
  }

  if (rec.roundingUnit === "container" && rec.containerCount) {
    const label = rec.containerCount === 1 ? "container" : "containers";
    return `${rec.containerCount} ${label}`;
  }

  if (rec.roundingUnit === "pallet" && rec.palletCount) {
    const label = rec.palletCount === 1 ? "pallet" : "pallets";
    return `${rec.palletCount} ${label}`;
  }

  return String(rec.suggestedQtyRounded);
}

/**
 * Template-based explanation for a reorder recommendation.
 * Replace this implementation with an AI call in a later prompt
 * while keeping the same function signature.
 */
export function generateBasicExplanation(rec: ReorderRecommendation): string {
  const ropText =
    rec.rop !== null ? rec.rop.toLocaleString("en-JM") : "unknown";
  const leadTimeText =
    rec.leadTimeDays !== null
      ? String(rec.leadTimeDays)
      : "unknown";

  return (
    `This item has ${rec.quantityAvailable.toLocaleString("en-JM")} units available ` +
    `against a reorder point of ${ropText}, with ${leadTimeText} days of lead time. ` +
    `Suggested order: ${rec.suggestedQtyRounded.toLocaleString("en-JM")} units.`
  );
}
