import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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

/** True when item_supplier_reference has a row for this SKU + supplier. */
export async function supplierExistsForSku(
  sku: string,
  supplierExternalId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("item_supplier_reference")
    .select("sku")
    .eq("tenant_id", TENANT_ID)
    .eq("sku", sku)
    .eq("supplier_external_id", supplierExternalId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data != null;
}
