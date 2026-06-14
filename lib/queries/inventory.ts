import { buildReorderRecommendation } from "@/lib/reorder-engine";
import { parsePipelineBreakdown } from "@/lib/pipeline-breakdown";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { fetchAllReorderInputRows } from "@/lib/queries/reorder-inputs";
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

function buildPipelineFromRow(row: VwReorderInputsRow): InventoryPipelineBreakdown {
  const breakdown = parsePipelineBreakdown(
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

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const rows = await fetchAllReorderInputRows();

  return rows.map((row) => ({
    recommendation: buildReorderRecommendation(row),
    pipeline: buildPipelineFromRow(row),
  }));
}

export async function getInventoryLocationBalancesBySku(): Promise<
  Map<string, InventoryLocationBalance[]>
> {
  const supabase = createAdminClient();

  let rows: Array<{
    sku: string | null;
    location_code: string | null;
    location_name: string | null;
    quantity_on_hand: number | string | null;
    quantity_available: number | string | null;
    quantity_on_order: number | string | null;
  }>;

  try {
    rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("inventory_balances")
        .select(
          "sku, location_code, location_name, quantity_on_hand, quantity_available, quantity_on_order"
        )
        .eq("tenant_id", TENANT_ID)
        .not("sku", "is", null)
        .order("sku", { ascending: true })
        .range(from, to);

      return { data, error };
    });
  } catch (error) {
    console.error(
      "Failed to fetch inventory location balances:",
      error instanceof Error ? error.message : error
    );
    return new Map();
  }

  const map = new Map<string, InventoryLocationBalance[]>();

  for (const row of rows) {
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
