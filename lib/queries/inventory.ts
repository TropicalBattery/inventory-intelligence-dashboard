import { buildReorderRecommendation } from "@/lib/reorder-engine";
import { parsePipelineBreakdown } from "@/lib/pipeline-breakdown";
import {
  mapViewRowToInputRow,
  VW_REORDER_INPUTS_SELECT,
} from "@/lib/queries/reorder-inputs";
import { createAdminClient } from "@/lib/supabase/admin";
import { toNumber } from "@/lib/format";
import { TENANT_ID } from "@/lib/tenant";
import type { ReorderRecommendation, VwReorderInputsRow } from "@/lib/types";
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
};

export type InventoryStats = {
  total: number;
  critical: number;
  reorderNeeded: number;
  ok: number;
};

export const INVENTORY_PAGE_SIZE = 50;

function buildPipelineFromRow(row: VwReorderInputsRow): InventoryPipelineBreakdown {  const breakdown = parsePipelineBreakdown(
    row as unknown as Record<string, unknown>
  );

  return {
    ...breakdown,
    total:
      breakdown.inTransit +
      breakdown.inBond +
      breakdown.atPort +
      breakdown.inClearing,
  };
}

export async function getInventoryItemCount(
  showInactive = false
): Promise<number> {
  const supabase = createAdminClient();

  let query = supabase
    .from("item_costing")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("source_system", "gp-dynamics");

  if (!showInactive) {
    query = query.gt("annual_demand_units", 0);
  }

  const { count, error } = await query;

  if (error) {
    console.warn("Failed to count inventory items:", error.message);
    return 0;
  }

  return count ?? 0;
}

export async function getInventoryItems(
  page = 1,
  showInactive = false
): Promise<InventoryItem[]> {
  const supabase = createAdminClient();
  const offset = (page - 1) * INVENTORY_PAGE_SIZE;

  let query = supabase
    .from("vw_reorder_inputs")
    .select(VW_REORDER_INPUTS_SELECT)
    .eq("tenant_id", TENANT_ID)
    .order("sku", { ascending: true });

  if (!showInactive) {
    query = query.gt("annual_demand_units", 0);
  }

  const { data, error } = await query.range(
    offset,
    offset + INVENTORY_PAGE_SIZE - 1
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const inputRow = mapViewRowToInputRow(
      row as unknown as Parameters<typeof mapViewRowToInputRow>[0]
    );

    return {
      recommendation: buildReorderRecommendation(inputRow),
      pipeline: buildPipelineFromRow(inputRow),
    };
  });
}

export async function getInventoryStats(
  showInactive = false
): Promise<InventoryStats> {
  const supabase = createAdminClient();

  let totalQuery = supabase
    .from("item_costing")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("source_system", "gp-dynamics");

  if (!showInactive) {
    totalQuery = totalQuery.gt("annual_demand_units", 0);
  }

  const [
    { count: total, error: totalError },
    { count: critical, error: criticalError },
    reorderResult,
    { count: ok, error: okError },
  ] = await Promise.all([
    totalQuery,
    supabase
      .from("mv_inventory_aggregates_by_sku")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .lte("quantity_available", 0),
    supabase.rpc("count_reorder_needed", { p_tenant_id: TENANT_ID }),
    supabase
      .from("mv_inventory_aggregates_by_sku")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .gt("quantity_available", 0),
  ]);

  if (totalError) {
    console.warn("Failed to count inventory total:", totalError.message);
  }

  if (criticalError) {
    console.warn("Failed to count critical inventory:", criticalError.message);
  }

  if (reorderResult.error) {
    console.warn(
      "Failed to count reorder needed inventory:",
      reorderResult.error.message
    );
  }

  if (okError) {
    console.warn("Failed to count OK inventory:", okError.message);
  }

  return {
    total: total ?? 0,
    critical: critical ?? 0,
    reorderNeeded:
      typeof reorderResult.data === "number" ? reorderResult.data : 0,
    ok: ok ?? 0,
  };
}

export async function getInventoryInactiveHiddenCount(): Promise<number> {
  const [allCount, activeCount] = await Promise.all([
    getInventoryItemCount(true),
    getInventoryItemCount(false),
  ]);

  return Math.max(0, allCount - activeCount);
}

export async function getInventoryLocationBalancesBySku(
  skus: string[]
): Promise<Map<string, InventoryLocationBalance[]>> {
  const supabase = createAdminClient();
  const map = new Map<string, InventoryLocationBalance[]>();

  if (skus.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from("inventory_balances")
    .select(
      "sku, location_code, location_name, quantity_on_hand, quantity_available, quantity_on_order"
    )
    .eq("tenant_id", TENANT_ID)
    .in("sku", skus)
    .order("sku", { ascending: true });

  if (error) {
    console.error(
      "Failed to fetch inventory location balances:",
      error.message
    );
    return map;
  }

  for (const row of data ?? []) {
    if (!row.sku) {
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
