/**
 * v1 SKU seasonality from ~13 months of calendar aggregates.
 *
 * Honest limitation: with roughly one year of history a "peak" observed once
 * cannot be distinguished from a one-off spike (e.g. a hurricane restock).
 * UI/AI wording should say items "peaked" in those months, not that they
 * peak every year. Confidence improves as more years accumulate.
 */

import {
  demandWindowEnd,
  type MonthlySalesRow,
} from "@/lib/reorder/demand";
import type { SeasonalityResult, VwReorderInputsRow } from "@/lib/types";

export type { SeasonalityResult };

/** Peak candidate if month avg >= this × overall selling-month average. */
export const PEAK_MULTIPLIER = 1.4;

/** Minimum distinct complete calendar months required before classifying. */
export const MIN_HISTORY_MONTHS = 12;

/** Minimum months with units > 0 (selling months) required. */
export const MIN_SELLING_MONTHS = 8;

/** More than this many peak months is treated as noise, not seasonality. */
export const MAX_PEAK_MONTHS = 4;

/** Peak months must form at most this many contiguous runs on the calendar circle. */
export const MAX_CONTIGUOUS_RUNS = 2;

/** Overstock nuance: peak months within this many months ahead count as approaching. */
export const PEAK_APPROACHING_MONTHS = 2;

const MONTH_ABBREV = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type SeasonalityMonthInput = {
  salesMonth: Date;
  units: number;
};

const NOT_SEASONAL = (
  historyMonths: number
): SeasonalityResult => ({
  isSeasonal: false,
  peakMonths: [],
  peakLabel: null,
  strength: null,
  historyMonths,
});

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function calendarMonth(date: Date): number {
  return date.getUTCMonth() + 1;
}

function monthAbbrev(month: number): string {
  return MONTH_ABBREV[month - 1] ?? String(month);
}

/**
 * Contiguous runs on the calendar circle (Nov–Dec–Jan = one run).
 * Peak months must already be unique values in 1..12.
 */
export function contiguousRuns(peakMonths: number[]): number[][] {
  const unique = Array.from(
    new Set(peakMonths.filter((m) => m >= 1 && m <= 12))
  ).sort((a, b) => a - b);
  if (unique.length === 0) {
    return [];
  }

  const set = new Set(unique);
  if (set.size === 12) {
    return [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]];
  }

  const starts = unique.filter((m) => {
    const prev = m === 1 ? 12 : m - 1;
    return !set.has(prev);
  });

  return starts.map((start) => {
    const run: number[] = [start];
    let cur = start;
    while (run.length < 12) {
      const next = cur === 12 ? 1 : cur + 1;
      if (!set.has(next)) {
        break;
      }
      run.push(next);
      cur = next;
    }
    return run;
  });
}

export function formatPeakLabel(peakMonths: number[]): string | null {
  const runs = contiguousRuns(peakMonths);
  if (runs.length === 0) {
    return null;
  }

  return runs
    .map((run) => {
      if (run.length === 1) {
        return monthAbbrev(run[0]!);
      }
      return `${monthAbbrev(run[0]!)}-${monthAbbrev(run[run.length - 1]!)}`;
    })
    .join(", ");
}

/**
 * Detect seasonal peak months from monthly unit sales.
 * Excludes the current incomplete calendar month (same window-end as demand.ts).
 */
