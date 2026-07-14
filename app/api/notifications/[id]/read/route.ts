import { requireUserEmail } from "@/lib/po/cart-auth";
import { markNotificationRead } from "@/lib/notifications/store";
import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const id = context.params.id?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "Notification id is required" },
        { status: 400 }
      );
    }

    const notification = await markNotificationRead(id, auth.email);
    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("PATCH /api/notifications/[id]/read failed:", error);
    return NextResponse.json(
      { error: "Failed to mark notification read" },
      { status: 500 }
    );
  }
}
