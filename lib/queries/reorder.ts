import { cache } from "react";
import { buildReorderRecommendation } from "@/lib/reorder-engine";
import { fetchAllReorderInputRows } from "@/lib/queries/reorder-inputs";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import type { ReorderRecommendation } from "@/lib/types";

export const getReorderRecommendations = cache(
  async (tenantId: string): Promise<ReorderRecommendation[]> => {
    if (tenantId !== TENANT_ID) {
      return [];
    }

    const rows = await fetchAllReorderInputRows(createAdminClient());
    return rows.map((row) => buildReorderRecommendation(row));
  }
);
