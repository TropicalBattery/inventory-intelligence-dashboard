import { createAdminClient } from "@/lib/supabase/admin";
import { buildReorderRecommendation } from "@/lib/reorder-engine";
import { fetchAllReorderInputRows } from "@/lib/queries/reorder-inputs";
import type { ReorderRecommendation } from "@/lib/types";

export async function getReorderRecommendations(): Promise<ReorderRecommendation[]> {
  const rows = await fetchAllReorderInputRows(createAdminClient());
  return rows.map((row) => buildReorderRecommendation(row));
}
