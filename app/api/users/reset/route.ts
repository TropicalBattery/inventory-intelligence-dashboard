import { getUserRole } from "@/lib/auth/roles";
import {
  normalizeEmail,
  sendPasswordResetEmail,
} from "@/lib/auth/user-admin";
import { requireUserEmail } from "@/lib/po/cart-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const actorRole = await getUserRole(auth.email);
    if (actorRole !== "approver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const email = normalizeEmail(
      typeof body.email === "string" ? body.email : ""
    );

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    await sendPasswordResetEmail(email);

    return NextResponse.json({
      ok: true,
      email,
      message: `Password reset email sent to ${email}.`,
    });
  } catch (error) {
    console.error("POST /api/users/reset failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send reset email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
