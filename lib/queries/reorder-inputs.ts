import {
  isPrimarySiteBalanceRow,
} from "@/lib/inventory/primary-site-levels";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { toNumber } from "@/lib/format";
import { TENANT_ID } from "@/lib/tenant";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupplierReference, VwReorderInputsRow } from "@/lib/types";

type ProductRow = {
  sku: string | null;
  name: string | null;
  item_class: string | null;
  category: string | null;
  external_id: string;
};

type InventoryBalanceAggregateRow = {
  sku: string | null;
  external_id: string | null;
  quantity_on_hand: number | string | null;
  quantity_available: number | string | null;
  quantity_on_order: number | string | null;
  quantity_in_transit: number | string | null;
  quantity_in_bond: number | string | null;
  quantity_at_port: number | string | null;
  quantity_in_clearing: number | string | null;
  reorder_level: number | string | null;
  maximum_stock_level: number | string | null;
};

type SkuInventoryAggregate = {
  quantity_on_hand: number;
  quantity_available: number;
  quantity_on_order: number;
  quantity_in_transit: number;
  quantity_in_bond: number;
  quantity_at_port: number;
  quantity_in_clearing: number;
  reorder_level: number;
  maximum_stock_level: number;
};

type ItemCostingRow = {
  sku: string | null;
  product_external_id: string | null;
  annual_demand_units: number | string | null;
  avg_daily_demand_units: number | string | null;
  current_cost_local: number | string | null;
  ordering_cost_per_order: number | string | null;
  holding_cost_per_unit_year: number | string | null;
  source_updated_at: string | null;
};

type SupplierReferenceRow = {
  sku: string;
  supplier_external_id: string;
  lead_time_days: number | string | null;
  pallet_qty: number | string | null;
  container_qty: number | string | null;
  is_priority_vendor: boolean | null;
  ordering_cost_per_order: number | string | null;
  holding_cost_per_unit_year: number | string | null;
  unit_price: number | string | null;
};

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isNewerCostingRow(
  candidate: ItemCostingRow,
  current: ItemCostingRow | undefined
): boolean {
  if (!current) {
    return true;
  }

  return (
    parseTimestamp(candidate.source_updated_at) >
    parseTimestamp(current.source_updated_at)
  );
}

function isBetterSupplierReference(
  candidate: SupplierReferenceRow,
  current: SupplierReferenceRow | undefined
): boolean {
  if (!current) {
    return true;
  }

  const candidatePriority = Boolean(candidate.is_priority_vendor);
  const currentPriority = Boolean(current.is_priority_vendor);

  if (candidatePriority !== currentPriority) {
    return candidatePriority;
  }

  const candidatePrice = candidate.unit_price ?? Number.POSITIVE_INFINITY;
  const currentPrice = current.unit_price ?? Number.POSITIVE_INFINITY;

  if (candidatePrice !== currentPrice) {
    return toNumber(candidatePrice) < toNumber(currentPrice);
  }

  return candidate.supplier_external_id.localeCompare(
    current.supplier_external_id
  ) < 0;
}

async function fetchProducts(
  supabase: SupabaseClient
): Promise<ProductRow[]> {
  return fetchAllPages<ProductRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("products")
      .select("sku, name, item_class, category, external_id")
      .eq("tenant_id", TENANT_ID)
      .not("sku", "is", null)
      .order("sku", { ascending: true })
      .range(from, to);

    return { data, error };
  });
}

