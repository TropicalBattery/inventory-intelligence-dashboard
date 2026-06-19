"use server";

import { revalidatePath } from "next/cache";
import { parseReferenceInput } from "@/lib/reference-data/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import type { ReferenceDataActionResult } from "@/lib/types";

function revalidateReferenceData() {
  revalidatePath("/reference-data");
}

function mapDatabaseError(message: string): string {
  if (message.includes("item_supplier_reference_tenant_id_sku_supplier_external_id_key")) {
    return "A reference row already exists for this SKU and supplier combination";
  }

  return message;
}

export async function createReferenceRow(
  formData: FormData
): Promise<ReferenceDataActionResult> {
  const parsed = parseReferenceInput(formData);

  if (parsed.error || !parsed.data) {
    return { success: false, error: parsed.error ?? "Invalid input" };
  }

  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from("item_supplier_reference").insert({
      tenant_id: TENANT_ID,
      sku: parsed.data.sku,
      supplier_external_id: parsed.data.supplier_external_id,
      vendor_item_number: parsed.data.vendor_item_number,
      lead_time_days: parsed.data.lead_time_days,
      safety_stock_months: parsed.data.safety_stock_months,
      qty_in_transit: parsed.data.qty_in_transit,
      qty_in_bond: parsed.data.qty_in_bond,
      qty_at_port: parsed.data.qty_at_port,
      qty_in_clearing: parsed.data.qty_in_clearing,
      reliability_rating: parsed.data.reliability_rating,
      supplier_region: parsed.data.supplier_region,
      min_order_qty: parsed.data.min_order_qty,
      pallet_qty: parsed.data.pallet_qty,
      container_qty: parsed.data.container_qty,
      is_priority_vendor: parsed.data.is_priority_vendor,
      ordering_cost_per_order: parsed.data.ordering_cost_per_order,
      holding_cost_per_unit_year: parsed.data.holding_cost_per_unit_year,
      unit_price: parsed.data.unit_price,
      currency: parsed.data.currency,
      notes: parsed.data.notes,
    });

    if (error) {
      return { success: false, error: mapDatabaseError(error.message) };
    }

    revalidateReferenceData();
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create reference row";
    return { success: false, error: message };
  }
}

export async function updateReferenceRow(
  id: string,
  formData: FormData
): Promise<ReferenceDataActionResult> {
  const parsed = parseReferenceInput(formData);

  if (parsed.error || !parsed.data) {
    return { success: false, error: parsed.error ?? "Invalid input" };
  }

  if (!id) {
    return { success: false, error: "Row id is required" };
  }

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("item_supplier_reference")
      .update({
        sku: parsed.data.sku,
        supplier_external_id: parsed.data.supplier_external_id,
        vendor_item_number: parsed.data.vendor_item_number,
        lead_time_days: parsed.data.lead_time_days,
        safety_stock_months: parsed.data.safety_stock_months,
        qty_in_transit: parsed.data.qty_in_transit,
        qty_in_bond: parsed.data.qty_in_bond,
        qty_at_port: parsed.data.qty_at_port,
        qty_in_clearing: parsed.data.qty_in_clearing,
        reliability_rating: parsed.data.reliability_rating,
        supplier_region: parsed.data.supplier_region,
        min_order_qty: parsed.data.min_order_qty,
        pallet_qty: parsed.data.pallet_qty,
        container_qty: parsed.data.container_qty,
        is_priority_vendor: parsed.data.is_priority_vendor,
        ordering_cost_per_order: parsed.data.ordering_cost_per_order,
        holding_cost_per_unit_year: parsed.data.holding_cost_per_unit_year,
        unit_price: parsed.data.unit_price,
        currency: parsed.data.currency,
        notes: parsed.data.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", TENANT_ID);

    if (error) {
      return { success: false, error: mapDatabaseError(error.message) };
    }

    revalidateReferenceData();
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update reference row";
    return { success: false, error: message };
  }
}

export async function deleteReferenceRow(
  id: string
): Promise<ReferenceDataActionResult> {
  if (!id) {
    return { success: false, error: "Row id is required" };
  }

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("item_supplier_reference")
      .delete()
      .eq("id", id)
      .eq("tenant_id", TENANT_ID);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateReferenceData();
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete reference row";
    return { success: false, error: message };
  }
}
