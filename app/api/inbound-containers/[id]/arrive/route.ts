import { requireUserEmail } from "@/lib/po/cart-auth";
import {
  mapInboundContainerRow,
  type InboundContainerRow,
} from "@/lib/queries/inbound-containers";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const id = context.params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    let undo = false;
    try {
      const body = (await request.json()) as Record<string, unknown>;
      undo = body.undo === true;
    } catch {
      // Empty body = mark arrived.
      undo = false;
    }

    const now = new Date().toISOString();
    const updates = undo
      ? {
          status: "inbound" as const,
          arrived_at: null,
          updated_by: auth.email,
          updated_at: now,
        }
      : {
          status: "arrived" as const,
          arrived_at: now,
          updated_by: auth.email,
          updated_at: now,
        };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("inbound_containers")
      .update(updates)
      .eq("tenant_id", TENANT_ID)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    // Inbound relief on the reorder list is derived from status='inbound'.
    revalidatePath("/reorder");
    revalidatePath("/inbound-containers");

    return NextResponse.json({
      row: mapInboundContainerRow(data as InboundContainerRow),
    });
  } catch (error) {
    console.error(
      "POST /api/inbound-containers/[id]/arrive failed:",
      error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update arrival status",
      },
      { status: 400 }
    );
  }
}
