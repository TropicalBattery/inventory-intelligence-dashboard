import { parsePipelineBreakdown } from "@/lib/pipeline-breakdown";
import { computeMonthsOfCoverForClassification } from "@/lib/reorder/months-of-cover";
import {
  COVER_CRITICAL_MONTHS,
  COVER_OK_MONTHS,
  COVER_WATCH_MONTHS,
  DAYS_PER_MONTH,
  DEFAULT_REORDER_MONTHS,
  DIRTY_REORDER_LEVEL_SENTINEL,
  computeDefaultReorderLevel,
  resolveCoverBands,
  sanitizeReorderLevel,
  type CoverBands,
} from "@/lib/reorder/cover-thresholds";
import { isPurchaseBlockedRule } from "@/lib/reorder/purchase-rules-ui";
import type {
  ClassifyReorderStatusInput,
  PackSizeInput,
  PackSizeResult,
  ReorderRecommendation,
  ReorderStatus,
  SuggestedQtyInput,
  SuggestedQtyZeroReason,
  VwReorderInputsRow,
} from "@/lib/types";

/** Excludes GP ORDRPNTQTY bulk-set anomalies (e.g. 5,274) until source data is fixed. */
export const REORDER_LEVEL_SANITY_CAP = 1000;

export {
  COVER_CRITICAL_MONTHS,
  COVER_OK_MONTHS,
  COVER_WATCH_MONTHS,
  DAYS_PER_MONTH,
  DEFAULT_REORDER_MONTHS,
  DIRTY_REORDER_LEVEL_SENTINEL,
  computeDefaultReorderLevel,
  resolveCoverBands,
  sanitizeReorderLevel,
};

function isPositiveNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && value > 0;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Inventory turnover ≈ annualised units sold / average units held.
 * Without historical stock snapshots, approximate average inventory with
 * current on-hand (standard practical stand-in until FEAT-11 snapshots).
 */
