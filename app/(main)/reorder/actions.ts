"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export type DraftPoSelectionItem = {
  sku: string;
  supplierExternalId: string | null;
  suggestedQty: number;
};

export type CreateDraftPoResult = {
  success: boolean;
  error?: string;
};

export async function createDraftPoSelection(
  items: DraftPoSelectionItem[]
): Promise<CreateDraftPoResult> {
  if (items.length === 0) {
    return { success: false, error: "No items selected" };
  }

  for (const item of items) {
    if (!item.sku.trim()) {
      return { success: false, error: "Each selection must include a SKU" };
    }

    if (item.suggestedQty < 0) {
      return {
        success: false,
        error: "Suggested quantity must be greater than or equal to 0",
      };
    }
  }

  const supabase = createAdminClient();
  const batchId = crypto.randomUUID();

  const rows = items.map((item) => ({
    batch_id: batchId,
    tenant_id: TENANT_ID,
    sku: item.sku,
    supplier_external_id: item.supplierExternalId,
    suggested_qty: item.suggestedQty,
  }));

  const { error } = await supabase.from("draft_po_selections").insert(rows);

  if (error) {
    return { success: false, error: error.message };
  }

  redirect(`/purchase-orders/new?batch=${batchId}`);
}
