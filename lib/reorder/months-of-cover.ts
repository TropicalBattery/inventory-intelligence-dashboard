import { DAYS_PER_MONTH } from "@/lib/reorder-engine";
import type { ReorderRecommendation } from "@/lib/types";

export type MonthsOfCoverColorTier = "unknown" | "red" | "amber" | "green";

function isPositiveNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

export function resolveAvgMonthlyDemand(
  rec: Pick<
    ReorderRecommendation,
    "annualDemandUnits" | "avgDailyDemandUnits"
  >
): number | null {
  if (isPositiveNumber(rec.annualDemandUnits)) {
    return rec.annualDemandUnits / 12;
  }

  if (isPositiveNumber(rec.avgDailyDemandUnits)) {
    return rec.avgDailyDemandUnits * DAYS_PER_MONTH;
  }

  return null;
}

export function computeMonthsOfCoverAtOrderQty(
  rec: Pick<
    ReorderRecommendation,
    | "quantityOnHand"
    | "quantityAllocated"
    | "quantityInPipeline"
    | "annualDemandUnits"
    | "avgDailyDemandUnits"
  >,
  orderQty: number
): number | null {
  const avgMonthlyDemand = resolveAvgMonthlyDemand(rec);
  if (!isPositiveNumber(avgMonthlyDemand) || orderQty < 0) {
    return null;
  }

  const stockPosition =
    rec.quantityOnHand - rec.quantityAllocated + rec.quantityInPipeline + orderQty;
  const months = stockPosition / avgMonthlyDemand;

  return Number.isFinite(months) ? months : null;
}

export function computeCurrentMonthsOfCover(
  rec: Parameters<typeof computeMonthsOfCoverAtOrderQty>[0]
): number | null {
  return computeMonthsOfCoverAtOrderQty(rec, 0);
}

export function computeProjectedMonthsOfCover(
  rec: Parameters<typeof computeMonthsOfCoverAtOrderQty>[0] & {
    suggestedQtyRounded: number;
  }
): number | null {
  return computeMonthsOfCoverAtOrderQty(rec, rec.suggestedQtyRounded);
}

export function formatMonthsOfCoverLabel(months: number | null): string {
  if (months === null || !Number.isFinite(months)) {
    return "Unknown";
  }

  return `${months.toFixed(1)} months`;
}

export function formatMonthsOfCoverShort(months: number | null): string {
  if (months === null || !Number.isFinite(months)) {
    return "Unknown";
  }

  return `${months.toFixed(1)} mo`;
}

export function getMonthsOfCoverColorTier(
  months: number | null
): MonthsOfCoverColorTier {
  if (months === null || !Number.isFinite(months)) {
    return "unknown";
  }

  if (months < 2) {
    return "red";
  }

  if (months < 4) {
    return "amber";
  }

  return "green";
}

export function getMonthsOfCoverTextClasses(tier: MonthsOfCoverColorTier): string {
  switch (tier) {
    case "red":
      return "text-[#CC2B2B]";
    case "amber":
      return "text-[#B45309]";
    case "green":
      return "text-[#16A34A]";
    default:
      return "text-[#9CA3AF]";
  }
}

export function getMonthsOfCoverBadgeClasses(tier: MonthsOfCoverColorTier): string {
  switch (tier) {
    case "red":
      return "border-[#FCA5A5] bg-[#FDF2F2] text-[#CC2B2B]";
    case "amber":
      return "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]";
    case "green":
      return "border-[#86EFAC] bg-[#F0FDF4] text-[#16A34A]";
    default:
      return "border-[#E5E7EB] bg-[#F3F4F6] text-[#9CA3AF]";
  }
}
