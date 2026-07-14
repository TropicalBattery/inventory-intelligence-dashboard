export type UserRole = "buyer" | "approver";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** UI helper mirroring transition API approve gates. */
export function getApproveBlockReason(
  role: UserRole,
  userEmail: string,
  createdBy: string | null | undefined
): string | null {
  if (role !== "approver") {
    return "Only approvers can approve purchase orders";
  }

  const creator = createdBy?.trim().toLowerCase() ?? "";
  const me = normalizeEmail(userEmail);
  if (creator && me && creator === me) {
    return "You cannot approve a purchase order you created";
  }

  return null;
}
