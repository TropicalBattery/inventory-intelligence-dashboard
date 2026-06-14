import type {
  DetectMismatchInput,
  MismatchFlag,
  ReorderRecommendation,
  VelocityDiagnostic,
  VelocityTrend,
  VwSalesVelocityRow,
} from "@/lib/types";

export const ACCELERATING_TREND_THRESHOLD_PCT = 15;
export const DECELERATING_TREND_THRESHOLD_PCT = -15;
export const DEFAULT_LEAD_TIME_DAYS = 30;
export const LOW_DAYS_OF_COVER_THRESHOLD = 7;
export const INCOMING_STOCK_MONTHS_THRESHOLD = 2;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function classifyTrend(
  velocityTrendPct: number | null
): VelocityTrend {
  if (velocityTrendPct === null || velocityTrendPct === undefined) {
    return "unknown";
  }

  if (velocityTrendPct > ACCELERATING_TREND_THRESHOLD_PCT) {
    return "accelerating";
  }

  if (velocityTrendPct < DECELERATING_TREND_THRESHOLD_PCT) {
    return "decelerating";
  }

  return "stable";
}

export function calculateDaysOfCover(
  quantityAvailable: number,
  avgMonthlyLast3m: number
): number | null {
  const dailyRate = avgMonthlyLast3m / 30;

  if (dailyRate <= 0) {
    return null;
  }

  return roundToTwoDecimals(quantityAvailable / dailyRate);
}

export function projectStockoutDate(
  daysOfCover: number | null,
  referenceDate: Date = new Date()
): Date | null {
  if (daysOfCover === null || daysOfCover === undefined) {
    return null;
  }

  const stockoutDate = new Date(referenceDate);
  stockoutDate.setDate(stockoutDate.getDate() + Math.ceil(daysOfCover));
  return stockoutDate;
}

export function detectMismatch(input: DetectMismatchInput): MismatchFlag[] {
  const flags: MismatchFlag[] = [];
  const leadTimeDays = input.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const incomingTotal = input.quantityOnOrder + input.quantityInPipeline;

  // Accelerating demand with stock that will not last through replenishment lead time.
  if (
    input.velocityTrend === "accelerating" &&
    input.daysOfCover !== null &&
    input.daysOfCover < leadTimeDays
  ) {
    flags.push({
      type: "accelerating_insufficient_cover",
      severity: "high",
      message:
        "Selling faster than usual and current stock won't cover the lead time to replenish - risk of stockout before next delivery arrives.",
    });
  }

  // Accelerating demand with no replenishment already in motion.
  if (
    input.velocityTrend === "accelerating" &&
    input.quantityOnOrder === 0 &&
    input.quantityInPipeline === 0
  ) {
    flags.push({
      type: "accelerating_no_incoming_stock",
      severity: "medium",
      message:
        "Demand is increasing but nothing is currently on order or in transit.",
    });
  }

  // Slowing demand while a large inbound quantity is still expected.
  if (
    input.velocityTrend === "decelerating" &&
    incomingTotal > input.avgMonthlyLast3m * INCOMING_STOCK_MONTHS_THRESHOLD
  ) {
    flags.push({
      type: "decelerating_excess_incoming",
      severity: "medium",
      message:
        "Sales have slowed but a large quantity is still incoming - may lead to overstock and tied-up capital.",
    });
  }

  // Stock on hand with no recent sales activity.
  if (
    input.daysOfCover === null &&
    input.quantityAvailable > 0 &&
    input.unitsSoldLast30d === 0 &&
    input.unitsSold31To60d === 0
  ) {
    flags.push({
      type: "dead_or_slow_moving_stock",
      severity: "low",
      message:
        "No sales in the last 60 days despite stock on hand - possible dead/slow-moving stock.",
    });
  }

  // Very short remaining cover at the current sales pace.
  if (input.daysOfCover !== null && input.daysOfCover < LOW_DAYS_OF_COVER_THRESHOLD) {
    flags.push({
      type: "critical_days_of_cover",
      severity: "high",
      message: "Less than a week of stock remaining at current sales pace.",
    });
  }

  return flags;
}

export function buildVelocityDiagnostic(
  velocityRow: VwSalesVelocityRow,
  reorderRow: ReorderRecommendation,
  referenceDate: Date = new Date()
): VelocityDiagnostic {
  const trend = classifyTrend(velocityRow.velocity_trend_pct);
  const daysOfCover = calculateDaysOfCover(
    reorderRow.quantityAvailable,
    velocityRow.avg_monthly_last_3m
  );
  const projectedStockoutDate = projectStockoutDate(daysOfCover, referenceDate);

  const mismatchFlags = detectMismatch({
    velocityTrend: trend,
    daysOfCover,
    quantityAvailable: reorderRow.quantityAvailable,
    quantityOnOrder: reorderRow.quantityOnOrder,
    quantityInPipeline: reorderRow.quantityInPipeline,
    leadTimeDays: reorderRow.leadTimeDays,
    avgMonthlyLast3m: velocityRow.avg_monthly_last_3m,
    unitsSoldLast30d: velocityRow.units_sold_last_30d,
    unitsSold31To60d: velocityRow.units_sold_31_60d,
  });

  return {
    sku: velocityRow.sku,
    trend,
    daysOfCover,
    projectedStockoutDate,
    mismatchFlags,
    unitsSoldLast30d: velocityRow.units_sold_last_30d,
    unitsSold31To60d: velocityRow.units_sold_31_60d,
    unitsSold61To90d: velocityRow.units_sold_61_90d,
    avgMonthlyLast3m: velocityRow.avg_monthly_last_3m,
    avgMonthlyTrailing12m: velocityRow.avg_monthly_trailing_12m,
    velocityTrendPct: velocityRow.velocity_trend_pct,
    daysSinceLastSale: velocityRow.days_since_last_sale,
    lastSaleDate: velocityRow.last_sale_date,
  };
}
