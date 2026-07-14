import { computeSalesVelocityRows } from "@/lib/queries/compute-sales-velocity";
import { fetchReorderInputRowBySku } from "@/lib/queries/reorder-inputs";
import { getSupplierNameMap } from "@/lib/queries/suppliers";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { buildVelocityDiagnostic } from "@/lib/velocity-engine";
import { buildReorderRecommendation } from "@/lib/reorder-engine";
import { TENANT_ID } from "@/lib/tenant";
import { cache } from "react";
import type {
  ReorderRecommendation,
  VelocityDiagnostic,
  VwSalesVelocityRow,
} from "@/lib/types";

function normalizeSku(sku: string): string {
  return sku.trim();
}

async function fetchSalesVelocityFromView(): Promise<
  VwSalesVelocityRow[] | null
> {
  const supabase = await createClient();

  try {
    const rows = await fetchAllPages<VwSalesVelocityRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("vw_sales_velocity")
        .select("*")
        .eq("tenant_id", TENANT_ID)
        .order("sku", { ascending: true })
        .range(from, to);

      return {
        data: data as VwSalesVelocityRow[] | null,
        error,
      };
    });

    return rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes("vw_sales_velocity") ||
      message.includes("schema cache")
    ) {
      return null;
    }

    console.error("Failed to fetch velocity rows:", message);
    return [];
  }
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
      if (!row.sku) {
        continue;
      }

      map.set(normalizeSku(row.sku), row);
    }

    return map;
  }
);

export async function getVelocityRowForSku(
  sku: string
): Promise<VwSalesVelocityRow | null> {
  const normalized = normalizeSku(sku);
  const velocityBySku = await getVelocityRowsBySku();
  const cached = velocityBySku.get(normalized);

  if (cached) {
    return cached;
  }

  // Direct lookup when the SKU was outside the first PostgREST page
  // before pagination landed, or if the map is empty/partial.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vw_sales_velocity")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("sku", normalized)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("vw_sales_velocity") ||
      error.message.includes("schema cache")
    ) {
      return null;
    }

    console.error("Failed to fetch velocity row for SKU:", error.message);
    return null;
  }

  return (data as VwSalesVelocityRow | null) ?? null;
}

export function buildVelocityDiagnosticMap(
  recommendations: ReorderRecommendation[],
  velocityBySku: Map<string, VwSalesVelocityRow>
): Map<string, VelocityDiagnostic> {
  const diagnostics = new Map<string, VelocityDiagnostic>();

  for (const rec of recommendations) {
    const velocityRow = velocityBySku.get(normalizeSku(rec.sku));

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

  const nameMap = await getSupplierNameMap();
  const recommendation = buildReorderRecommendation(row);
  return {
    ...recommendation,
    supplierName: recommendation.supplierExternalId
      ? (nameMap.get(recommendation.supplierExternalId) ?? null)
      : null,
  };
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
