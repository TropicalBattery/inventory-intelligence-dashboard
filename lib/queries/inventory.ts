import { cache } from "react";
import { getReorderRecommendations } from "@/lib/queries/reorder";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { toNumber } from "@/lib/format";
import { TENANT_ID } from "@/lib/tenant";
import type { ReorderRecommendation } from "@/lib/types";

export type InventoryPipelineBreakdown = {
  inTransit: number;
  inBond: number;
  atPort: number;
  inClearing: number;
  total: number;
};

export type InventoryLocationBalance = {
  locationCode: string | null;
  locationName: string | null;
  quantityOnHand: number;
  quantityAvailable: number;
  quantityOnOrder: number;
};

export type InventoryItem = {
  recommendation: ReorderRecommendation;
  pipeline: InventoryPipelineBreakdown;
  /** True when annual demand is missing/zero — hidden unless Show inactive or searching. */
  isInactive: boolean;
};

export type InventoryStats = {
  total: number;
  critical: number;
  reorderNeeded: number;
  ok: number;
};

/** Quantity sums over a filtered inventory item set (full set, not one page). */
export type InventoryQuantityTotals = {
  quantityAvailable: number;
  quantityOnHand: number;
  quantityOnOrder: number;
};

export const INVENTORY_PAGE_SIZE = 50;

export function isInventoryInactiveItem(
  recommendation: Pick<ReorderRecommendation, "annualDemandUnits">
): boolean {
  return (recommendation.annualDemandUnits ?? 0) <= 0;
}

function pipelineFromRecommendation(
  recommendation: ReorderRecommendation
): InventoryPipelineBreakdown {
  const breakdown = recommendation.pipelineBreakdown;
  return {
    inTransit: breakdown.inTransit,
    inBond: breakdown.inBond,
    atPort: breakdown.atPort,
    inClearing: breakdown.inClearing,
    total: recommendation.quantityInPipeline,
  };
}

/**
 * Full catalogue for Inventory: same recommendation / cover-based status
 * pipeline as Reorder (buildReorderRecommendation + demand adjustment).
 *
 * Legacy inventory stats (removed) used:
 * - Critical: mv_inventory_aggregates quantity_available <= 0 (catalogue-wide)
 * - OK: quantity_available > 0
 * - Reorder Needed: count_reorder_needed RPC
 * - Total: item_costing with optional annual_demand > 0 filter
 * That produced Total << Critical and marked zero-stock no-demand rows Critical.
 */
export const getAllInventoryItems = cache(
  async (): Promise<InventoryItem[]> => {
    const recommendations = await getReorderRecommendations(TENANT_ID);
    return recommendations.map((recommendation) => ({
      recommendation,
      pipeline: pipelineFromRecommendation(recommendation),
      isInactive: isInventoryInactiveItem(recommendation),
    }));
  }
);

export async function getInventoryInactiveHiddenCount(
  items?: InventoryItem[]
): Promise<number> {
  const catalogue = items ?? (await getAllInventoryItems());
  return catalogue.reduce(
    (count, item) => count + (item.isInactive ? 1 : 0),
    0
  );
}

export function summarizeInventoryStats(
  items: InventoryItem[]
): InventoryStats {
  let critical = 0;
  let reorderNeeded = 0;
  let ok = 0;

  for (const item of items) {
    switch (item.recommendation.status) {
      case "critical":
        critical += 1;
        break;
      case "reorder_needed":
        reorderNeeded += 1;
        break;
      case "ok":
        ok += 1;
        break;
      default:
        break;
    }
  }

  return {
    total: items.length,
    critical,
    reorderNeeded,
    ok,
  };
}

/**
 * Sums Qty Available / On Hand / On Order for the same filtered item set
 * that feeds the inventory list (all matching rows, not the current page).
 */
export function summarizeInventoryQuantityTotals(
  items: InventoryItem[]
): InventoryQuantityTotals {
  let quantityAvailable = 0;
  let quantityOnHand = 0;
  let quantityOnOrder = 0;

  for (const item of items) {
    quantityAvailable += item.recommendation.quantityAvailable;
    quantityOnHand += item.recommendation.quantityOnHand;
    quantityOnOrder += item.recommendation.quantityOnOrder;
  }

  return {
    quantityAvailable,
    quantityOnHand,
    quantityOnOrder,
  };
}

export async function getInventoryLocationBalancesBySku(
  skus?: string[]
): Promise<Map<string, InventoryLocationBalance[]>> {
  const supabase = createAdminClient();
  const map = new Map<string, InventoryLocationBalance[]>();
  const skuFilter = skus && skus.length > 0 ? new Set(skus) : null;

  const rows = await fetchAllPages<{
    sku: string | null;
    location_code: string | null;
    location_name: string | null;
    quantity_on_hand: number | string | null;
    quantity_available: number | string | null;
    quantity_on_order: number | string | null;
  }>(async (from, to) => {
    const { data, error } = await supabase
      .from("inventory_balances")
      .select(
        "sku, location_code, location_name, quantity_on_hand, quantity_available, quantity_on_order"
      )
      .eq("tenant_id", TENANT_ID)
      .order("sku", { ascending: true })
      .range(from, to);

    return { data, error };
  });

  for (const row of rows) {
    if (!row.sku) {
      continue;
    }
    if (skuFilter && !skuFilter.has(row.sku)) {
      continue;
    }

    const entry: InventoryLocationBalance = {
      locationCode: row.location_code,
      locationName: row.location_name,
      quantityOnHand: toNumber(row.quantity_on_hand),
      quantityAvailable: toNumber(row.quantity_available),
      quantityOnOrder: toNumber(row.quantity_on_order),
    };

    const existing = map.get(row.sku) ?? [];
    existing.push(entry);
    map.set(row.sku, existing);
  }

  for (const [sku, locations] of Array.from(map.entries())) {
    locations.sort((left, right) =>
      (left.locationName ?? left.locationCode ?? "").localeCompare(
        right.locationName ?? right.locationCode ?? ""
      )
    );
    map.set(sku, locations);
  }

  return map;
}
