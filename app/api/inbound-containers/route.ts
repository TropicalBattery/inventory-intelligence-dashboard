import { requireUserEmail } from "@/lib/po/cart-auth";
import { groupInboundContainers } from "@/lib/inbound-containers/group";
import { fetchInboundContainerRows } from "@/lib/queries/inbound-containers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const rows = await fetchInboundContainerRows();
    const summary = groupInboundContainers(rows);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/inbound-containers failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load inbound containers",
      },
      { status: 500 }
    );
  }
}
