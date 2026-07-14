import { requireUserEmail } from "@/lib/po/cart-auth";
import { listNotificationsForUser } from "@/lib/notifications/store";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const result = await listNotificationsForUser(auth.email, 15);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/notifications failed:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}