async function fetchInventoryAggregatesBySku(
  supabase: SupabaseClient
): Promise<Map<string, SkuInventoryAggregate>> {
  const aggregatesBySku = new Map<string, SkuInventoryAggregate>();

  const rows = await fetchAllPages<InventoryBalanceAggregateRow>(
    async (from, to) => {
      const { data, error } = await supabase
        .from("inventory_balances")
        .select(
          "sku, external_id, quantity_on_hand, quantity_available, quantity_on_order, quantity_in_transit, quantity_in_bond, quantity_at_port, quantity_in_clearing, reorder_level, maximum_stock_level"
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

    const existing = aggregatesBySku.get(row.sku) ?? {
      quantity_on_hand: 0,
      quantity_available: 0,
      quantity_on_order: 0,
      quantity_in_transit: 0,
      quantity_in_bond: 0,
      quantity_at_port: 0,
      quantity_in_clearing: 0,
      reorder_level: 0,
      maximum_stock_level: 0,
    };

    existing.quantity_on_hand += toNumber(row.quantity_on_hand);
    existing.quantity_available += toNumber(row.quantity_available);
    existing.quantity_on_order += toNumber(row.quantity_on_order);
    existing.quantity_in_transit += toNumber(row.quantity_in_transit);
    existing.quantity_in_bond += toNumber(row.quantity_in_bond);
    existing.quantity_at_port += toNumber(row.quantity_at_port);
    existing.quantity_in_clearing += toNumber(row.quantity_in_clearing);

    if (isPrimarySiteBalanceRow(row)) {
      existing.reorder_level = toNumber(row.reorder_level);
      existing.maximum_stock_level = toNumber(row.maximum_stock_level);
    }

    aggregatesBySku.set(row.sku, existing);
  }

  return aggregatesBySku;
}

async function fetchBestCostingMaps(supabase: SupabaseClient): Promise<{
  bySku: Map<string, ItemCostingRow>;
  byProductExternalId: Map<string, ItemCostingRow>;
}> {
  const bySku = new Map<string, ItemCostingRow>();
  const byProductExternalId = new Map<string, ItemCostingRow>();

  const rows = await fetchAllPages<ItemCostingRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("item_costing")
      .select(
        "sku, product_external_id, annual_demand_units, avg_daily_demand_units, current_cost_local, ordering_cost_per_order, holding_cost_per_unit_year, source_updated_at"
      )
      .eq("tenant_id", TENANT_ID)
      .order("sku", { ascending: true })
      .range(from, to);

    return { data, error };
  });

  for (const row of rows) {
    if (row.sku) {
      const current = bySku.get(row.sku);
      if (isNewerCostingRow(row, current)) {
        bySku.set(row.sku, row);
      }
    }

    if (row.product_external_id) {
      const current = byProductExternalId.get(row.product_external_id);
      if (isNewerCostingRow(row, current)) {
        byProductExternalId.set(row.product_external_id, row);
      }
    }
  }

  return { bySku, byProductExternalId };
}

async function fetchBestSupplierReferenceBySku(
  supabase: SupabaseClient
): Promise<Map<string, SupplierReferenceRow>> {
  const bestBySku = new Map<string, SupplierReferenceRow>();

  const rows = await fetchAllPages<SupplierReferenceRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("item_supplier_reference")
      .select(
        "sku, supplier_external_id, lead_time_days, pallet_qty, container_qty, is_priority_vendor, ordering_cost_per_order, holding_cost_per_unit_year, unit_price"
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

    const current = bestBySku.get(row.sku);
    if (isBetterSupplierReference(row, current)) {
      bestBySku.set(row.sku, row);
    }
  }

  return bestBySku;
}

function resolveCostingForProduct(
  product: ProductRow,
  costingBySku: Map<string, ItemCostingRow>,
  costingByProductExternalId: Map<string, ItemCostingRow>
): ItemCostingRow | undefined {
  if (!product.sku) {
    return undefined;
  }

  return (
    costingBySku.get(product.sku) ??
    costingByProductExternalId.get(product.external_id)
  );
}

