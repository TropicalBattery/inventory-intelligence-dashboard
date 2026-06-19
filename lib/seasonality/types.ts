export type SeasonalityStrength = "high" | "moderate" | "flat";

export type MonthlyDemandRow = {
  item_number: string;
  item_description: string | null;
  item_class: string | null;
  month_num: number;
  month_name: string;
  avg_monthly_qty: number;
  seasonality_index: number;
};

export type SeasonalityMonthProfile = {
  month_num: number;
  month_name: string;
  avg_monthly_qty: number;
  seasonality_index: number;
};

export type SkuSeasonalityProfile = {
  sku: string;
  item_description: string | null;
  item_class: string | null;
  seasonality_strength: SeasonalityStrength;
  peak_months: number[];
  max_seasonality_index: number;
  overall_avg_monthly_qty: number;
  months: SeasonalityMonthProfile[];
};

export type SeasonalCategoryInsight = {
  item_class: string;
  peak_months: number[];
  reason: string;
  build_stock_by_month: string;
  strength: SeasonalityStrength;
};

export type SeasonalSpikeSku = {
  item_number: string;
  spike_month: string;
  likely_reason: string;
};

export type SeasonalIntelligenceAnalysis = {
  seasonal_categories: SeasonalCategoryInsight[];
  spike_skus: SeasonalSpikeSku[];
  summary: string;
};

export type SeasonalIntelligenceRecord = {
  id: string;
  tenant_id: string;
  analysis_date: string;
  seasonal_categories: SeasonalCategoryInsight[];
  spike_skus: SeasonalSpikeSku[];
  summary: string;
  created_at: string;
};

export type ItemSeasonalityProfile = {
  sku: string;
  seasonality_strength: SeasonalityStrength | null;
  peak_months: number[];
  seasonality_profile: SkuSeasonalityProfile | null;
};

export type SeasonalReorderWarning =
  | {
      kind: "peak_now";
      message: string;
    }
  | {
      kind: "peak_approaching";
      message: string;
      peakMonthName: string;
    };
