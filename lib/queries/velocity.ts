import { computeSalesVelocityRows } from "@/lib/queries/compute-sales-velocity";
import { fetchReorderInputRowBySku } from "@/lib/queries/reorder-inputs";
import { createClient } from "@/lib/supabase/server";
import { buildVelocityDiagnostic } from "@/lib/velocity-engine";
import { buildReorderRecommendation } from "@/lib/reorder-engine";
import { TENANT_ID } from "@/lib/tenant";
import { cache } from "react";
import type {
  ReorderRecommendation,
  VelocityDiagnostic,
  VwSalesVelocityRow,
} from "@/lib/types";

async function fetchSalesVelocityFromView(): Promise<
  VwSalesVelocityRow[] | null
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vw_sales_velocity")
    .select("*")
    .eq("tenant_id", TENANT_ID);

  if (error) {
    if (
      error.message.includes("vw_sales_velocity") ||
      error.message.includes("schema cache")
    ) {
      return null;
    }

    console.error("Failed to fetch velocity rows:", error.message);
    return [];
  }

  return (data ?? []) as VwSalesVelocityRow[];
}

async function fetchSalesVelocityComputed(): Promise<VwSalesVelocityRow[]> {
  const supabase = await createClient();

  const [productsResult, salesResult] = await Promise.all([
    supabase
      .from("products")
      .select("tenant_id, sku")
      .eq("tenant_id", TENANT_ID)
      .not("sku", "is", null),
    supabase
      .from("sales_transactions")
      .select("sku, quantity_sold, transaction_date")
      .eq("tenant_id", TENANT_ID)
      .not("sku", "is", null),
  ]);

  if (productsResult.error) {
    console.error(
      "Failed to fetch products for velocity:",
      productsResult.error.message
    );
    return [];
  }

  if (salesResult.error) {
    console.error(
      "Failed to fetch sales for velocity:",
      salesResult.error.message
    );
    return [];
  }

  return computeSalesVelocityRows(
    productsResult.data ?? [],
    salesResult.data ?? [],
    TENANT_ID
  );
}

export const getVelocityRowsBySku = cache(
  async (): Promise<Map<string, VwSalesVelocityRow>> => {
    const viewRows = await fetchSalesVelocityFromView();
    const rows = viewRows ?? (await fetchSalesVelocityComputed());
    const map = new Map<string, VwSalesVelocityRow>();

    for (const row of rows) {
      map.set(row.sku, row);
    }

    return map;
  }
);

export async function getVelocityRowForSku(
  sku: string
): Promise<VwSalesVelocityRow | null> {
  const velocityBySku = await getVelocityRowsBySku();
  return velocityBySku.get(sku) ?? null;
}

export function buildVelocityDiagnosticMap(
  recommendations: ReorderRecommendation[],
  velocityBySku: Map<string, VwSalesVelocityRow>
): Map<string, VelocityDiagnostic> {
  const diagnostics = new Map<string, VelocityDiagnostic>();

  for (const rec of recommendations) {
    const velocityRow = velocityBySku.get(rec.sku);

    if (!velocityRow) {
      continue;
    }

    diagnostics.set(rec.sku, buildVelocityDiagnostic(velocityRow, rec));
  }

  return diagnostics;
}

export async function getReorderRecommendationForSku(
  sku: string
): Promise<ReorderRecommendation | null> {
  const row = await fetchReorderInputRowBySku(sku);

  if (!row) {
    return null;
  }

  return buildReorderRecommendation(row);
}

export async function getVelocityDiagnosticForSku(
  sku: string,
  rec?: ReorderRecommendation | null
): Promise<VelocityDiagnostic | null> {
  const recommendation = rec ?? (await getReorderRecommendationForSku(sku));

  if (!recommendation) {
    return null;
  }

  const velocityRow = await getVelocityRowForSku(sku);

  if (!velocityRow) {
    return null;
  }

  return buildVelocityDiagnostic(velocityRow, recommendation);
}
