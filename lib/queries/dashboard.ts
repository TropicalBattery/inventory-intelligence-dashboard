import { getLatestConnectorHeartbeat } from "@/lib/queries/connector-health";
import { getConnectorHealthState } from "@/lib/connector/health";
import { toNumber } from "@/lib/format";
import {
  isPrimarySiteBalanceRow,
  type PrimarySiteLevels,
} from "@/lib/inventory/primary-site-levels";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { TENANT_ID } from "@/lib/tenant";
import type { ReorderPreviewItem } from "@/lib/types/database";

type DashboardReorderRow = {
  sku: string;
  name: string | null;
  quantity_on_hand: number | string | null;
  quantity_available: number | string | null;
  reorder_level: number | string | null;
  current_cost_local?: number | string | null;
};

type InventoryBalanceDashboardRow = {
  sku: string | null;
  external_id: string | null;
  quantity_on_hand: number | string | null;
  quantity_available: number | string | null;
  reorder_level: number | string | null;
  maximum_stock_level: number | string | null;
};

type SkuInventoryTotals = {
  quantityOnHand: number;
  quantityAvailable: number;
};

type ItemCostRow = {
  sku: string | null;
  current_cost_local: number | string | null;
};

type DashboardInventorySnapshot = {
  totalsBySku: Map<string, SkuInventoryTotals>;
  primarySiteLevelsBySku: Map<string, PrimarySiteLevels>;
};

export type DashboardData = {
  totalSkus: number;
  totalUnitsOnHand: number;
  itemsBelowReorderLevel: number;
  totalInventoryValue: number;
  connectorHealth: ReturnType<typeof getConnectorHealthState>;
  topReorderItems: ReorderPreviewItem[];
};

function resolveUnitCost(row: DashboardReorderRow): number {
  return toNumber(row.current_cost_local);
}

export function buildReorderPreviewItems(
  rows: DashboardReorderRow[]
): ReorderPreviewItem[] {
  const items: ReorderPreviewItem[] = [];

  for (const row of rows) {
    const reorderLevel = toNumber(row.reorder_level);
    const quantityAvailable = toNumber(row.quantity_available);

    if (reorderLevel <= 0) {
      continue;
    }

    if (quantityAvailable >= reorderLevel) {
      continue;
    }

    items.push({
      sku: row.sku,
      name: row.name ?? "Unknown product",
      quantityAvailable,
      reorderLevel,
      shortfall: reorderLevel - quantityAvailable,
    });
  }

  return items.sort((left, right) => right.shortfall - left.shortfall);
}

async function fetchProductCount(
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID);

  if (error) {
    console.error("Failed to count products for dashboard:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function fetchDashboardInventorySnapshot(
  supabase: ReturnType<typeof createAdminClient>
): Promise<DashboardInventorySnapshot> {
  const totalsBySku = new Map<string, SkuInventoryTotals>();
  const primarySiteLevelsBySku = new Map<string, PrimarySiteLevels>();

  try {
    const rows = await fetchAllPages<InventoryBalanceDashboardRow>(
      async (from, to) => {
        const { data, error } = await supabase
          .from("inventory_balances")
          .select(
            "sku, external_id, quantity_on_hand, quantity_available, reorder_level, maximum_stock_level"
          )
          .eq("tenant_id", TENANT_ID)
          .not("sku", "is", null)
          .order("sku", { ascending: true })
          .range(from, to);

        return { data, error };
      }
    );

    for (const row of rows) {
      if (!row.sku) {
        continue;
      }

      const existing = totalsBySku.get(row.sku) ?? {
        quantityOnHand: 0,
        quantityAvailable: 0,
      };

      existing.quantityOnHand += toNumber(row.quantity_on_hand);
      existing.quantityAvailable += toNumber(row.quantity_available);
      totalsBySku.set(row.sku, existing);

      if (isPrimarySiteBalanceRow(row)) {
        primarySiteLevelsBySku.set(row.sku, {
          reorderLevel: toNumber(row.reorder_level),
          maximumStockLevel: toNumber(row.maximum_stock_level),
        });
      }
    }
  } catch (error) {
    console.error(
      "Failed to fetch inventory snapshot for dashboard:",
      error instanceof Error ? error.message : error
    );
  }

  return { totalsBySku, primarySiteLevelsBySku };
}

async function fetchUnitCostsBySku(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, number>> {
  const costsBySku = new Map<string, number>();

  try {
    const rows = await fetchAllPages<ItemCostRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("item_costing")
        .select("sku, current_cost_local")
        .eq("tenant_id", TENANT_ID)
        .not("sku", "is", null)
        .order("sku", { ascending: true })
        .range(from, to);

      return { data, error };
    });

    for (const row of rows) {
      if (!row.sku) {
        continue;
      }

      costsBySku.set(row.sku, toNumber(row.current_cost_local));
    }
  } catch (error) {
    console.error(
      "Failed to fetch item costs for dashboard:",
      error instanceof Error ? error.message : error
    );
  }

  return costsBySku;
}