export function detectSeasonality(
  monthlyRows: ReadonlyArray<SeasonalityMonthInput>,
  referenceDate: Date = new Date()
): SeasonalityResult {
  const windowEnd = demandWindowEnd(referenceDate);

  const completeMonths = monthlyRows
    .map((row) => {
      const month = startOfUtcMonth(row.salesMonth);
      return {
        month,
        units: Number.isFinite(row.units) ? row.units : 0,
      };
    })
    .filter((row) => row.month.getTime() < windowEnd.getTime());

  // Deduplicate by month-start (keep max units if duplicates).
  const byMonthStart = new Map<number, number>();
  for (const row of completeMonths) {
    const key = row.month.getTime();
    const prev = byMonthStart.get(key);
    if (prev === undefined || row.units > prev) {
      byMonthStart.set(key, row.units);
    }
  }

  const historyMonths = byMonthStart.size;
  if (historyMonths < MIN_HISTORY_MONTHS) {
    return NOT_SEASONAL(historyMonths);
  }

  const monthEntries = Array.from(byMonthStart.entries()).map(([t, units]) => ({
    month: new Date(t),
    units,
  }));

  const selling = monthEntries.filter((row) => row.units > 0);
  if (selling.length < MIN_SELLING_MONTHS) {
    return NOT_SEASONAL(historyMonths);
  }

  const overallAvg =
    selling.reduce((sum, row) => sum + row.units, 0) / selling.length;
  if (!(overallAvg > 0)) {
    return NOT_SEASONAL(historyMonths);
  }

  // Average units by calendar month (1-12) across available years.
  const byCalMonth = new Map<number, { sum: number; count: number }>();
  for (const row of monthEntries) {
    const m = calendarMonth(row.month);
    const entry = byCalMonth.get(m) ?? { sum: 0, count: 0 };
    entry.sum += row.units;
    entry.count += 1;
    byCalMonth.set(m, entry);
  }

  const peakCandidates: number[] = [];
  const peakAvgs: number[] = [];
  byCalMonth.forEach(({ sum, count }, month) => {
    const avg = sum / count;
    if (avg >= PEAK_MULTIPLIER * overallAvg) {
      peakCandidates.push(month);
      peakAvgs.push(avg);
    }
  });

  peakCandidates.sort((a, b) => a - b);

  if (
    peakCandidates.length < 1 ||
    peakCandidates.length > MAX_PEAK_MONTHS
  ) {
    return NOT_SEASONAL(historyMonths);
  }

  const runs = contiguousRuns(peakCandidates);
  if (runs.length === 0 || runs.length > MAX_CONTIGUOUS_RUNS) {
    return NOT_SEASONAL(historyMonths);
  }

  const peakMean =
    peakAvgs.reduce((sum, v) => sum + v, 0) / peakAvgs.length;
  const strength =
    Math.round((peakMean / overallAvg) * 10) / 10;

  return {
    isSeasonal: true,
    peakMonths: peakCandidates,
    peakLabel: formatPeakLabel(peakCandidates),
    strength,
    historyMonths,
  };
}

/** True when any peak month falls in the next `withinMonths` calendar months. */
export function isPeakApproaching(
  result: Pick<SeasonalityResult, "isSeasonal" | "peakMonths">,
  referenceDate: Date = new Date(),
  withinMonths: number = PEAK_APPROACHING_MONTHS
): boolean {
  if (!result.isSeasonal || result.peakMonths.length === 0) {
    return false;
  }

  const current = calendarMonth(referenceDate);
  const upcoming = new Set<number>();
  for (let i = 1; i <= withinMonths; i += 1) {
    const m = ((current - 1 + i) % 12) + 1;
    upcoming.add(m);
  }

  return result.peakMonths.some((m) => upcoming.has(m));
}

function toSeasonalityInputs(
  monthlyRows: ReadonlyArray<MonthlySalesRow>
): SeasonalityMonthInput[] {
  const inputs: SeasonalityMonthInput[] = [];
  for (const row of monthlyRows) {
    const parsed = Date.parse(row.salesMonth);
    if (Number.isNaN(parsed)) {
      continue;
    }
    inputs.push({
      salesMonth: startOfUtcMonth(new Date(parsed)),
      units: row.units,
    });
  }
  return inputs;
}

/**
 * Attach seasonality from the shared monthly-sales fetch (demand already applied).
 */
export function attachSeasonalityToRow(
  row: VwReorderInputsRow,
  monthlyRows: ReadonlyArray<MonthlySalesRow> | undefined,
  options?: { referenceDate?: Date }
): VwReorderInputsRow {
  if (!monthlyRows || monthlyRows.length === 0) {
    return { ...row, seasonality: null };
  }

  const inputs = toSeasonalityInputs(monthlyRows);
  if (inputs.length === 0) {
    return { ...row, seasonality: null };
  }

  return {
    ...row,
    seasonality: detectSeasonality(
      inputs,
      options?.referenceDate ?? new Date()
    ),
  };
}
