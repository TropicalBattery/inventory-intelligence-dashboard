import { TENANT_ID } from "@/lib/tenant";
import type { ItemSupplierReferenceRow, ProductOption, SupplierOption } from "@/lib/types";

function placeholderRowId(sku: string, supplierExternalId: string): string {
  return `no-quote:${sku}:${supplierExternalId}`;
}

export function isPlaceholderReferenceRow(row: ItemSupplierReferenceRow): boolean {
  return row.hasQuoteOnFile === false;
}

function createPlaceholderReferenceRow(
  sku: string,
  supplier: SupplierOption,
  productName: string | null
): ItemSupplierReferenceRow {
  return {
    id: placeholderRowId(sku, supplier.external_id),
    tenant_id: TENANT_ID,
    sku,
    supplier_external_id: supplier.external_id,
    vendor_item_number: null,
    lead_time_days: null,
    safety_stock_months: null,
    qty_in_transit: null,
    qty_in_bond: null,
    qty_at_port: null,
    qty_in_clearing: null,
    pallet_qty: null,
    container_qty: null,
    is_priority_vendor: false,
    ordering_cost_per_order: null,
    holding_cost_per_unit_year: null,
    unit_price: null,
    currency: null,
    reliability_rating: null,
    supplier_region: null,
    min_order_qty: null,
    notes: null,
    created_at: "",
    updated_at: "",
    product_name: productName,
    supplier_name: supplier.name,
    hasQuoteOnFile: false,
  };
}

export function resolveSingleSkuForSupplierComparison(
  search: string,
  products: ProductOption[],
  filteredRows: ItemSupplierReferenceRow[]
): string | null {
  const query = search.trim();
  if (!query) {
    return null;
  }

  const exactProduct = products.find(
    (product) => product.sku.toLowerCase() === query.toLowerCase()
  );
  if (exactProduct) {
    return exactProduct.sku;
  }

  const skusInResults = new Set(filteredRows.map((row) => row.sku));
  if (skusInResults.size === 1) {
    return filteredRows[0]?.sku ?? null;
  }

  return null;
}

export function appendMissingSupplierPlaceholderRows(
  rows: ItemSupplierReferenceRow[],
  sku: string,
  products: ProductOption[],
  suppliers: SupplierOption[]
): ItemSupplierReferenceRow[] {
  const productName = products.find((product) => product.sku === sku)?.name ?? null;
  const existingSupplierIds = new Set(
    rows.filter((row) => row.sku === sku).map((row) => row.supplier_external_id)
  );

  const placeholders = suppliers
    .filter((supplier) => !existingSupplierIds.has(supplier.external_id))
    .map((supplier) => createPlaceholderReferenceRow(sku, supplier, productName));

  if (placeholders.length === 0) {
    return rows;
  }

  return [...rows, ...placeholders].sort((left, right) => {
    const skuCompare = left.sku.localeCompare(right.sku);
    if (skuCompare !== 0) {
      return skuCompare;
    }

    const leftSupplier = left.supplier_name ?? left.supplier_external_id;
    const rightSupplier = right.supplier_name ?? right.supplier_external_id;
    return leftSupplier.localeCompare(rightSupplier);
  });
}