export function computeTurnoverRatio(
  annualDemandUnits: number | null | undefined,
  quantityOnHand: number
): number | null {
  if (
    annualDemandUnits === null ||
    annualDemandUnits === undefined ||
    !(annualDemandUnits > 0) ||
    !(quantityOnHand > 0)
  ) {
    return null;
  }

  return roundToTwoDecimals(annualDemandUnits / quantityOnHand);
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

/** Lead time at or above this threshold uses months-of-demand safety stock. */
export const FOREIGN_SUPPLIER_LEAD_TIME_THRESHOLD_DAYS = 60;

/** Default months of demand held as safety stock for foreign suppliers. */
export const DEFAULT_SAFETY_STOCK_MONTHS = 3;

/**
 * Pilot safety stock:
 * - Foreign/overseas suppliers (lead time >= 60 days):
 *   avg_monthly_demand * safety_stock_months (default 3, configurable per supplier)
 * - Local suppliers (lead time < 60 days):
 *   50% of lead-time demand (avg_daily_demand * lead_time_days * 0.5)
 *
 * Future enhancement: when demandStdDev and serviceLevelZ are provided, use
 * safetyStock = serviceLevelZ * demandStdDev * sqrt(leadTimeDays) instead of
 * the simple buffer formula below.
 */
export function calculateSafetyStock(
  avgDailyDemand: number | null,
  leadTimeDays: number | null,
  demandStdDev?: number | null,
  serviceLevelZ?: number | null,
  safetyStockMonths?: number | null
): number | null {
  if (demandStdDev != null && serviceLevelZ != null && isPositiveNumber(leadTimeDays)) {
    return roundToTwoDecimals(
      serviceLevelZ * demandStdDev * Math.sqrt(leadTimeDays)
    );
  }

  if (!isPositiveNumber(avgDailyDemand) || !isPositiveNumber(leadTimeDays)) {
    return null;
  }

  if (leadTimeDays >= FOREIGN_SUPPLIER_LEAD_TIME_THRESHOLD_DAYS) {
    const months = isPositiveNumber(safetyStockMonths)
      ? safetyStockMonths
      : DEFAULT_SAFETY_STOCK_MONTHS;
    const avgMonthlyDemand = avgDailyDemand * DAYS_PER_MONTH;
    return roundToTwoDecimals(avgMonthlyDemand * months);
  }

  return roundToTwoDecimals(avgDailyDemand * leadTimeDays * 0.5);
}

export function calculateROP(
  avgDailyDemand: number | null,
  leadTimeDays: number | null
): number | null {
  if (!isPositiveNumber(avgDailyDemand) || !isPositiveNumber(leadTimeDays)) {
    return null;
  }

  return roundToTwoDecimals(avgDailyDemand * leadTimeDays);
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
    (isPositiveNumber(input.reorderLevel) &&
      input.reorderLevel < REORDER_LEVEL_SANITY_CAP &&
      isPositiveNumber(input.avgDailyDemandUnits)) ||
    (sanitizeReorderLevel(input.reorderLevel) === null &&
      isPositiveNumber(input.avgDailyDemandUnits));

  const hasLeadTimeCoverageInputs =
    isPositiveNumber(input.avgDailyDemandUnits) &&
    isPositiveNumber(input.leadTimeDays);

  return hasEoqInputs || hasSaneReorderLevelWithDemand || hasLeadTimeCoverageInputs;
}

function resolveEffectiveReorderLevel(input: SuggestedQtyInput): number | null {
  const sanitized = sanitizeReorderLevel(input.reorderLevel);

  if (sanitized !== null) {
    return sanitized;
  }

  if (isPositiveNumber(input.avgDailyDemandUnits)) {
    return roundToTwoDecimals(
      computeDefaultReorderLevel(input.avgDailyDemandUnits)
    );
  }

  return null;
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

function hasSaneReorderLevelWithDemand(
  input: SuggestedQtyInput,
  effectiveReorderLevel: number | null = input.reorderLevel
): boolean {
  if (
    !isPositiveNumber(effectiveReorderLevel) ||
    !isPositiveNumber(input.avgDailyDemandUnits)
  ) {
    return false;
  }

  // Sanity cap applies to GP-sourced levels only, not demand-derived defaults.
  const fromGp = sanitizeReorderLevel(input.reorderLevel) !== null;
  if (fromGp && effectiveReorderLevel >= REORDER_LEVEL_SANITY_CAP) {
    return false;
  }

  return true;
}

function hasLeadTimeCoverageInputs(input: SuggestedQtyInput): boolean {
  return (
    isPositiveNumber(input.avgDailyDemandUnits) &&
    isPositiveNumber(input.leadTimeDays)
  );
}

function resolveSuggestedQtyTarget(
  input: SuggestedQtyInput,
  effectiveReorderLevel: number | null
): {
  target: number | null;
  dataGaps: string[];
  /** Set only when target is null (no_demand / no_target). */
  zeroReason: SuggestedQtyZeroReason | null;
} {
  const dataGaps: string[] = [];

  if (hasCalculableEoq(input)) {
    return { target: input.eoq!, dataGaps, zeroReason: null };
  }

  if (hasSaneReorderLevelWithDemand(input, effectiveReorderLevel)) {
    const usedDefault =
      sanitizeReorderLevel(input.reorderLevel) === null &&
      effectiveReorderLevel !== null;
    dataGaps.push(
      usedDefault
        ? `Using default reorder level (${DEFAULT_REORDER_MONTHS} months of demand; EOQ unavailable)`
        : "Using reorder_level as suggested quantity (EOQ unavailable)"
    );
    return { target: effectiveReorderLevel!, dataGaps, zeroReason: null };
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
      zeroReason: null,
    };
  }

  const hasDemand =
    isPositiveNumber(input.annualDemandUnits) ||
    isPositiveNumber(input.avgDailyDemandUnits);

  dataGaps.push(
    hasDemand
      ? "Demand known but missing cost and lead time inputs - suggested quantity not calculated"
      : "No demand data - suggested quantity not calculated"
  );
  return {
    target: null,
    dataGaps,
    zeroReason: hasDemand ? "no_target" : "no_demand",
  };
}

function resolveReorderThreshold(
  input: SuggestedQtyInput,
  effectiveReorderLevel: number | null
): number | null {
  if (isPositiveNumber(input.rop)) {
    return input.rop;
  }

  if (hasSaneReorderLevelWithDemand(input, effectiveReorderLevel)) {
    return effectiveReorderLevel!;
  }

  return null;
}

export function calculateSuggestedQty(
  input: SuggestedQtyInput
): {
  suggestedQty: number;
  dataGaps: string[];
  suggestedQtyZeroReason: SuggestedQtyZeroReason | null;
} {
  const effectiveReorderLevel = resolveEffectiveReorderLevel(input);
  const { target, dataGaps, zeroReason } = resolveSuggestedQtyTarget(
    input,
    effectiveReorderLevel
  );

  if (target === null || target <= 0) {
    return {
      suggestedQty: 0,
      dataGaps,
      // target <= 0 with a non-null target is an edge case; only emit coded
      // reasons from the null-target branches (no_demand / no_target).
      suggestedQtyZeroReason: target === null ? zeroReason : null,
    };
  }

  const effectiveStock =
    input.quantityAvailable + input.quantityOnOrder + input.quantityInPipeline;

  const reorderThreshold = resolveReorderThreshold(
    input,
    effectiveReorderLevel
  );

  if (reorderThreshold !== null && effectiveStock >= reorderThreshold) {
    return {
      suggestedQty: 0,
      dataGaps,
      suggestedQtyZeroReason: "already_covered",
    };
  }

  return {
    suggestedQty: roundToTwoDecimals(target),
    dataGaps,
    suggestedQtyZeroReason: null,
  };
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
  input: ClassifyReorderStatusInput & {
    quantityAllocated?: number;
    avgDailyDemandUnits?: number | null;
    coverBands?: CoverBands;
  }
): ReorderStatus {
  const quantityAvailable = input.quantityAvailable;
  const annualDemandUnits = input.annualDemandUnits;
  const hasDemand = isPositiveNumber(annualDemandUnits);
  const bands = input.coverBands ?? resolveCoverBands(null);

  // No demand signal at all: not part of the active reorder workflow
  if (!hasDemand) {
    return "no_demand";
  }

  const quantityAllocated =
    input.quantityAllocated ??
    input.quantityOnHand - input.quantityAvailable;

  const monthsOfCover = computeMonthsOfCoverForClassification({
    quantityOnHand: input.quantityOnHand,
    quantityAllocated,
    quantityInPipeline: input.quantityInPipeline,
    annualDemandUnits,
    avgDailyDemandUnits: input.avgDailyDemandUnits ?? null,
  });

  // critical: out of stock OR under critical band
  if (
    quantityAvailable <= 0 ||
    monthsOfCover === null ||
    monthsOfCover < bands.criticalBelow
  ) {
    return "critical";
  }

  // watch: critical band to watch band
  if (monthsOfCover < bands.watchBelow) {
    return "watch";
  }

  // reorder_needed: watch band to ok band
  if (monthsOfCover < bands.okBelow) {
    return "reorder_needed";
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
  const quantityAllocated =
    row.quantity_allocated ?? quantityOnHand - quantityAvailable;
  const effectiveAvailable =
    row.effective_available ??
    quantityOnHand -
      quantityAllocated +
      (row.quantity_in_transit ?? 0) +
      (row.quantity_in_bond ?? 0) +
      (row.quantity_at_port ?? 0) +
      (row.quantity_in_clearing ?? 0);
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
    leadTimeDays,
    undefined,
    undefined,
    row.safety_stock_months
  );

  if (safetyStock === null && leadTimeDays !== null) {
    dataGaps.push("No avg_daily_demand_units - safety stock not calculated");
  }

  const rop = calculateROP(row.avg_daily_demand_units, leadTimeDays);
  const reorderLevel = sanitizeReorderLevel(row.reorder_level);

  const {
    suggestedQty: suggestedQtyRaw,
    dataGaps: suggestedQtyGaps,
    suggestedQtyZeroReason: calcZeroReason,
  } = calculateSuggestedQty({
    quantityAvailable: effectiveAvailable,
    quantityOnOrder,
    quantityInPipeline: 0,
    rop,
    reorderLevel,
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

  const effectiveLeadTimeDays = row.effective_lead_time_days ?? null;
  const coverBands = resolveCoverBands(effectiveLeadTimeDays);

  const status = classifyReorderStatus({
    quantityAvailable,
    quantityOnOrder,
    quantityInPipeline,
    quantityOnHand,
    quantityAllocated,
    rop,
    reorderLevel,
    suggestedQty: suggestedQtyRaw,
    annualDemandUnits: row.annual_demand_units,
    avgDailyDemandUnits: row.avg_daily_demand_units,
    unitCost: row.current_cost_local,
    coverBands,
  });

  const purchaseRule = row.purchase_rule;
  // blocked_rule takes precedence over calc reasons for display.
  const suggestedQtyZeroReason: SuggestedQtyZeroReason | null =
    isPurchaseBlockedRule(purchaseRule) ? "blocked_rule" : calcZeroReason;

  return {
    tenantId: row.tenant_id,
    sku: row.sku,
    name: row.name,
    itemClass: row.item_class,
    category: row.category,
    unitOfMeasure: row.unit_of_measure ?? null,
    isActive: null,
    isWhitelisted: row.is_whitelisted,
    buyerRank: row.buyer_rank,
    purchaseRule,
    quantityOnHand,
    quantityAvailable,
    quantityAllocated,
    effectiveAvailable,
    quantityOnOrder,
    quantityInPipeline,
    pipelineBreakdown,
    reorderLevel,
    maximumStockLevel: row.maximum_stock_level,
    annualDemandUnits: row.annual_demand_units,
    avgDailyDemandUnits: row.avg_daily_demand_units,
    rawAvgDailyDemandUnits: row.raw_avg_daily_demand_units ?? null,
    stockoutMonthsExcluded: row.stockout_months_excluded ?? null,
    abcClass: null,
    turnoverRatio: computeTurnoverRatio(
      row.annual_demand_units,
      quantityOnHand
    ),
    unitCost: row.current_cost_local,
    supplierExternalId: row.best_supplier_external_id,
    vendorItemNumber: null,
    leadTimeDays,
    effectiveLeadTimeDays,
    leadTimeSource: row.lead_time_source ?? null,
    effectiveLeadTimeSupplierExternalId:
      row.effective_lead_time_supplier_external_id ?? null,
    coverBands,
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
    suggestedQtyZeroReason,
    seasonality: row.seasonality ?? null,
    openPoQty: 0,
    openPoRefs: [],
    inbound: null,
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
