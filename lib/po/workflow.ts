import type { UserRole } from "@/lib/auth/role-guards";
import { formatCurrencyUSD } from "@/lib/format";
import { emitNotification } from "@/lib/notifications/emit";
import { fetchUserCartItems, mapCartRow } from "@/lib/po/cart";
import {
  canTransition,
  isPoStatus,
  logPoAudit,
  transitionAction,
  type PoStatus,
} from "@/lib/po/approval";
import {
  computeLineTotal,
  hasUnknownLineCosts,
  sumKnownLineTotals,
} from "@/lib/po/line-cost";
import { generatePoNumber } from "@/lib/po/po-number";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export class PoWorkflowError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PoWorkflowError";
    this.status = status;
  }
}

export type TransitionPurchaseOrderInput = {
  purchaseOrderId: string;
  toStatus: PoStatus;
  actorUserId: string;
  actorEmail: string;
  actorRole: UserRole;
  note?: string;
};

export type TransitionResult = {
  purchaseOrderId: string;
  poNumber: string;
  fromStatus: PoStatus;
  toStatus: PoStatus;
  status: PoStatus;
};

export type ValidateTransitionInput = {
  fromStatus: string;
  toStatus: PoStatus;
  actorEmail: string;
  actorRole: UserRole;
  createdBy: string | null;
  note?: string | null;
};

export function validateTransitionRequest(
  input: ValidateTransitionInput
): { ok: true; fromStatus: PoStatus; note: string | null } {
  const { fromStatus, toStatus, actorEmail, actorRole, createdBy, note } = input;
  if (!isPoStatus(fromStatus) || !canTransition(fromStatus, toStatus)) {
    throw new PoWorkflowError(
      400,
      `Cannot move a ${fromStatus} PO to ${toStatus}`
    );
  }

  if (toStatus === "approved") {
    if (actorRole !== "approver") {
      throw new PoWorkflowError(403, "Only approvers can approve purchase orders");
    }
    const creator = createdBy?.trim().toLowerCase() ?? "";
    if (creator && creator === actorEmail.trim().toLowerCase()) {
      throw new PoWorkflowError(
        403,
        "You cannot approve a purchase order you created"
      );
    }
  }

  const trimmedNote = typeof note === "string" ? note.trim() : "";
  if (fromStatus === "pending_approval" && toStatus === "draft" && !trimmedNote) {
    throw new PoWorkflowError(
      400,
      "A comment is required when returning a purchase order to the buyer."
    );
  }

  return { ok: true, fromStatus, note: trimmedNote || null };
}

