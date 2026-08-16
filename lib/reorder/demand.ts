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

function monthKey(month: Date): string {
  return `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addUtcMonths(month: Date, delta: number): Date {
  return new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1)
  );
}

/**
 * Average units per completed month over the last `windowMonths` complete
 * calendar months (current partial month excluded).
 *
 * Denominator is LEAST(windowMonths, months in the SKU's active span inside
 * the window). Active span starts at the SKU's first observed sales month;
 * months before that are excluded. Zero-sale months inside the active span
 * still count (sum 0, still in the denominator). Rounded to 1 decimal.
 * Returns null when the SKU has no monthly history in/before the window.
 */
export function computeAvgMonthlyMovement(
  monthlyRows: ReadonlyArray<MonthlySalesRow>,
  options?: {
    windowMonths?: number;
    referenceDate?: Date;
  }
): number | null {
  const windowMonths = options?.windowMonths ?? 6;
  const referenceDate = options?.referenceDate ?? new Date();
  const windowStart = demandWindowStart(referenceDate, windowMonths);
  const windowEnd = demandWindowEnd(referenceDate);

  const unitsByMonth = new Map<string, number>();
  let firstSaleMonth: Date | null = null;

  for (const row of monthlyRows) {
    const month = parseSalesMonth(row.salesMonth);
    if (!month) {
      continue;
    }

    const key = monthKey(month);
    unitsByMonth.set(key, (unitsByMonth.get(key) ?? 0) + row.units);

    if (!firstSaleMonth || month.getTime() < firstSaleMonth.getTime()) {
      firstSaleMonth = month;
    }
  }

  if (!firstSaleMonth) {
    return null;
  }

  const activeStart =
    firstSaleMonth.getTime() > windowStart.getTime()
      ? firstSaleMonth
      : windowStart;

  if (activeStart.getTime() >= windowEnd.getTime()) {
    return null;
  }

  let sum = 0;
  let monthsOfDataAvailable = 0;
  for (
    let cursor = activeStart;
    cursor.getTime() < windowEnd.getTime();
    cursor = addUtcMonths(cursor, 1)
  ) {
    sum += unitsByMonth.get(monthKey(cursor)) ?? 0;
    monthsOfDataAvailable += 1;
  }

  if (monthsOfDataAvailable === 0) {
    return null;
  }

  const denominator = Math.min(windowMonths, monthsOfDataAvailable);
  return Math.round((sum / denominator) * 10) / 10;
}

/**
 * Attach 6/12-month average monthly movement from the shared monthly-sales fetch.
 */
export function attachAvgMonthlyMovementToRow(
  row: VwReorderInputsRow,
  monthlyRows: ReadonlyArray<MonthlySalesRow> | undefined,
  options?: { referenceDate?: Date }
): VwReorderInputsRow {
  if (!monthlyRows || monthlyRows.length === 0) {
    return {
      ...row,
      avg_units_6mo: null,
      avg_units_12mo: null,
    };
  }

  return {
    ...row,
    avg_units_6mo: computeAvgMonthlyMovement(monthlyRows, {
      windowMonths: 6,
      referenceDate: options?.referenceDate,
    }),
    avg_units_12mo: computeAvgMonthlyMovement(monthlyRows, {
      windowMonths: 12,
      referenceDate: options?.referenceDate,
    }),
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
