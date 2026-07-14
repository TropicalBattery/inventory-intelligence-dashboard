import { requireUserEmail } from "@/lib/po/cart-auth";
import { fetchPoAuditLog } from "@/lib/po/approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const poId = context.params.id?.trim();
    if (!poId) {
      return NextResponse.json({ error: "PO id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: order, error: loadError } = await supabase
      .from("purchase_orders")
      .select("id")
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

    const entries = await fetchPoAuditLog(poId);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET /api/purchase-orders/[id]/audit failed:", error);
    return NextResponse.json(
      { error: "Failed to load purchase order audit log" },
      { status: 500 }
    );
  }
}