export async function transitionPurchaseOrder(
  input: TransitionPurchaseOrderInput
): Promise<TransitionResult> {
  void input.actorUserId;
  const supabase = createAdminClient();
  const purchaseOrderId = input.purchaseOrderId.trim();
  if (!purchaseOrderId) {
    throw new PoWorkflowError(400, "PO id is required");
  }

  const { data: order, error: loadError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, tenant_id, created_by, total_amount")
    .eq("id", purchaseOrderId)
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();

  if (loadError) {
    throw new PoWorkflowError(500, loadError.message);
  }
  if (!order) {
    throw new PoWorkflowError(404, "Purchase order not found");
  }

  const validated = validateTransitionRequest({
    fromStatus: (order.status ?? "draft").trim(),
    toStatus: input.toStatus,
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    createdBy: typeof order.created_by === "string" ? order.created_by : null,
    note: input.note,
  });

  const action = transitionAction(validated.fromStatus, input.toStatus);
  if (!action) {
    throw new PoWorkflowError(
      400,
      `Cannot move a ${validated.fromStatus} PO to ${input.toStatus}`
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: input.toStatus,
    source_updated_at: now,
  };
  if (input.toStatus === "sent") {
    updates.sent_at = now;
  }

  const { data: updated, error: updateError } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", purchaseOrderId)
    .eq("tenant_id", TENANT_ID)
    .select("id, po_number, status")
    .single();

  if (updateError || !updated) {
    throw new PoWorkflowError(
      500,
      updateError?.message ?? "Failed to update purchase order"
    );
  }

  try {
    await logPoAudit({
      poId: updated.id,
      poNumber: updated.po_number ?? order.po_number,
      action,
      fromStatus: validated.fromStatus,
      toStatus: input.toStatus,
      actor: input.actorEmail,
      note: validated.note,
    });
  } catch (auditError) {
    await supabase
      .from("purchase_orders")
      .update({
        status: validated.fromStatus,
        source_updated_at: now,
        ...(input.toStatus === "sent" ? { sent_at: null } : {}),
      })
      .eq("id", purchaseOrderId)
      .eq("tenant_id", TENANT_ID);

    throw new PoWorkflowError(
      500,
      `Status update rolled back; audit write failed: ${
        auditError instanceof Error ? auditError.message : "unknown error"
      }`
    );
  }

  const poNumber = updated.po_number ?? order.po_number ?? purchaseOrderId;
  try {
    if (input.toStatus === "pending_approval") {
      const totalRaw =
        typeof order.total_amount === "number"
          ? order.total_amount
          : order.total_amount != null
            ? Number(order.total_amount)
            : null;
      const totalLabel = formatCurrencyUSD(
        totalRaw !== null && Number.isFinite(totalRaw) ? totalRaw : null
      );
      await emitNotification({
        recipientRole: "approver",
        type: "po_pending_approval",
        title: `${poNumber} awaiting approval`,
        body: `Submitted by ${input.actorEmail} - ${totalLabel}`,
        link: `/purchase-orders/${purchaseOrderId}`,
      });
    } else if (input.toStatus === "approved" || input.toStatus === "suppressed") {
      const createdBy =
        typeof order.created_by === "string" ? order.created_by.trim() : "";
      if (createdBy) {
        await emitNotification({
          recipientEmail: createdBy,
          type: input.toStatus === "approved" ? "po_approved" : "po_suppressed",
          title:
            input.toStatus === "approved"
              ? `${poNumber} approved by ${input.actorEmail}`
              : `${poNumber} suppressed by ${input.actorEmail}`,
          body: null,
          link: `/purchase-orders/${purchaseOrderId}`,
        });
      }
    }
  } catch (notificationError) {
    console.error("PO transition notification failed:", notificationError);
  }

  return {
    purchaseOrderId,
    poNumber,
    fromStatus: validated.fromStatus,
    toStatus: input.toStatus,
    status: (updated.status ?? input.toStatus) as PoStatus,
  };
}

export type CreatePurchaseOrderInput = {
  supplierExternalId: string;
  createdByEmail: string;
  clearCartOnSuccess?: boolean;
};

export type CreatePurchaseOrderResult = {
  purchaseOrderId: string;
  poNumber: string;
  status: "draft";
  supplierExternalId: string;
};

export async function createPurchaseOrderFromSupplierCartGroup(
  input: CreatePurchaseOrderInput
): Promise<CreatePurchaseOrderResult> {
  const supplierExternalId = input.supplierExternalId.trim();
  if (!supplierExternalId) {
    throw new PoWorkflowError(400, "supplierExternalId is required");
  }

  const cartRows = await fetchUserCartItems(input.createdByEmail);
  const matchingRows = cartRows.filter(
    (row) => row.supplier_external_id === supplierExternalId
  );
  const items = matchingRows.map((row) => mapCartRow(row));
  if (items.length === 0) {
    throw new PoWorkflowError(400, "No cart items for that supplier");
  }

  const supabase = createAdminClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("external_id, supplier_code, name")
    .eq("tenant_id", TENANT_ID)
    .eq("external_id", supplierExternalId)
    .maybeSingle();

  const skuList = items.map((item) => item.sku);
  const { data: products } = await supabase
    .from("products")
    .select("sku, external_id")
    .eq("tenant_id", TENANT_ID)
    .in("sku", skuList);

  const productExternalBySku = new Map<string, string | null>();
  for (const row of (products ?? []) as Array<{
    sku: string;
    external_id: string | null;
  }>) {
    productExternalBySku.set(row.sku, row.external_id);
  }

  const poNumber = await generatePoNumber();
  const now = new Date().toISOString();
  const lineTotals = items.map((item) => ({
    unitCost: item.unitPrice,
    lineTotal: computeLineTotal(item.quantity, item.unitPrice),
  }));
  const unknownPrices = hasUnknownLineCosts(lineTotals);
  const totalAmount = unknownPrices ? null : sumKnownLineTotals(lineTotals);

  const { data: purchaseOrder, error: orderError } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: TENANT_ID,
      external_id: poNumber,
      po_number: poNumber,
      supplier_external_id: supplierExternalId,
      supplier_code:
        (supplier as { supplier_code?: string | null } | null)?.supplier_code ??
        null,
      po_date: now,
      status: "draft",
      total_amount: totalAmount,
      memo: null,
      source_system: "po-cart",
      source_updated_at: now,
      created_by: input.createdByEmail,
    })
    .select("id, po_number")
    .single();

  if (orderError || !purchaseOrder) {
    throw new PoWorkflowError(
      500,
      orderError?.message ?? "Failed to create purchase order"
    );
  }

  const lineRows = matchingRows.map((row, index) => {
    const item = items[index]!;
    const lineIndex = String(index + 1).padStart(3, "0");
    return {
      tenant_id: TENANT_ID,
      external_id: `${poNumber}-${lineIndex}`,
      po_external_id: poNumber,
      po_number: poNumber,
      product_external_id: productExternalBySku.get(item.sku) ?? null,
      sku: item.sku,
      quantity_ordered: item.quantity,
      unit_cost: item.unitPrice,
      line_total: computeLineTotal(item.quantity, item.unitPrice),
      source_system: "po-cart",
      source_updated_at: now,
      lock_override_reason: row.lock_override_reason ?? null,
      lock_overridden_by: row.lock_overridden_by ?? null,
      lock_overridden_at: row.lock_overridden_at ?? null,
      lock_original_vendor: row.lock_original_vendor ?? null,
    };
  });

  const { error: linesError } = await supabase
    .from("purchase_order_lines")
    .insert(lineRows);
  if (linesError) {
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
    throw new PoWorkflowError(
      500,
      linesError.message ?? "Failed to create purchase order lines"
    );
  }

  try {
    await logPoAudit({
      poId: purchaseOrder.id,
      poNumber: purchaseOrder.po_number ?? poNumber,
      action: "created",
      fromStatus: null,
      toStatus: "draft",
      actor: input.createdByEmail,
      note: null,
    });
  } catch (auditError) {
    await supabase
      .from("purchase_order_lines")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("po_external_id", poNumber);
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
    throw new PoWorkflowError(
      500,
      `Failed to write create audit entry: ${
        auditError instanceof Error ? auditError.message : "unknown error"
      }`
    );
  }

  if (input.clearCartOnSuccess) {
    await clearSupplierCartGroup(input.createdByEmail, supplierExternalId);
  }

  return {
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.po_number ?? poNumber,
    status: "draft",
    supplierExternalId,
  };
}

export async function clearSupplierCartGroup(
  createdByEmail: string,
  supplierExternalId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("po_cart_items")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", createdByEmail)
    .eq("supplier_external_id", supplierExternalId);

  if (error) {
    throw new PoWorkflowError(500, error.message);
  }
}
