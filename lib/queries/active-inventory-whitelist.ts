import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { TENANT_ID } from "@/lib/tenant";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActiveInventoryWhitelistEntry = {
  buyerRank: number | null;
};

export type ActiveInventoryWhitelist = {
  /** Empty map means fallback: treat every SKU as whitelisted. */
  bySku: Map<string, ActiveInventoryWhitelistEntry>;
  /** True when the table had rows and soft-filtering applies. */
  isActive: boolean;
  skuCount: number;
};

type WhitelistRow = {
  sku: string | null;
  buyer_rank: number | string | null;
};

function toBuyerRank(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveWhitelistFlags(
  sku: string,
  whitelist: ActiveInventoryWhitelist
): { isWhitelisted: boolean; buyerRank: number | null } {
  if (!whitelist.isActive) {
    return { isWhitelisted: true, buyerRank: null };
  }

  const entry = whitelist.bySku.get(sku);
  if (!entry) {
    return { isWhitelisted: false, buyerRank: null };
  }

  return { isWhitelisted: true, buyerRank: entry.buyerRank };
}

async function loadActiveInventoryWhitelist(
  supabase: SupabaseClient
): Promise<ActiveInventoryWhitelist> {
  try {
    const rows = await fetchAllPages<WhitelistRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("active_inventory_whitelist")
        .select("sku, buyer_rank")
        .eq("tenant_id", TENANT_ID)
        .order("sku", { ascending: true })
        .range(from, to);

      return { data, error };
    });

    const bySku = new Map<string, ActiveInventoryWhitelistEntry>();
    for (const row of rows) {
      if (!row.sku) {
        continue;
      }
      bySku.set(row.sku, { buyerRank: toBuyerRank(row.buyer_rank) });
    }

    return {
      bySku,
      isActive: bySku.size > 0,
      skuCount: bySku.size,
    };
  } catch (error) {
    console.error(
      "Failed to fetch active inventory whitelist:",
      error instanceof Error ? error.message : error
    );
    return { bySku: new Map(), isActive: false, skuCount: 0 };
  }
}

/** Request-scoped whitelist map (empty = treat all SKUs as whitelisted). */
export const getActiveInventoryWhitelist = cache(
  async (): Promise<ActiveInventoryWhitelist> =>
    loadActiveInventoryWhitelist(createAdminClient())
);
