import type { UserRole } from "@/lib/auth/role-guards";
import { getUpdatePasswordRedirectUrl } from "@/lib/auth/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export type UserRoleRow = {
  email: string;
  role: UserRole;
  createdAt: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUserRole(value: string): value is UserRole {
  return value === "buyer" || value === "approver";
}

/**
 * All role rows for the tenant (buyer/approver only — marketing excluded from admin UI).
 * Ordered by role, then email.
 */
export async function listUserRoles(): Promise<UserRoleRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("email, role, created_at")
    .eq("tenant_id", TENANT_ID)
    .in("role", ["buyer", "approver"])
    .order("role", { ascending: true })
    .order("email", { ascending: true });

  if (error) {
    throw new Error(`Failed to list user roles: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const role = typeof row.role === "string" ? row.role.trim() : "";
      if (!isUserRole(role)) {
        return null;
      }
      return {
        email: String(row.email ?? "").trim().toLowerCase(),
        role,
        createdAt: String(row.created_at ?? ""),
      };
    })
    .filter((row): row is UserRoleRow => Boolean(row?.email));
}

export async function countApprovers(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("role", "approver");

  if (error) {
    throw new Error(`Failed to count approvers: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Server-side guards for role changes. Returns an error message or null if OK.
 */
export async function getRoleChangeGuardError(
  actorEmail: string,
  targetEmail: string,
  nextRole: UserRole
): Promise<string | null> {
  const existing = await getStoredUserRole(targetEmail);
  const actor = normalizeEmail(actorEmail);
  const target = normalizeEmail(targetEmail);

  if (actor === target && existing === "approver" && nextRole === "buyer") {
    return "You can't remove your own approver role.";
  }

  if (existing === "approver" && nextRole === "buyer") {
    const approvers = await countApprovers();
    if (approvers <= 1) {
      return "At least one approver is required.";
    }
  }

  return null;
}

export async function getStoredUserRole(
  email: string
): Promise<UserRole | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("tenant_id", TENANT_ID)
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read user role: ${error.message}`);
  }

  const role = typeof data?.role === "string" ? data.role.trim() : "";
  return isUserRole(role) ? role : null;
}

/**
 * Upsert role for (tenant_id, email). Role must be buyer | approver.
 */
export async function setUserRole(
  email: string,
  role: UserRole
): Promise<UserRoleRow> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("email is required");
  }
  if (!isUserRole(role)) {
    throw new Error("role must be buyer or approver");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_roles")
    .upsert(
      {
        tenant_id: TENANT_ID,
        email: normalized,
        role,
      },
      { onConflict: "tenant_id,email" }
    )
    .select("email, role, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to set user role: ${error.message}`);
  }

  return {
    email: String(data.email).trim().toLowerCase(),
    role: data.role as UserRole,
    createdAt: String(data.created_at ?? ""),
  };
}

/**
 * Sends a recovery email via Supabase Auth mailer (built-in or custom SMTP).
 * auth.admin.generateLink only generates a link and does not send mail — use
 * resetPasswordForEmail so the user actually receives the email.
 * redirectTo must be allow-listed (see getUpdatePasswordRedirectUrl).
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("email is required");
  }

  const redirectTo = getUpdatePasswordRedirectUrl();
  const supabase = createAdminClient();
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Resolve auth.users id by email via paginated admin.listUsers (no getUserByEmail
 * in this supabase-js version). Returns null if no auth account exists.
 */
export async function findAuthUserIdByEmail(
  email: string
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const supabase = createAdminClient();
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = data.users ?? [];
    const match = users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === normalized
    );
    if (match?.id) {
      return match.id;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
    if (page > 50) {
      return null;
    }
  }
}

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Approver sets a password for an existing auth user. Logs who/whom/when only.
 */
export async function setAuthPasswordForEmail(input: {
  targetEmail: string;
  newPassword: string;
  setByEmail: string;
}): Promise<SetPasswordResult> {
  const targetEmail = normalizeEmail(input.targetEmail);
  const setBy = normalizeEmail(input.setByEmail);
  const newPassword = input.newPassword;

  if (!targetEmail) {
    return { ok: false, status: 400, error: "email is required" };
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return {
      ok: false,
      status: 400,
      error: "Password must be at least 8 characters.",
    };
  }

  let userId: string | null;
  try {
    userId = await findAuthUserIdByEmail(targetEmail);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to look up account";
    return { ok: false, status: 400, error: message };
  }

  if (!userId) {
    return {
      ok: false,
      status: 404,
      error: "No sign-in account exists for this email.",
    };
  }

  const supabase = createAdminClient();
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );

  if (updateError) {
    return {
      ok: false,
      status: 400,
      error: updateError.message || "Unable to set password.",
    };
  }

  const { error: logError } = await supabase.from("user_password_sets").insert({
    tenant_id: TENANT_ID,
    target_email: targetEmail,
    set_by: setBy,
  });

  if (logError) {
    return {
      ok: false,
      status: 400,
      error: `Password was set but audit log failed: ${logError.message}`,
    };
  }

  return { ok: true };
}

export { normalizeEmail, isUserRole };
