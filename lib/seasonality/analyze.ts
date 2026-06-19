import type {
  MonthlyDemandRow,
  SeasonalityMonthProfile,
  SeasonalityStrength,
  SkuSeasonalityProfile,
} from "@/lib/seasonality/types";

export const SEASONALITY_HIGH_THRESHOLD = 1.4;
export const SEASONALITY_MODERATE_THRESHOLD = 1.2;
export const SEASONALITY_PEAK_MONTH_THRESHOLD = 1.2;
export const SEASONAL_LEAD_TIME_DAYS = 93;

const MONTH_NAMES = [
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

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMonthName(monthNum: number): string {
  return MONTH_NAMES[monthNum - 1] ?? "Unknown";
}

export function classifySeasonalityStrength(
  maxIndex: number
): SeasonalityStrength {
  if (maxIndex > SEASONALITY_HIGH_THRESHOLD) {
    return "high";
  }

  if (maxIndex > SEASONALITY_MODERATE_THRESHOLD) {
    return "moderate";
  }

  return "flat";
}

export function buildSkuSeasonalityProfiles(
  rows: MonthlyDemandRow[]
): SkuSeasonalityProfile[] {
  const rowsBySku = new Map<string, MonthlyDemandRow[]>();

  for (const row of rows) {
    const skuRows = rowsBySku.get(row.item_number) ?? [];
    skuRows.push(row);
    rowsBySku.set(row.item_number, skuRows);
  }

  const profiles: SkuSeasonalityProfile[] = [];

  for (const [sku, skuRows] of Array.from(rowsBySku.entries())) {
    const months = skuRows
      .map((row: MonthlyDemandRow) => ({
        month_num: row.month_num,
        month_name: row.month_name,
        avg_monthly_qty: toNumber(row.avg_monthly_qty),
        seasonality_index: toNumber(row.seasonality_index),
      }))
      .sort(
        (left: SeasonalityMonthProfile, right: SeasonalityMonthProfile) =>
          left.month_num - right.month_num
      );

    const maxIndex = months.reduce(
      (max: number, month: SeasonalityMonthProfile) =>
        Math.max(max, month.seasonality_index),
      0
    );
    const overallAvg =
      months.length > 0
        ? months.reduce(
            (sum: number, month: SeasonalityMonthProfile) =>
              sum + month.avg_monthly_qty,
            0
          ) / months.length
        : 0;
    const peakMonths = months
      .filter(
        (month: SeasonalityMonthProfile) =>
          month.seasonality_index > SEASONALITY_PEAK_MONTH_THRESHOLD
      )
      .map((month: SeasonalityMonthProfile) => month.month_num)
      .sort((left: number, right: number) => left - right);
    const firstRow = skuRows[0];

    profiles.push({
      sku,
      item_description: firstRow?.item_description ?? null,
      item_class: firstRow?.item_class ?? null,
      seasonality_strength: classifySeasonalityStrength(maxIndex),
      peak_months: peakMonths,
      max_seasonality_index: maxIndex,
      overall_avg_monthly_qty: overallAvg,
      months,
    });
  }

  return profiles;
}

export function pickTopSeasonalSkus(
  profiles: SkuSeasonalityProfile[],
  limit = 20
): SkuSeasonalityProfile[] {
  const strengthRank: Record<SeasonalityStrength, number> = {
    high: 0,
    moderate: 1,
    flat: 2,
  };

  return [...profiles]
    .filter((profile) => profile.seasonality_strength !== "flat")
    .sort((left, right) => {
      const strengthDiff =
        strengthRank[left.seasonality_strength] -
        strengthRank[right.seasonality_strength];
      if (strengthDiff !== 0) {
        return strengthDiff;
      }

      return right.max_seasonality_index - left.max_seasonality_index;
    })
    .slice(0, limit);
}

export function getBuildStockByMonthName(peakMonthNum: number): string {
  const referenceYear = new Date().getFullYear();
  const peakDate = new Date(referenceYear, peakMonthNum - 1, 15);
  const buildDate = new Date(peakDate);
  buildDate.setDate(buildDate.getDate() - SEASONAL_LEAD_TIME_DAYS);
  return getMonthName(buildDate.getMonth() + 1);
}

export function daysUntilMonthStart(
  monthNum: number,
  referenceDate = new Date()
): number {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  let targetYear = year;

  if (monthNum < month || (monthNum === month && referenceDate.getDate() > 1)) {
    targetYear += 1;
  }

  const target = new Date(targetYear, monthNum - 1, 1);
  const diffMs = target.getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / 86400000);
}

export function normalizeMonthlyDemandRows(
  rows: Array<Record<string, unknown>>
): MonthlyDemandRow[] {
  return rows
    .map((row) => ({
      item_number: String(row.item_number ?? ""),
      item_description:
        row.item_description === null || row.item_description === undefined
          ? null
          : String(row.item_description),
      item_class:
        row.item_class === null || row.item_class === undefined
          ? null
          : String(row.item_class),
      month_num: toNumber(row.month_num as number | string | null | undefined),
      month_name: String(row.month_name ?? ""),
      avg_monthly_qty: toNumber(
        row.avg_monthly_qty as number | string | null | undefined
      ),
      seasonality_index: toNumber(
        row.seasonality_index as number | string | null | undefined
      ),
    }))
    .filter((row) => row.item_number.length > 0 && row.month_num >= 1);
}
