import { getUserRole } from "@/lib/auth/roles";
import {
  normalizeEmail,
  setAuthPasswordForEmail,
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
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const result = await setAuthPasswordForEmail({
      targetEmail: email,
      newPassword,
      setByEmail: auth.email,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      email,
      message: `Password set for ${email}. Share it with them securely.`,
    });
  } catch (error) {
    console.error("POST /api/users/set-password failed:", error);
    const message =
      error instanceof Error ? error.message : "Unable to set password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
