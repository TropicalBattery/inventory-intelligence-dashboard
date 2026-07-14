import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export const PO_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "suppressed",
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<PoStatus, readonly PoStatus[]> = {
  draft: ["pending_approval", "suppressed"],
  pending_approval: ["approved", "draft", "suppressed"],
  approved: ["sent", "draft"],
  sent: [],
  suppressed: ["draft"],
};

export type PoAuditAction =
  | "created"
  | "submitted_for_approval"
  | "approved"
  | "sent"
  | "suppressed"
  | "reverted_to_draft"
  | "quantity_overridden";

export type PoAuditEntry = {
  poId: string;
  poNumber: string | null;
  action: PoAuditAction;
  fromStatus: string | null;
  toStatus: string | null;
  actor: string;
  note?: string | null;
};

export function isPoStatus(value: string): value is PoStatus {
  return (PO_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: string, to: string): boolean {
  if (!isPoStatus(from) || !isPoStatus(to)) {
    return false;
  }

  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionAction(
  from: PoStatus,
  to: PoStatus
): PoAuditAction | null {
  if (to === "pending_approval") {
    return "submitted_for_approval";
  }
  if (to === "approved") {
    return "approved";
  }
  if (to === "sent") {
    return "sent";
  }
  if (to === "suppressed") {
    return "suppressed";
  }
  if (to === "draft" && from !== "draft") {
    return "reverted_to_draft";
  }
  return null;
}

export async function logPoAudit(entry: PoAuditEntry): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("po_audit_log").insert({
    tenant_id: TENANT_ID,
    po_id: entry.poId,
    po_number: entry.poNumber,
    action: entry.action,
    from_status: entry.fromStatus,
    to_status: entry.toStatus,
    actor: entry.actor,
    note: entry.note ?? null,
  });

  if (error) {
    throw new Error(`Failed to write PO audit log: ${error.message}`);
  }
}

export type PoAuditLogRow = {
  id: string;
  tenantId: string;
  poId: string;
  poNumber: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actor: string;
  note: string | null;
  createdAt: string;
};

export async function fetchPoAuditLog(
  poId: string
): Promise<PoAuditLogRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("po_audit_log")
    .select(
      "id, tenant_id, po_id, po_number, action, from_status, to_status, actor, note, created_at"
    )
    .eq("tenant_id", TENANT_ID)
    .eq("po_id", poId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load PO audit log: ${error.message}`);
  }

  return ((data ?? []) as Array<{
    id: string;
    tenant_id: string;
    po_id: string;
    po_number: string | null;
    action: string;
    from_status: string | null;
    to_status: string | null;
    actor: string;
    note: string | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    poId: row.po_id,
    poNumber: row.po_number,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actor: row.actor,
    note: row.note,
    createdAt: row.created_at,
  }));
}
