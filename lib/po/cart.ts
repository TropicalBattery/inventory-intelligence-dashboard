import { createAdminClient } from "@/lib/supabase/admin";
import { getSupplierNameMap } from "@/lib/queries/suppliers";
import { TENANT_ID } from "@/lib/tenant";
import type { PoCartGroup, PoCartItem, PoCartResponse } from "@/lib/types";

type PoCartItemRow = {
  id: string;
  tenant_id: string;
  created_by: string;
  sku: string;
  product_name: string | null;
  quantity: number | string;
  supplier_external_id: string | null;
  unit_price: number | string | null;
  currency: string | null;
  source_status: string | null;
  added_at: string;
  updated_at: string;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapCartRow(
  row: PoCartItemRow,
  unitOfMeasure: string | null = null
): PoCartItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    sku: row.sku,
    productName: row.product_name,
    unitOfMeasure,
    quantity: toNumber(row.quantity) ?? 0,
    supplierExternalId: row.supplier_external_id,
    unitPrice: toNumber(row.unit_price),
    currency: row.currency,
    sourceStatus: row.source_status,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

export async function lookupUnitOfMeasureBySkus(
  skus: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const unique = Array.from(new Set(skus.filter(Boolean)));
  if (unique.length === 0) {
    return result;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("sku, unit_of_measure")
    .eq("tenant_id", TENANT_ID)
    .in("sku", unique);

  if (error) {
    console.error("Failed to look up unit_of_measure:", error.message);
    return result;
  }

  for (const row of (data ?? []) as Array<{
    sku: string;
    unit_of_measure: string | null;
  }>) {
    result.set(row.sku, row.unit_of_measure);
  }

  return result;
}

export async function mapCartRowsWithUom(
  rows: PoCartItemRow[]
): Promise<PoCartItem[]> {
  const uomBySku = await lookupUnitOfMeasureBySkus(rows.map((row) => row.sku));
  return rows.map((row) => mapCartRow(row, uomBySku.get(row.sku) ?? null));
}

function groupKey(supplierExternalId: string | null): string {
  return supplierExternalId?.trim() ? supplierExternalId : "UNASSIGNED";
}

export function buildCartResponse(
  items: PoCartItem[],
  supplierNames: Map<string, string>
): PoCartResponse {
  const bySupplier = new Map<string, PoCartItem[]>();

  for (const item of items) {
    const key = groupKey(item.supplierExternalId);
    const list = bySupplier.get(key) ?? [];
    list.push(item);
    bySupplier.set(key, list);
  }

  const groups: PoCartGroup[] = Array.from(bySupplier.entries()).map(
    ([key, groupItems]) => {
      const supplierExternalId = key === "UNASSIGNED" ? null : key;
      let knownSubtotal = 0;
      let hasPrice = false;

      for (const item of groupItems) {
        if (item.unitPrice !== null && Number.isFinite(item.unitPrice)) {
          knownSubtotal += item.quantity * item.unitPrice;
          hasPrice = true;
        }
      }

      return {
        supplierExternalId,
        supplierName: supplierExternalId
          ? (supplierNames.get(supplierExternalId) ?? null)
          : null,
        items: groupItems.sort((a, b) => a.sku.localeCompare(b.sku)),
        subtotalUsd: hasPrice ? knownSubtotal : null,
      };
    }
  );

  groups.sort((left, right) => {
    if (left.supplierExternalId === null && right.supplierExternalId !== null) {
      return 1;
    }
    if (right.supplierExternalId === null && left.supplierExternalId !== null) {
      return -1;
    }

    const leftName = left.supplierName ?? left.supplierExternalId ?? "";
    const rightName = right.supplierName ?? right.supplierExternalId ?? "";
    return leftName.localeCompare(rightName);
  });

  return {
    groups,
    totalItems: items.length,
  };
}

export async function fetchUserCartItems(
  createdBy: string
): Promise<PoCartItemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("po_cart_items")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", createdBy)
    .order("sku", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PoCartItemRow[];
}

export async function lookupSupplierUnitPrice(
  sku: string,
  supplierExternalId: string
): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("item_supplier_reference")
    .select("unit_price")
    .eq("tenant_id", TENANT_ID)
    .eq("sku", sku)
    .eq("supplier_external_id", supplierExternalId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return toNumber(
    (data as { unit_price: number | string | null } | null)?.unit_price
  );
}

export async function lookupSupplierNames(
  supplierExternalIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (supplierExternalIds.length === 0) {
    return names;
  }

  const allNames = await getSupplierNameMap();
  for (const id of supplierExternalIds) {
    const name = allNames.get(id);
    if (name) {
      names.set(id, name);
    }
  }

  return names;
}
