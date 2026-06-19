import type { SkuSeasonalityProfile } from "@/lib/seasonality/types";
import { NO_EM_DASH_INSTRUCTION } from "@/lib/ai/config";

export function buildSeasonalIntelligencePrompt(
  profiles: SkuSeasonalityProfile[]
): string {
  const payload = profiles.map((profile) => ({
    item_number: profile.sku,
    item_class: profile.item_class,
    months: profile.months.map((month) => ({
      month_num: month.month_num,
      month_name: month.month_name,
      avg_monthly_qty: month.avg_monthly_qty,
      seasonality_index: month.seasonality_index,
    })),
  }));

  return `You are an inventory analyst for Tropical Battery Company Limited in Jamaica.
Based on the following monthly demand patterns, identify:
1. Which product categories show clear seasonal patterns
2. What time of year each category peaks and why (e.g. hurricane season, back to school, Christmas, summer road trips)
3. How many weeks before peak month the company should start building stock given a 93-day lead time
4. Any demand spike patterns that appear demand-driven rather than seasonal (one-off spikes)

${NO_EM_DASH_INSTRUCTION}

Return JSON only:
{
  "seasonal_categories": [{ "item_class": string, "peak_months": number[], "reason": string, "build_stock_by_month": string, "strength": "high" | "moderate" | "flat" }],
  "spike_skus": [{ "item_number": string, "spike_month": string, "likely_reason": string }],
  "summary": string
}

Top seasonal SKUs:
${JSON.stringify(payload, null, 2)}`;
}
