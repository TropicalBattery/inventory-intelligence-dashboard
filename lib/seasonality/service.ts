import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import {
  buildSkuSeasonalityProfiles,
  normalizeMonthlyDemandRows,
  pickTopSeasonalSkus,
} from "@/lib/seasonality/analyze";
import {
  buildFallbackSeasonalAnalysis,
  runSeasonalIntelligenceAISafe,
} from "@/lib/seasonality/ai-analysis";
import { buildSeasonalIntelligencePrompt } from "@/lib/seasonality/prompts";
import type {
  ItemSeasonalityProfile,
  MonthlyDemandRow,
  SeasonalIntelligenceRecord,
  SkuSeasonalityProfile,
} from "@/lib/seasonality/types";

export async function fetchMonthlyDemandBySku(
  tenantId = TENANT_ID
): Promise<MonthlyDemandRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_monthly_demand_by_sku", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`Failed to fetch monthly demand: ${error.message}`);
  }

  return normalizeMonthlyDemandRows((data ?? []) as Array<Record<string, unknown>>);
}

export async function updateItemCostingSeasonalityProfiles(
  profiles: SkuSeasonalityProfile[],
  tenantId = TENANT_ID
): Promise<void> {
  const supabase = createAdminClient();

  for (const profile of profiles) {
    const { error } = await supabase
      .from("item_costing")
      .update({
        seasonality_profile: profile,
        peak_months: profile.peak_months,
        seasonality_strength: profile.seasonality_strength,
      })
      .eq("tenant_id", tenantId)
      .eq("sku", profile.sku);

    if (error) {
      console.error(
        `Failed to update seasonality profile for ${profile.sku}:`,
        error.message
      );
    }
  }
}

export async function storeSeasonalIntelligenceRecord(
  analysis: {
    seasonal_categories: SeasonalIntelligenceRecord["seasonal_categories"];
    spike_skus: SeasonalIntelligenceRecord["spike_skus"];
    summary: string;
  },
  tenantId = TENANT_ID
): Promise<SeasonalIntelligenceRecord> {
  const supabase = createAdminClient();
  const analysisDate = new Date().toISOString();

  const { data, error } = await supabase
    .from("seasonal_intelligence")
    .insert({
      tenant_id: tenantId,
      analysis_date: analysisDate,
      seasonal_categories: analysis.seasonal_categories,
      spike_skus: analysis.spike_skus,
      summary: analysis.summary,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to store seasonal intelligence: ${error?.message ?? "Unknown error"}`
    );
  }

  return mapSeasonalIntelligenceRecord(data);
}

export async function getLatestSeasonalIntelligence(
  tenantId = TENANT_ID
): Promise<SeasonalIntelligenceRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seasonal_intelligence")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("analysis_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch seasonal intelligence:", error.message);
    return null;
  }

  return data ? mapSeasonalIntelligenceRecord(data) : null;
}

export async function getSeasonalityProfilesBySku(
  skus: string[],
  tenantId = TENANT_ID
): Promise<Map<string, ItemSeasonalityProfile>> {
  if (skus.length === 0) {
    return new Map();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("item_costing")
    .select("sku, seasonality_strength, peak_months, seasonality_profile")
    .eq("tenant_id", tenantId)
    .in("sku", skus);

  if (error) {
    console.error("Failed to fetch seasonality profiles:", error.message);
    return new Map();
  }

  const profiles = new Map<string, ItemSeasonalityProfile>();

  for (const row of data ?? []) {
    if (!row.sku) {
      continue;
    }

    profiles.set(row.sku, {
      sku: row.sku,
      seasonality_strength:
        row.seasonality_strength === "high" ||
        row.seasonality_strength === "moderate" ||
        row.seasonality_strength === "flat"
          ? row.seasonality_strength
          : null,
      peak_months: Array.isArray(row.peak_months)
        ? row.peak_months.map((month) => Number(month)).filter(Number.isFinite)
        : [],
      seasonality_profile:
        row.seasonality_profile && typeof row.seasonality_profile === "object"
          ? (row.seasonality_profile as SkuSeasonalityProfile)
          : null,
    });
  }

  return profiles;
}

export async function runSeasonalIntelligenceAnalysis(tenantId = TENANT_ID) {
  const monthlyRows = await fetchMonthlyDemandBySku(tenantId);
  const profiles = buildSkuSeasonalityProfiles(monthlyRows);
  await updateItemCostingSeasonalityProfiles(profiles, tenantId);

  const topProfiles = pickTopSeasonalSkus(profiles, 20);
  const prompt = buildSeasonalIntelligencePrompt(topProfiles);
  const { analysis, fromAI } = await runSeasonalIntelligenceAISafe(
    prompt,
    topProfiles.length
  );

  const storedAnalysis =
    analysis.summary.length > 0
      ? analysis
      : buildFallbackSeasonalAnalysis(topProfiles.length);

  const record = await storeSeasonalIntelligenceRecord(storedAnalysis, tenantId);

  return {
    record,
    profileCount: profiles.length,
    topSeasonalCount: topProfiles.length,
    fromAI,
  };
}

function mapSeasonalIntelligenceRecord(
  row: Record<string, unknown>
): SeasonalIntelligenceRecord {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    analysis_date: String(row.analysis_date),
    seasonal_categories: Array.isArray(row.seasonal_categories)
      ? (row.seasonal_categories as SeasonalIntelligenceRecord["seasonal_categories"])
      : [],
    spike_skus: Array.isArray(row.spike_skus)
      ? (row.spike_skus as SeasonalIntelligenceRecord["spike_skus"])
      : [],
    summary: String(row.summary ?? ""),
    created_at: String(row.created_at),
  };
}
