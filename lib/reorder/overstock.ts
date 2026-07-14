import { OVERSTOCK_MONTHS } from "@/lib/reorder/cover-thresholds";
import {
  computeCurrentMonthsOfCover,
  resolveAvgMonthlyDemand,
} from "@/lib/reorder/months-of-cover";
import type { ReorderRecommendation } from "@/lib/types";

export type OverstockMetrics = {
  monthsOfCover: number;
  avgMonthlyDemand: number;
  stockPosition: number;
  excessUnits: number;
  excessValue: number | null;
};

function isPositiveNumber(value: number | null | undefined): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value > 0
  );
}

export function computeStockPosition(
  rec: Pick<
    ReorderRecommendation,
    "quantityOnHand" | "quantityAllocated" | "quantityInPipeline"
  >
): number {
  return (
    rec.quantityOnHand - rec.quantityAllocated + rec.quantityInPipeline
  );
}

/**
 * Units held above OVERSTOCK_MONTHS of average monthly demand
 * at the same stock position used for months-of-cover.
 */
export function computeExcessUnits(
  rec: Pick<
    ReorderRecommendation,
    | "quantityOnHand"
    | "quantityAllocated"
    | "quantityInPipeline"
    | "annualDemandUnits"
    | "avgDailyDemandUnits"
  >,
  overstockMonths: number = OVERSTOCK_MONTHS
): number | null {
  const avgMonthlyDemand = resolveAvgMonthlyDemand(rec);
  if (!isPositiveNumber(avgMonthlyDemand)) {
    return null;
  }

  const position = computeStockPosition(rec);
  return Math.max(0, position - avgMonthlyDemand * overstockMonths);
}

export function computeExcessValue(
  excessUnits: number | null,
  unitCost: number | null | undefined
): number | null {
  if (
    excessUnits === null ||
    !Number.isFinite(excessUnits) ||
    !isPositiveNumber(unitCost)
  ) {
    return null;
  }

  const value = excessUnits * unitCost;
  return Number.isFinite(value) ? value : null;
}

export function getOverstockMetrics(
  rec: ReorderRecommendation
): OverstockMetrics | null {
  const monthsOfCover = computeCurrentMonthsOfCover(rec);
  const avgMonthlyDemand = resolveAvgMonthlyDemand(rec);

  if (
    monthsOfCover === null ||
    !isPositiveNumber(avgMonthlyDemand) ||
    !(monthsOfCover > OVERSTOCK_MONTHS)
  ) {
    return null;
  }

  const excessUnits = computeExcessUnits(rec);
  if (excessUnits === null) {
    return null;
  }

  return {
    monthsOfCover,
    avgMonthlyDemand,
    stockPosition: computeStockPosition(rec),
    excessUnits,
    excessValue: computeExcessValue(excessUnits, rec.unitCost),
  };
}

export function isOverstockRecommendation(
  rec: ReorderRecommendation
): boolean {
  if (rec.status === "no_demand") {
    return false;
  }

  return getOverstockMetrics(rec) !== null;
}

export function selectOverstockRecommendations(
  recommendations: ReorderRecommendation[]
): ReorderRecommendation[] {
  return recommendations.filter(isOverstockRecommendation);
}

export function summarizeOverstock(
  recommendations: ReorderRecommendation[]
): {
  itemCount: number;
  totalExcessValue: number;
  aClassCount: number;
  hasAbcData: boolean;
} {
  let totalExcessValue = 0;
  let aClassCount = 0;
  let hasAbcData = false;

  for (const rec of recommendations) {
    const metrics = getOverstockMetrics(rec);
    if (!metrics) {
      continue;
    }

    if (metrics.excessValue !== null) {
      totalExcessValue += metrics.excessValue;
    }

    if (rec.abcClass !== null && rec.abcClass !== undefined) {
      hasAbcData = true;
      if (rec.abcClass === "A") {
        aClassCount += 1;
      }
    }
  }

  return {
    itemCount: recommendations.length,
    totalExcessValue,
    aClassCount,
    hasAbcData,
  };
}

export function sortOverstockByExcessValueDesc(
  recommendations: ReorderRecommendation[]
): ReorderRecommendation[] {
  return [...recommendations].sort((left, right) => {
    const leftValue = getOverstockMetrics(left)?.excessValue ?? -1;
    const rightValue = getOverstockMetrics(right)?.excessValue ?? -1;
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }

    return left.sku.localeCompare(right.sku);
  });
}
