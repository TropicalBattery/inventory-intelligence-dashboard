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
import { cache } from "react";
import type { ReorderRecommendation } from "@/lib/types";
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

export type DashboardTopDemandItem = {
  sku: string;
  name: string;
  demand: number;
};

export type DashboardCategoryValueItem = {
  category: string;
  value: number;
};

export type DashboardStatusCounts = {
  critical: number;
  watch: number;
  reorder_needed: number;
  ok: number;
  no_demand: number;
};

export type DashboardStats = {
  totalSkus: number;
  totalInventoryValue: number;
  itemsBelowReorderLevel: number;
  criticalCount: number;
  connectorHealth: ReturnType<typeof getConnectorHealthState>;
  topDemand: DashboardTopDemandItem[];
  categoryValue: DashboardCategoryValueItem[];
  statusCounts: DashboardStatusCounts;
  criticalItems: ReorderRecommendation[];
};

type InventoryStatusCountsRow = {
  critical: number;
  reorder_needed: number;
  ok: number;
  no_demand: number;
};

type CriticalViewRow = {
  sku: string;
  name: string | null;
  quantity_available: number | string | null;
  annual_demand_units: number | string | null;
  unit_cost: number | string | null;
  item_class: string | null;
  category: string | null;
};

type TopDemandCostRow = {
  sku: string;
  annual_demand_units: number | string | null;
};

type CategoryValueRow = {
  category: string;
  value: number | string | null;
};

function parseCategoryValue(raw: unknown): DashboardCategoryValueItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry) => {
    const row = entry as CategoryValueRow;
    return {
      category: row.category,
      value: toNumber(row.value),
    };
  });
}

function mapCriticalViewRowToRecommendation(
  row: CriticalViewRow
): ReorderRecommendation {
  const quantityAvailable = toNumber(row.quantity_available);
  const annualDemandUnits = toNumber(row.annual_demand_units);

  return {
    tenantId: TENANT_ID,
    sku: row.sku,
    name: row.name,
    itemClass: row.item_class,
    category: row.category,
    isActive: true,
    quantityOnHand: 0,
    quantityAvailable,
    quantityAllocated: 0,
    effectiveAvailable: quantityAvailable,
    quantityOnOrder: 0,
    quantityInPipeline: 0,
    pipelineBreakdown: {
      inTransit: 0,
      inBond: 0,
      atPort: 0,
      inClearing: 0,
    },
    reorderLevel: null,
    maximumStockLevel: null,
    annualDemandUnits,
    avgDailyDemandUnits: null,
    unitCost: toNumber(row.unit_cost),
    supplierExternalId: null,
    vendorItemNumber: null,
    leadTimeDays: null,
    palletQty: null,
    containerQty: null,
    orderingCostPerOrder: null,
    holdingCostPerUnitYear: null,
    supplierUnitPrice: null,
    supplierName: null,
    supplierLeadTimeDays: null,
    eoq: null,
    safetyStock: null,
    rop: null,
    suggestedQtyRaw: 0,
    suggestedQtyRounded: 0,
    roundingUnit: "unit",
    containerCount: null,
    palletCount: null,
    status: "critical",
    dataGaps: [],
  };
}

function parseInventoryStatusCounts(
  raw: unknown
): InventoryStatusCountsRow | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;

  return {
    critical: toNumber(row.critical as number | string | null | undefined),
    reorder_needed: toNumber(
      row.reorder_needed as number | string | null | undefined
    ),
    ok: toNumber(row.ok as number | string | null | undefined),
    no_demand: toNumber(row.no_demand as number | string | null | undefined),
  };
}

export const getDashboardStats = cache(async (): Promise<DashboardStats> => {
  const supabase = createAdminClient();

  const [
    { count: totalSkus, error: totalSkusError },
    { data: inventoryValue, error: inventoryValueError },
    { data: statusCountsRaw, error: statusCountsError },
    { data: criticalItemsRaw, error: criticalItemsError },
    { data: topDemandRaw, error: topDemandError },
    { data: categoryValueRaw, error: categoryValueError },
    heartbeat,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("source_system", "gp-dynamics"),
    supabase.rpc("get_inventory_value", { p_tenant_id: TENANT_ID }),
    supabase.rpc("get_inventory_status_counts", { p_tenant_id: TENANT_ID }),
    supabase.rpc("get_critical_items", {
      p_tenant_id: TENANT_ID,
      p_limit: 5,
    }),
    supabase
      .from("item_costing")
      .select("sku, annual_demand_units")
      .eq("tenant_id", TENANT_ID)
      .eq("source_system", "gp-dynamics")
      .gt("annual_demand_units", 0)
      .order("annual_demand_units", { ascending: false })
      .limit(10),
    supabase.rpc("get_category_value", { p_tenant_id: TENANT_ID }),
    getLatestConnectorHeartbeat(),
  ]);

  if (totalSkusError) {
    console.warn("Failed to count dashboard SKUs:", totalSkusError.message);
  }

  if (inventoryValueError) {
    console.warn(
      "Failed to fetch dashboard inventory value:",
      inventoryValueError.message
    );
  }

  if (statusCountsError) {
    console.warn(
      "Failed to fetch dashboard status counts:",
      statusCountsError.message
    );
  }

  if (criticalItemsError) {
    console.warn(
      "Failed to fetch dashboard critical items:",
      criticalItemsError.message
    );
  }

  if (topDemandError) {
    console.warn("Failed to fetch dashboard top demand:", topDemandError.message);
  }

  if (categoryValueError) {
    console.warn(
      "Failed to fetch dashboard category value:",
      categoryValueError.message
    );
  }

  const statusCounts = parseInventoryStatusCounts(statusCountsRaw);
  const criticalItems = ((criticalItemsRaw ?? []) as CriticalViewRow[]).map(
    mapCriticalViewRowToRecommendation
  );
  const topDemand = ((topDemandRaw ?? []) as TopDemandCostRow[]).map((row) => ({
    sku: row.sku,
    name: row.sku,
    demand: toNumber(row.annual_demand_units),
  }));

  return {
    totalSkus: totalSkus ?? 0,
    totalInventoryValue: toNumber(inventoryValue),
    itemsBelowReorderLevel: statusCounts?.reorder_needed ?? 0,
    criticalCount: statusCounts?.critical ?? 0,
    connectorHealth: getConnectorHealthState(heartbeat?.sent_at ?? null),
    topDemand,
    categoryValue: parseCategoryValue(categoryValueRaw),
    statusCounts: {
      critical: statusCounts?.critical ?? 0,
      watch: 0,
      reorder_needed: statusCounts?.reorder_needed ?? 0,
      ok: statusCounts?.ok ?? 0,
      no_demand: statusCounts?.no_demand ?? 0,
    },
    criticalItems,
  };
});

export const getDashboardData = cache(async (): Promise<DashboardData> => {  const supabase = createAdminClient();

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
});
