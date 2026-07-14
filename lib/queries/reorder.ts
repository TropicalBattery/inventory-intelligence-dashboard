import { cache } from "react";
import { assignAbcClasses } from "@/lib/reorder/abc";
import { buildReorderRecommendation } from "@/lib/reorder-engine";
import { getOpenPoLinesBySku } from "@/lib/queries/open-po-lines";
import { fetchAllReorderInputRows } from "@/lib/queries/reorder-inputs";
import { getSupplierNameMap } from "@/lib/queries/suppliers";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import type { ReorderRecommendation } from "@/lib/types";

function withSupplierNames(
  recommendations: ReorderRecommendation[],
  nameMap: Map<string, string>
): ReorderRecommendation[] {
  return recommendations.map((rec) => ({
    ...rec,
    supplierName: rec.supplierExternalId
      ? (nameMap.get(rec.supplierExternalId) ?? null)
      : null,
  }));
}

function withOpenPoLines(
  recommendations: ReorderRecommendation[],
  openPoBySku: Awaited<ReturnType<typeof getOpenPoLinesBySku>>
): ReorderRecommendation[] {
  return recommendations.map((rec) => {
    const refs = openPoBySku.get(rec.sku) ?? [];
    const openPoQty = refs.reduce((sum, ref) => {
      const qty = Number.isFinite(ref.quantity) ? ref.quantity : 0;
      return sum + qty;
    }, 0);

    return {
      ...rec,
      openPoQty,
      openPoRefs: refs,
    };
  });
}

export const getReorderRecommendations = cache(
  async (tenantId: string): Promise<ReorderRecommendation[]> => {
    if (tenantId !== TENANT_ID) {
      return [];
    }

    const [rows, nameMap, openPoBySku] = await Promise.all([
      fetchAllReorderInputRows(createAdminClient()),
      getSupplierNameMap(),
      getOpenPoLinesBySku(),
    ]);
    const recommendations = withOpenPoLines(
      withSupplierNames(
        rows.map((row) => buildReorderRecommendation(row)),
        nameMap
      ),
      openPoBySku
    );

    // Relative Pareto ranking over active demand set only (exclude no_demand).
    const classifiable = recommendations.filter(
      (rec) => rec.status !== "no_demand"
    );
    const abcBySku = assignAbcClasses(classifiable);

    return recommendations.map((rec) => ({
      ...rec,
      abcClass: abcBySku.get(rec.sku) ?? null,
    }));
  }
);
