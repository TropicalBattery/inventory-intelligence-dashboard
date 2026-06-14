"use server";

import { revalidatePath } from "next/cache";
import {
  computeLineTotal,
  sumKnownLineTotals,
} from "@/lib/po/line-cost";
import { generatePoNumber } from "@/lib/po/po-number";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import type {
  GeneratePurchaseOrderInput,
  PurchaseOrderActionResult,
} from "@/lib/types";

function revalidatePurchaseOrderPaths() {
  revalidatePath("/purchase-orders");
  revalidatePath("/purchase-orders/new");
}

export async function generatePurchaseOrder(
  input: GeneratePurchaseOrderInput
): Promise<PurchaseOrderActionResult> {
  if (!input.supplierExternalId.trim()) {
    return { success: false, error: "Supplier is required" };
  }

  if (input.lines.length === 0) {
    return { success: false, error: "At least one line item is required" };
  }

  const linesWithQuantity = input.lines.filter((line) => line.quantity > 0);
  if (linesWithQuantity.length === 0) {
    return {
      success: false,
      error:
        "At least one line item must have a quantity greater than 0 before generating a purchase order",
    };
  }

  for (const line of input.lines) {
    if (!line.sku.trim()) {
      return { success: false, error: "Each line must include a SKU" };
    }

    if (line.quantity < 0) {
      return {
        success: false,
        error: "Line quantities must be greater than or equal to 0",
      };
    }

    if (line.unitCost !== null && line.unitCost < 0) {
      return {
        success: false,
        error: "Unit costs must be greater than or equal to 0",
      };
    }
  }

  const supabase = createAdminClient();
  const poNumber = await generatePoNumber();
  const now = new Date().toISOString();
  const lineRowsForTotal = input.lines.map((line) => ({
    lineTotal: computeLineTotal(line.quantity, line.unitCost),
  }));
  const totalAmount = sumKnownLineTotals(lineRowsForTotal);

  const { data: purchaseOrder, error: orderError } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: TENANT_ID,
      external_id: poNumber,
      po_number: poNumber,
      supplier_external_id: input.supplierExternalId,
      po_date: now,
      status: "draft",
      total_amount: totalAmount,
      memo: input.memo,
      source_system: "dashboard",
      source_updated_at: now,
    })
    .select("id")
    .single();

  if (orderError || !purchaseOrder) {
    return {
      success: false,
      error: orderError?.message ?? "Failed to create purchase order",
    };
  }

  const lineRows = input.lines.map((line, index) => {
    const lineIndex = String(index + 1).padStart(3, "0");
    const lineTotal = computeLineTotal(line.quantity, line.unitCost);

    return {
      tenant_id: TENANT_ID,
      external_id: `${poNumber}-${lineIndex}`,
      po_external_id: poNumber,
      po_number: poNumber,
      product_external_id: line.productExternalId,
      sku: line.sku,
      quantity_ordered: line.quantity,
      unit_cost: line.unitCost,
      line_total: lineTotal,
      source_system: "dashboard",
      source_updated_at: now,
    };
  });

  const { error: linesError } = await supabase
    .from("purchase_order_lines")
    .insert(lineRows);

  if (linesError) {
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
    return {
      success: false,
      error: linesError.message ?? "Failed to create purchase order lines",
    };
  }

  revalidatePurchaseOrderPaths();
  return { success: true, purchaseOrderId: purchaseOrder.id };
}
