import { getMonthName } from "@/lib/seasonality/analyze";
import type { SeasonalCategoryInsight } from "@/lib/seasonality/types";

export type DemandDriverId =
  | "hurricane"
  | "summer"
  | "christmas"
  | "post_storm";

export type DemandDriver = {
  id: DemandDriverId;
  emoji: string;
  title: string;
  categories: SeasonalCategoryInsight[];
};

const DEMAND_DRIVER_DEFINITIONS: Array<{
  id: DemandDriverId;
  emoji: string;
  title: string;
  matches: (category: SeasonalCategoryInsight) => boolean;
  orderHint: string;
}> = [
  {
    id: "hurricane",
    emoji: "🌀",
    title: "Hurricane season (Jun-Nov)",
    matches: (category) =>
      category.peak_months.some(
        (peakMonth) => peakMonth >= 6 && peakMonth <= 11
      ),
    orderHint: "Order at least one quarter ahead before storm season ramps up.",
  },
  {
    id: "summer",
    emoji: "🏍️",
    title: "Summer / boating (Jul-Aug)",
    matches: (category) =>
      category.item_class === "BAT-MAC" || category.item_class === "BAT-MC",
    orderHint: "Place overseas orders by April to cover July and August peaks.",
  },
  {
    id: "christmas",
    emoji: "🎄",
    title: "Christmas period (Nov-Dec)",
    matches: (category) =>
      category.peak_months.some(
        (peakMonth) => peakMonth === 11 || peakMonth === 12
      ),
    orderHint: "Build stock by August for November and December retail demand.",
  },
  {
    id: "post_storm",
    emoji: "⛈️",
    title: "Post-storm recovery (Sep-Oct)",
    matches: (category) =>
      category.item_class === "BATT-SOLAR" ||
      category.item_class === "BATT-COMM",
    orderHint: "Order by June for September and October recovery spikes.",
  },
];

function formatMonthList(months: number[]): string {
  const uniqueMonths = Array.from(new Set(months)).sort(
    (left, right) => left - right
  );

  if (uniqueMonths.length === 0) {
    return "no mapped peaks";
  }

  return uniqueMonths.map(getMonthName).join(", ");
}

export function buildDemandDrivers(
  categories: SeasonalCategoryInsight[]
): DemandDriver[] {
  return DEMAND_DRIVER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    emoji: definition.emoji,
    title: definition.title,
    categories: categories.filter(definition.matches),
  }));
}

export function buildDemandDriverDescription(
  driver: DemandDriver,
  orderHint: string
): string {
  if (driver.categories.length === 0) {
    return "No matching categories identified in the latest analysis.";
  }

  const categoryNames = driver.categories
    .map((category) => category.item_class)
    .join(", ");
  const peakMonths = driver.categories.flatMap((category) => category.peak_months);

  return `${categoryNames} affected. Peaks in ${formatMonthList(peakMonths)}. ${orderHint}`;
}

export function getDemandDriverOrderHint(driverId: DemandDriverId): string {
  return (
    DEMAND_DRIVER_DEFINITIONS.find((definition) => definition.id === driverId)
      ?.orderHint ?? "Plan orders a full quarter ahead of peak demand."
  );
}
