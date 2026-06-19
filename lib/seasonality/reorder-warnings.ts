import {
  daysUntilMonthStart,
  getBuildStockByMonthName,
  getMonthName,
  SEASONAL_LEAD_TIME_DAYS,
} from "@/lib/seasonality/analyze";
import type { ItemSeasonalityProfile, SeasonalReorderWarning } from "@/lib/seasonality/types";

export function getSeasonalReorderWarning(
  profile: ItemSeasonalityProfile | null | undefined,
  referenceDate = new Date()
): SeasonalReorderWarning | null {
  if (!profile || profile.peak_months.length === 0) {
    return null;
  }

  const currentMonth = referenceDate.getMonth() + 1;

  if (profile.peak_months.includes(currentMonth)) {
    return {
      kind: "peak_now",
      message: "Peak demand month. Consider increasing order quantity.",
    };
  }

  let nearestPeakMonth: number | null = null;
  let nearestDays: number | null = null;

  for (const peakMonth of profile.peak_months) {
    const daysUntil = daysUntilMonthStart(peakMonth, referenceDate);
    if (daysUntil <= 0 || daysUntil > SEASONAL_LEAD_TIME_DAYS) {
      continue;
    }

    if (nearestDays === null || daysUntil < nearestDays) {
      nearestDays = daysUntil;
      nearestPeakMonth = peakMonth;
    }
  }

  if (nearestPeakMonth === null) {
    return null;
  }

  return {
    kind: "peak_approaching",
    peakMonthName: getMonthName(nearestPeakMonth),
    message: `Seasonal peak in ${getMonthName(nearestPeakMonth)}. Order now to arrive in time.`,
  };
}

export function getUpcomingPeakCategories(
  categories: Array<{
    item_class: string;
    peak_months: number[];
    build_stock_by_month?: string;
  }>,
  referenceDate = new Date()
) {
  const currentMonth = referenceDate.getMonth() + 1;
  const upcoming = new Map<
    string,
    { itemClass: string; peakMonthName: string; buildStockByMonth: string }
  >();

  for (const category of categories) {
    for (const peakMonth of category.peak_months) {
      if (peakMonth === currentMonth) {
        continue;
      }

      const daysUntil = daysUntilMonthStart(peakMonth, referenceDate);
      if (daysUntil <= 0 || daysUntil > SEASONAL_LEAD_TIME_DAYS) {
        continue;
      }

      const key = `${category.item_class}-${peakMonth}`;
      upcoming.set(key, {
        itemClass: category.item_class,
        peakMonthName: getMonthName(peakMonth),
        buildStockByMonth:
          category.build_stock_by_month ?? getBuildStockByMonthName(peakMonth),
      });
    }
  }

  return Array.from(upcoming.values()).sort((left, right) =>
    left.peakMonthName.localeCompare(right.peakMonthName)
  );
}