async function fetchProductNamesBySkus(
  supabase: ReturnType<typeof createAdminClient>,
  skus: string[]
): Promise<Map<string, string>> {
  const namesBySku = new Map<string, string>();

  if (skus.length === 0) {
    return namesBySku;
  }

  const { data, error } = await supabase
    .from("products")
    .select("sku, name")
    .eq("tenant_id", TENANT_ID)
    .in("sku", skus);

  if (error) {
    console.error("Failed to fetch product names for dashboard:", error.message);
    return namesBySku;
  }

  for (const row of data ?? []) {
    if (row.sku && row.name) {
      namesBySku.set(row.sku, row.name);
    }
  }

  return namesBySku;
}

function buildDashboardReorderRows(
  inventoryBySku: Map<string, SkuInventoryTotals>,
  costsBySku: Map<string, number>,
  primarySiteLevelsBySku: Map<string, PrimarySiteLevels>
): DashboardReorderRow[] {
  const rows: DashboardReorderRow[] = [];

  for (const [sku, totals] of Array.from(inventoryBySku.entries())) {
    const primarySite = primarySiteLevelsBySku.get(sku);

    rows.push({
      sku,
      name: null,
      quantity_on_hand: totals.quantityOnHand,
      quantity_available: totals.quantityAvailable,
      reorder_level: primarySite?.reorderLevel ?? 0,
      current_cost_local: costsBySku.get(sku) ?? 0,
    });
  }

  return rows;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createAdminClient();

  const [totalSkus, inventorySnapshot, costsBySku, heartbeat] =
    await Promise.all([
      fetchProductCount(supabase),
      fetchDashboardInventorySnapshot(supabase),
      fetchUnitCostsBySku(supabase),
      getLatestConnectorHeartbeat(),
    ]);

  const reorderRows = buildDashboardReorderRows(
    inventorySnapshot.totalsBySku,
    costsBySku,
    inventorySnapshot.primarySiteLevelsBySku
  );

  const totalUnitsOnHand = reorderRows.reduce(
    (sum, row) => sum + toNumber(row.quantity_on_hand),
    0
  );

  const totalInventoryValue = reorderRows.reduce(
    (sum, row) => sum + toNumber(row.quantity_on_hand) * resolveUnitCost(row),
    0
  );

  const reorderPreviewItems = buildReorderPreviewItems(reorderRows);
  const topReorderItems = reorderPreviewItems.slice(0, 5);
  const namesBySku = await fetchProductNamesBySkus(
    supabase,
    topReorderItems.map((item) => item.sku)
  );

  const connectorHealth = getConnectorHealthState(heartbeat?.sent_at ?? null);

  return {
    totalSkus,
    totalUnitsOnHand,
    itemsBelowReorderLevel: reorderPreviewItems.length,
    totalInventoryValue,
    connectorHealth,
    topReorderItems: topReorderItems.map((item) => ({
      ...item,
      name: namesBySku.get(item.sku) ?? item.name,
    })),
  };
}
