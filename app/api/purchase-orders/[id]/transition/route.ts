import { requireUserEmail } from "@/lib/po/cart-auth";
import {
  canTransition,
  isPoStatus,
  logPoAudit,
  transitionAction,
  type PoStatus,
} from "@/lib/po/approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const poId = context.params.id?.trim();
    if (!poId) {
      return NextResponse.json({ error: "PO id is required" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const rawToStatus =
      typeof body.toStatus === "string" ? body.toStatus.trim() : "";
    const note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim()
        : null;

    if (!rawToStatus || !isPoStatus(rawToStatus)) {
      return NextResponse.json(
        { error: "toStatus must be a valid PO status" },
        { status: 400 }
      );
    }

    const toStatus: PoStatus = rawToStatus;
    const supabase = createAdminClient();

    const { data: order, error: loadError } = await supabase
      .from("purchase_orders")
      .select("id, po_number, status, tenant_id")
      .eq("id", poId)
      .eq("tenant_id", TENANT_ID)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    const fromStatus = (order.status ?? "draft").trim();

    if (!canTransition(fromStatus, toStatus)) {
      return NextResponse.json(
        {
          error: `Cannot move a ${fromStatus} PO to ${toStatus}`,
        },
        { status: 400 }
      );
    }

    if (!isPoStatus(fromStatus)) {
      return NextResponse.json(
        {
          error: `Cannot move a ${fromStatus} PO to ${toStatus}`,
        },
        { status: 400 }
      );
    }

    const action = transitionAction(fromStatus, toStatus);
    if (!action) {
      return NextResponse.json(
        {
          error: `Cannot move a ${fromStatus} PO to ${toStatus}`,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: toStatus,
      source_updated_at: now,
    };
    if (toStatus === "sent") {
      updates.sent_at = now;
    }

    const { data: updated, error: updateError } = await supabase
      .from("purchase_orders")
      .update(updates)
      .eq("id", poId)
      .eq("tenant_id", TENANT_ID)
      .select("id, po_number, status")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        {
          error: updateError?.message ?? "Failed to update purchase order",
        },
        { status: 500 }
      );
    }

    try {
      await logPoAudit({
        poId: updated.id,
        poNumber: updated.po_number ?? order.po_number,
        action,
        fromStatus,
        toStatus,
        actor: auth.email,
        note,
      });
    } catch (auditError) {
      // Compensate: revert status so UI/API stay consistent with audit trail.
      await supabase
        .from("purchase_orders")
        .update({
          status: fromStatus,
          source_updated_at: now,
          ...(toStatus === "sent" ? { sent_at: null } : {}),
        })
        .eq("id", poId)
        .eq("tenant_id", TENANT_ID);

      console.error("PO transition audit failed:", auditError);
      return NextResponse.json(
        { error: "Status update rolled back; audit write failed" },
        { status: 500 }
      );
    }

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${poId}`);

    return NextResponse.json({
      status: updated.status ?? toStatus,
      poNumber: updated.po_number ?? order.po_number,
    });
  } catch (error) {
    console.error("POST /api/purchase-orders/[id]/transition failed:", error);
    return NextResponse.json(
      { error: "Failed to transition purchase order" },
      { status: 500 }
    );
  }
}
