import type { UserRole } from "@/lib/auth/role-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export type { UserRole } from "@/lib/auth/role-guards";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUserRole(value: string): value is UserRole {
  return value === "buyer" || value === "approver";
}

/**
 * Resolves the PO workflow role for an email.
 * Unknown / missing emails default to buyer (safe default, no lockout).
 */
export async function getUserRole(email: string): Promise<UserRole> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return "buyer";
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("tenant_id", TENANT_ID)
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve user role:", error.message);
    return "buyer";
  }

  const role = typeof data?.role === "string" ? data.role.trim() : "";
  if (isUserRole(role)) {
    return role;
  }

  return "buyer";
}
