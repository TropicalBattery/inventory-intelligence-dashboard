import {
  DAYS_PER_MONTH,
  DEMAND_ADJUSTMENT_DISPLAY_THRESHOLD,
  DEMAND_WINDOW_MONTHS,
  MIN_SELLING_MONTHS_FOR_ADJUSTED_DEMAND,
} from "@/lib/reorder/cover-thresholds";
import type { ReorderRecommendation, VwReorderInputsRow } from "@/lib/types";

export type MonthlySalesRow = {
  /** Calendar month start (ISO date or timestamp string from Postgres). */
  salesMonth: string;
  units: number;
};

export type AdjustedDemand = {
  avgDailyDemandUnits: number;
  annualDemandUnits: number;
  stockoutMonthsExcluded: number;
};

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Window covers the last windowMonths complete calendar months; the current
 * in-progress month is excluded.
 * E.g. July reference, 6 months -> Jan 1 (inclusive start).
 */
export function demandWindowStart(
  referenceDate: Date = new Date(),
  windowMonths: number = DEMAND_WINDOW_MONTHS
): Date {
  const start = startOfUtcMonth(referenceDate);
  start.setUTCMonth(start.getUTCMonth() - windowMonths);
  return start;
}

/**
 * Exclusive upper bound: start of the reference month (current in-progress
 * month is excluded). E.g. July 13 -> July 1.
 */
export function demandWindowEnd(referenceDate: Date = new Date()): Date {
  return startOfUtcMonth(referenceDate);
}

export function demandWindowStartIso(
  referenceDate: Date = new Date(),
  windowMonths: number = DEMAND_WINDOW_MONTHS
): string {
  return demandWindowStart(referenceDate, windowMonths)
    .toISOString()
    .slice(0, 10);
}

export function demandWindowEndIso(referenceDate: Date = new Date()): string {
  return demandWindowEnd(referenceDate).toISOString().slice(0, 10);
}

function parseSalesMonth(value: string): Date | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return startOfUtcMonth(new Date(parsed));
}

/**
 * Selling-months-only average daily demand within DEMAND_WINDOW_MONTHS
 * complete calendar months (current month excluded).
 * Returns null when fewer than MIN_SELLING_MONTHS_FOR_ADJUSTED_DEMAND
 * months have sales (caller keeps item_costing).
 */
export function computeAdjustedDemandFromMonthlySales(
  monthlyRows: ReadonlyArray<MonthlySalesRow>,
  options?: {
    windowMonths?: number;
    daysPerMonth?: number;
    minSellingMonths?: number;
    referenceDate?: Date;
  }
): AdjustedDemand | null {
  const windowMonths = options?.windowMonths ?? DEMAND_WINDOW_MONTHS;
  const daysPerMonth = options?.daysPerMonth ?? DAYS_PER_MONTH;
  const minSellingMonths =
    options?.minSellingMonths ?? MIN_SELLING_MONTHS_FOR_ADJUSTED_DEMAND;
  const referenceDate = options?.referenceDate ?? new Date();
  const windowStart = demandWindowStart(referenceDate, windowMonths);
  const windowEnd = demandWindowEnd(referenceDate);

  const sellingMonths = monthlyRows.filter((row) => {
    if (!(row.units > 0)) {
      return false;
    }

    const month = parseSalesMonth(row.salesMonth);
    if (!month) {
      return false;
    }

    const t = month.getTime();
    return t >= windowStart.getTime() && t < windowEnd.getTime();
  });

  if (sellingMonths.length < minSellingMonths) {
    return null;
  }

  const totalUnits = sellingMonths.reduce((sum, row) => sum + row.units, 0);
  const avgDailyDemandUnits = totalUnits / (sellingMonths.length * daysPerMonth);

  if (!Number.isFinite(avgDailyDemandUnits) || avgDailyDemandUnits <= 0) {
    return null;
  }

  return {
    avgDailyDemandUnits,
    annualDemandUnits: avgDailyDemandUnits * 365,
    stockoutMonthsExcluded: Math.max(0, windowMonths - sellingMonths.length),
  };
}

/**
 * When adjusted demand is available, override avg_daily and annual on the
 * input row so every downstream consumer sees consistent values.
 */
export function applyAdjustedDemandToRow(
  row: VwReorderInputsRow,
  monthlyRows: ReadonlyArray<MonthlySalesRow> | undefined,
  options?: { referenceDate?: Date }
): VwReorderInputsRow {
  const adjusted = monthlyRows
    ? computeAdjustedDemandFromMonthlySales(monthlyRows, {
        referenceDate: options?.referenceDate,
      })
    : null;

  if (!adjusted) {
    return {
      ...row,
      raw_avg_daily_demand_units: null,
      stockout_months_excluded: null,
    };
  }

  return {
    ...row,
    raw_avg_daily_demand_units: row.avg_daily_demand_units,
    stockout_months_excluded: adjusted.stockoutMonthsExcluded,
    avg_daily_demand_units: adjusted.avgDailyDemandUnits,
    annual_demand_units: adjusted.annualDemandUnits,
  };
}

export function shouldShowDemandAdjustmentNote(
  rec: Pick<
    ReorderRecommendation,
    | "avgDailyDemandUnits"
    | "rawAvgDailyDemandUnits"
    | "stockoutMonthsExcluded"
  >
): boolean {
  const adjusted = rec.avgDailyDemandUnits;
  const raw = rec.rawAvgDailyDemandUnits;
  const excluded = rec.stockoutMonthsExcluded;

  if (
    adjusted === null ||
    adjusted === undefined ||
    raw === null ||
    raw === undefined ||
    raw <= 0 ||
    excluded === null ||
    excluded === undefined ||
    excluded <= 0
  ) {
    return false;
  }

  const ratio = Math.abs(adjusted - raw) / raw;
  return ratio > DEMAND_ADJUSTMENT_DISPLAY_THRESHOLD;
}
