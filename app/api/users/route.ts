import { getUserRole } from "@/lib/auth/roles";
import {
  getRoleChangeGuardError,
  getStoredUserRole,
  isUserRole,
  listUserRoles,
  normalizeEmail,
  setUserRole,
} from "@/lib/auth/user-admin";
import { requireUserEmail } from "@/lib/po/cart-auth";
import { NextResponse } from "next/server";

async function requireApprover(): Promise<
  { email: string } | { error: NextResponse }
> {
  const auth = await requireUserEmail();
  if ("error" in auth) {
    return auth;
  }

  const role = await getUserRole(auth.email);
  if (role !== "approver") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { email: auth.email };
}

export async function GET() {
  try {
    const auth = await requireApprover();
    if ("error" in auth) {
      return auth.error;
    }

    const users = await listUserRoles();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/users failed:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApprover();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const email = normalizeEmail(
      typeof body.email === "string" ? body.email : ""
    );
    const roleRaw = typeof body.role === "string" ? body.role.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (!isUserRole(roleRaw)) {
      return NextResponse.json(
        { error: "role must be buyer or approver" },
        { status: 400 }
      );
    }

    const existing = await getStoredUserRole(email);
    if (existing) {
      return NextResponse.json(
        {
          error:
            "That email already has a role. Change it in the table below.",
        },
        { status: 409 }
      );
    }

    const guardError = await getRoleChangeGuardError(
      auth.email,
      email,
      roleRaw
    );
    if (guardError) {
      return NextResponse.json({ error: guardError }, { status: 400 });
    }

    await setUserRole(email, roleRaw);
    const users = await listUserRoles();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("POST /api/users failed:", error);
    return NextResponse.json(
      { error: "Failed to add user role" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireApprover();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const email = normalizeEmail(
      typeof body.email === "string" ? body.email : ""
    );
    const roleRaw = typeof body.role === "string" ? body.role.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (!isUserRole(roleRaw)) {
      return NextResponse.json(
        { error: "role must be buyer or approver" },
        { status: 400 }
      );
    }

    const existing = await getStoredUserRole(email);
    if (!existing) {
      return NextResponse.json(
        { error: "No role found for that email." },
        { status: 404 }
      );
    }

    if (existing === roleRaw) {
      const users = await listUserRoles();
      return NextResponse.json({ users, unchanged: true });
    }

    const guardError = await getRoleChangeGuardError(
      auth.email,
      email,
      roleRaw
    );
    if (guardError) {
      return NextResponse.json({ error: guardError }, { status: 400 });
    }

    await setUserRole(email, roleRaw);
    const users = await listUserRoles();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("PATCH /api/users failed:", error);
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 }
    );
  }
}