function buildReorderInputRow(
  product: ProductRow,
  inventory: SkuInventoryAggregate | undefined,
  costing: ItemCostingRow | undefined,
  supplier: SupplierReferenceRow | undefined
): VwReorderInputsRow | null {
  if (!product.sku) {
    return null;
  }

  const inv = inventory ?? {
    quantity_on_hand: 0,
    quantity_available: 0,
    quantity_on_order: 0,
    quantity_in_transit: 0,
    quantity_in_bond: 0,
    quantity_at_port: 0,
    quantity_in_clearing: 0,
    reorder_level: 0,
    maximum_stock_level: 0,
  };

  const icOrderingCost = costing?.ordering_cost_per_order ?? null;
  const icHoldingCost = costing?.holding_cost_per_unit_year ?? null;

  return {
    tenant_id: TENANT_ID,
    sku: product.sku,
    name: product.name,
    item_class: product.item_class,
    category: product.category,
    quantity_on_hand: inv.quantity_on_hand,
    quantity_available: inv.quantity_available,
    quantity_on_order: inv.quantity_on_order,
    quantity_in_transit: inv.quantity_in_transit,
    quantity_in_bond: inv.quantity_in_bond,
    quantity_at_port: inv.quantity_at_port,
    quantity_in_clearing: inv.quantity_in_clearing,
    reorder_level: inv.reorder_level,
    maximum_stock_level: inv.maximum_stock_level,
    annual_demand_units: costing?.annual_demand_units
      ? toNumber(costing.annual_demand_units)
      : null,
    avg_daily_demand_units: costing?.avg_daily_demand_units
      ? toNumber(costing.avg_daily_demand_units)
      : null,
    current_cost_local: costing?.current_cost_local
      ? toNumber(costing.current_cost_local)
      : null,
    ordering_cost_per_order:
      supplier?.ordering_cost_per_order != null
        ? toNumber(supplier.ordering_cost_per_order)
        : icOrderingCost != null
          ? toNumber(icOrderingCost)
          : null,
    holding_cost_per_unit_year:
      supplier?.holding_cost_per_unit_year != null
        ? toNumber(supplier.holding_cost_per_unit_year)
        : icHoldingCost != null
          ? toNumber(icHoldingCost)
          : null,
    best_supplier_external_id: supplier?.supplier_external_id ?? null,
    best_unit_price:
      supplier?.unit_price != null ? toNumber(supplier.unit_price) : null,
    lead_time_days:
      supplier?.lead_time_days != null
        ? toNumber(supplier.lead_time_days)
        : null,
    pallet_qty:
      supplier?.pallet_qty != null ? toNumber(supplier.pallet_qty) : null,
    container_qty:
      supplier?.container_qty != null
        ? toNumber(supplier.container_qty)
        : null,
  };
}

