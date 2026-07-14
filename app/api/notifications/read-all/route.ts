import { requireUserEmail } from "@/lib/po/cart-auth";
import { markAllNotificationsRead } from "@/lib/notifications/store";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const updated = await markAllNotificationsRead(auth.email);
    return NextResponse.json({ updated });
  } catch (error) {
    console.error("POST /api/notifications/read-all failed:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications read" },
      { status: 500 }
    );
  }
}
