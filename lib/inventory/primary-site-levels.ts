import type { SupabaseClient } from "@supabase/supabase-js";
import { toNumber } from "@/lib/format";
import { TENANT_ID } from "@/lib/tenant";

const PAGE_SIZE = 1000;

export type PrimarySiteLevels = {
  reorderLevel: number;
  maximumStockLevel: number;
};

type InventoryBalanceLevelRow = {
  sku: string | null;
  external_id: string | null;
  reorder_level: number | string | null;
  maximum_stock_level: number | string | null;
};

export function getPrimarySiteExternalId(sku: string): string {
  return `${sku}-`;
}

export function isPrimarySiteBalanceRow(row: {
  sku: string | null;
  external_id: string | null;
}): boolean {
  return Boolean(row.sku && row.external_id === getPrimarySiteExternalId(row.sku));
}

export async function fetchPrimarySiteLevelsBySku(
  supabase: SupabaseClient
): Promise<Map<string, PrimarySiteLevels>> {
  const levelsBySku = new Map<string, PrimarySiteLevels>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("inventory_balances")
      .select("sku, external_id, reorder_level, maximum_stock_level")
      .eq("tenant_id", TENANT_ID)
      .order("sku", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(
        "Failed to fetch primary-site inventory levels:",
        error.message
      );
      break;
    }

    const rows = (data ?? []) as InventoryBalanceLevelRow[];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (!isPrimarySiteBalanceRow(row) || !row.sku) {
        continue;
      }

      levelsBySku.set(row.sku, {
        reorderLevel: toNumber(row.reorder_level),
        maximumStockLevel: toNumber(row.maximum_stock_level),
      });
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return levelsBySku;
}

export function applyPrimarySiteLevels<
  T extends {
    sku: string;
    reorder_level?: number | string | null;
    maximum_stock_level?: number | string | null;
  },
>(rows: T[], primarySiteLevelsBySku: Map<string, PrimarySiteLevels>): T[] {
  return rows.map((row) => {
    const primarySite = primarySiteLevelsBySku.get(row.sku);
    if (!primarySite) {
      return row;
    }

    return {
      ...row,
      reorder_level: primarySite.reorderLevel,
      maximum_stock_level: primarySite.maximumStockLevel,
    };
  });
}
