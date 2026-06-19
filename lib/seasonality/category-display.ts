import { daysUntilMonthStart, getMonthName } from "@/lib/seasonality/analyze";
import type {
  SeasonalCategoryInsight,
  SeasonalityStrength,
} from "@/lib/seasonality/types";

export const MONTH_ABBREVIATIONS = [
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

export const DEFAULT_VISIBLE_CATEGORY_COUNT = 3;

export const ORDER_WINDOW_LEAD_MONTHS = 3;

export function getOrderWindowMonth(peakMonth: number): number {
  let month = peakMonth - ORDER_WINDOW_LEAD_MONTHS;

  while (month <= 0) {
    month += 12;
  }

  return month;
}

export function getOrderWindowMonths(peakMonths: number[]): number[] {
  return Array.from(new Set(peakMonths.map(getOrderWindowMonth))).sort(
    (left, right) => left - right
  );
}

export function getCategoryUrgencyRank(
  category: SeasonalCategoryInsight,
  referenceDate = new Date()
): number {
  const currentMonth = referenceDate.getMonth() + 1;

  if (category.peak_months.includes(currentMonth)) {
    return 0;
  }

  if (getOrderWindowMonths(category.peak_months).includes(currentMonth)) {
    return 1;
  }

  return 2;
}

export function sortSeasonalCategories(
  categories: SeasonalCategoryInsight[],
  referenceDate = new Date()
): SeasonalCategoryInsight[] {
  const strengthRank: Record<SeasonalityStrength, number> = {
    high: 0,
    moderate: 1,
    flat: 2,
  };

  return [...categories]
    .filter(
      (category) =>
        category.strength === "high" || category.strength === "moderate"
    )
    .sort((left, right) => {
      const urgencyDiff =
        getCategoryUrgencyRank(left, referenceDate) -
        getCategoryUrgencyRank(right, referenceDate);
      if (urgencyDiff !== 0) {
        return urgencyDiff;
      }

      const strengthDiff =
        strengthRank[left.strength] - strengthRank[right.strength];
      if (strengthDiff !== 0) {
        return strengthDiff;
      }

      return left.item_class.localeCompare(right.item_class);
    });
}

export function formatCategorySubtitle(category: SeasonalCategoryInsight): string {
  const peaks = category.peak_months.map(getMonthName).join(", ");
  return peaks ? `Peak months: ${peaks}` : "Seasonal demand pattern";
}

export type CategoryActionState =
  | { kind: "peak_now" }
  | {
      kind: "order_window_open";
      peakMonth: number;
      orderWindowEndDate: Date;
    }
  | { kind: "upcoming"; orderWindowMonth: number; peakMonth: number };

export function getMonthEndDate(
  monthNum: number,
  referenceDate = new Date()
): Date {
  const currentMonth = referenceDate.getMonth() + 1;
  let year = referenceDate.getFullYear();

  if (monthNum < currentMonth) {
    year += 1;
  }

  return new Date(year, monthNum, 0);
}

export function formatActionDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export function getCategoryActionState(
  category: SeasonalCategoryInsight,
  referenceDate = new Date()
): CategoryActionState {
  const currentMonth = referenceDate.getMonth() + 1;
  const orderWindows = category.peak_months.map((peakMonth) => ({
    peakMonth,
    orderWindowMonth: getOrderWindowMonth(peakMonth),
  }));

  if (category.peak_months.includes(currentMonth)) {
    return { kind: "peak_now" };
  }

  const openWindow = orderWindows.find(
    (entry) => entry.orderWindowMonth === currentMonth
  );
  if (openWindow) {
    return {
      kind: "order_window_open",
      peakMonth: openWindow.peakMonth,
      orderWindowEndDate: getMonthEndDate(currentMonth, referenceDate),
    };
  }

  let nearest: {
    orderWindowMonth: number;
    peakMonth: number;
    daysUntil: number;
  } | null = null;

  for (const entry of orderWindows) {
    const daysUntil = daysUntilMonthStart(
      entry.orderWindowMonth,
      referenceDate
    );
    if (daysUntil <= 0) {
      continue;
    }

    if (
      !nearest ||
      daysUntil < nearest.daysUntil ||
      (daysUntil === nearest.daysUntil &&
        entry.peakMonth < nearest.peakMonth)
    ) {
      nearest = {
        orderWindowMonth: entry.orderWindowMonth,
        peakMonth: entry.peakMonth,
        daysUntil,
      };
    }
  }

  if (nearest) {
    return {
      kind: "upcoming",
      orderWindowMonth: nearest.orderWindowMonth,
      peakMonth: nearest.peakMonth,
    };
  }

  const fallback = orderWindows[0];
  return {
    kind: "upcoming",
    orderWindowMonth: fallback?.orderWindowMonth ?? currentMonth,
    peakMonth: fallback?.peakMonth ?? currentMonth,
  };
}

export function getCategoryActionText(state: CategoryActionState): string {
  switch (state.kind) {
    case "peak_now":
      return "Currently in peak month. Check stock levels immediately. Consider emergency local sourcing if overseas lead time has passed.";
    case "order_window_open":
      return `Order window open for ${getMonthName(state.peakMonth)} peak. Place orders by ${formatActionDate(state.orderWindowEndDate)} to arrive in time.`;
    case "upcoming":
      return `Next order window opens ${getMonthName(state.orderWindowMonth)} for ${getMonthName(state.peakMonth)} peak.`;
  }
}

export function getCategoryActionIconClass(
  state: CategoryActionState
): string {
  switch (state.kind) {
    case "peak_now":
      return "ti-alert-triangle text-[#A32D2D]";
    case "order_window_open":
      return "ti-calendar-due text-[#4F46E5]";
    case "upcoming":
      return "ti-clock text-[var(--color-text-secondary)]";
  }
}
