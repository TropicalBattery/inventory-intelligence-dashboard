import { requireUserEmail } from "@/lib/po/cart-auth";
import { isPoStatus, type PoStatus } from "@/lib/po/approval";
import {
  PoWorkflowError,
  transitionPurchaseOrder,
} from "@/lib/po/workflow";
import { getUserRole } from "@/lib/auth/roles";
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
    const actorRole = await getUserRole(auth.email);
    const result = await transitionPurchaseOrder({
      purchaseOrderId: poId,
      toStatus,
      actorUserId: auth.email,
      actorEmail: auth.email,
      actorRole,
      ...(note ? { note } : {}),
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${poId}`);

    return NextResponse.json({
      status: result.status,
      poNumber: result.poNumber,
    });
  } catch (error) {
    if (error instanceof PoWorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/purchase-orders/[id]/transition failed:", error);
    return NextResponse.json(
      { error: "Failed to transition purchase order" },
      { status: 500 }
    );
  }
}