export async function fetchAllReorderInputRows(
  supabase: SupabaseClient = createAdminClient()
): Promise<VwReorderInputsRow[]> {
  try {
    const [products, inventoryBySku, costingMaps, supplierBySku] =
      await Promise.all([
        fetchProducts(supabase),
        fetchInventoryAggregatesBySku(supabase),
        fetchBestCostingMaps(supabase),
        fetchBestSupplierReferenceBySku(supabase),
      ]);

    const rows: VwReorderInputsRow[] = [];

    for (const product of products) {
      const row = buildReorderInputRow(
        product,
        product.sku ? inventoryBySku.get(product.sku) : undefined,
        resolveCostingForProduct(
          product,
          costingMaps.bySku,
          costingMaps.byProductExternalId
        ),
        product.sku ? supplierBySku.get(product.sku) : undefined
      );

      if (row) {
        rows.push(row);
      }
    }

    return rows;
  } catch (error) {
    console.error(
      "Failed to assemble reorder input rows:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

export async function fetchReorderInputRowBySku(
  sku: string,
  supabase: SupabaseClient = createAdminClient()
): Promise<VwReorderInputsRow | null> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("sku, name, item_class, category, external_id")
    .eq("tenant_id", TENANT_ID)
    .eq("sku", sku)
    .maybeSingle();

  if (productError || !product?.sku) {
    return null;
  }

  const [inventoryRows, costingRows, supplierRows] = await Promise.all([
    supabase
      .from("inventory_balances")
      .select(
        "sku, external_id, quantity_on_hand, quantity_available, quantity_on_order, quantity_in_transit, quantity_in_bond, quantity_at_port, quantity_in_clearing, reorder_level, maximum_stock_level"
      )
      .eq("tenant_id", TENANT_ID)
      .eq("sku", sku),
    supabase
      .from("item_costing")
      .select(
        "sku, product_external_id, annual_demand_units, avg_daily_demand_units, current_cost_local, ordering_cost_per_order, holding_cost_per_unit_year, source_updated_at"
      )
      .eq("tenant_id", TENANT_ID)
      .or(`sku.eq.${sku},product_external_id.eq.${product.external_id}`),
    supabase
      .from("item_supplier_reference")
      .select(
        "sku, supplier_external_id, lead_time_days, pallet_qty, container_qty, is_priority_vendor, ordering_cost_per_order, holding_cost_per_unit_year, unit_price"
      )
      .eq("tenant_id", TENANT_ID)
      .eq("sku", sku),
  ]);

  const inventory = aggregateInventoryRows(
    (inventoryRows.data ?? []) as InventoryBalanceAggregateRow[]
  );
  const costing = pickBestCostingRow(
    (costingRows.data ?? []) as ItemCostingRow[]
  );
  const supplier = pickBestSupplierReference(
    (supplierRows.data ?? []) as SupplierReferenceRow[]
  );

  return buildReorderInputRow(product, inventory, costing, supplier);
}

function aggregateInventoryRows(
  rows: InventoryBalanceAggregateRow[]
): SkuInventoryAggregate {
  const aggregate: SkuInventoryAggregate = {
    quantity_on_hand: 0,
    quantity_available: 0,
    quantity_on_order: 0,
    quantity_in_transit: 0,
    quantity_in_bond: 0,
    quantity_at_port: 0,
    quantity_in_clearing: 0,
    reorder_level: 0,
    maximum_stock_level: 0,
  };

  for (const row of rows) {
    aggregate.quantity_on_hand += toNumber(row.quantity_on_hand);
    aggregate.quantity_available += toNumber(row.quantity_available);
    aggregate.quantity_on_order += toNumber(row.quantity_on_order);
    aggregate.quantity_in_transit += toNumber(row.quantity_in_transit);
    aggregate.quantity_in_bond += toNumber(row.quantity_in_bond);
    aggregate.quantity_at_port += toNumber(row.quantity_at_port);
    aggregate.quantity_in_clearing += toNumber(row.quantity_in_clearing);

    if (isPrimarySiteBalanceRow(row)) {
      aggregate.reorder_level = toNumber(row.reorder_level);
      aggregate.maximum_stock_level = toNumber(row.maximum_stock_level);
    }
  }

  return aggregate;
}

function pickBestCostingRow(rows: ItemCostingRow[]): ItemCostingRow | undefined {
  let best: ItemCostingRow | undefined;

  for (const row of rows) {
    if (isNewerCostingRow(row, best)) {
      best = row;
    }
  }

  return best;
}

function pickBestSupplierReference(
  rows: SupplierReferenceRow[]
): SupplierReferenceRow | undefined {
  let best: SupplierReferenceRow | undefined;

  for (const row of rows) {
    if (isBetterSupplierReference(row, best)) {
      best = row;
    }
  }

  return best;
}

type ItemSupplierReferenceQueryRow = {
  sku: string;
  supplier_external_id: string;
  unit_price: number | string | null;
  lead_time_days: number | string | null;
  is_priority_vendor: boolean | null;
  vendor_item_number: string | null;
  currency: string | null;
};

function sortSupplierReferences(
  suppliers: SupplierReference[]
): SupplierReference[] {
  return [...suppliers].sort((left, right) => {
    if (left.isPriorityVendor !== right.isPriorityVendor) {
      return left.isPriorityVendor ? -1 : 1;
    }

    const leftPrice = left.unitPrice ?? Number.POSITIVE_INFINITY;
    const rightPrice = right.unitPrice ?? Number.POSITIVE_INFINITY;

    if (leftPrice !== rightPrice) {
      return leftPrice - rightPrice;
    }

    return left.supplierExternalId.localeCompare(right.supplierExternalId);
  });
}

function mapItemSupplierReferenceRow(
  row: ItemSupplierReferenceQueryRow
): SupplierReference {
  return {
    supplierExternalId: row.supplier_external_id,
    unitPrice:
      row.unit_price !== null && row.unit_price !== undefined
        ? toNumber(row.unit_price)
        : null,
    leadTimeDays:
      row.lead_time_days !== null && row.lead_time_days !== undefined
        ? toNumber(row.lead_time_days)
        : null,
    isPriorityVendor: Boolean(row.is_priority_vendor),
    vendorItemNumber: row.vendor_item_number,
    currency: row.currency ?? "JMD",
  };
}

export async function getSuppliersBySkus(
  skus: string[],
  tenantId: string
): Promise<Map<string, SupplierReference[]>> {
  if (skus.length === 0) {
    return new Map();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("item_supplier_reference")
    .select(
      "sku, supplier_external_id, unit_price, lead_time_days, is_priority_vendor, vendor_item_number, currency"
    )
    .eq("tenant_id", tenantId)
    .in("sku", skus);

  if (error) {
    console.error("Failed to fetch suppliers by SKU:", error.message);
    return new Map();
  }

  const suppliersBySku = new Map<string, SupplierReference[]>();

  for (const row of (data ?? []) as ItemSupplierReferenceQueryRow[]) {
    if (!row.sku) {
      continue;
    }

    const suppliers = suppliersBySku.get(row.sku) ?? [];
    suppliers.push(mapItemSupplierReferenceRow(row));
    suppliersBySku.set(row.sku, suppliers);
  }

  for (const [sku, suppliers] of Array.from(suppliersBySku.entries())) {
    suppliersBySku.set(sku, sortSupplierReferences(suppliers));
  }

  return suppliersBySku;
}
