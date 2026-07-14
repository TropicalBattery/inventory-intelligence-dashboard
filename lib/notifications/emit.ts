import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export type NotificationType =
  | "po_pending_approval"
  | "po_approved"
  | "po_suppressed";

export type NotificationEntry = {
  recipientRole?: string | null;
  recipientEmail?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
};

/**
 * Insert a notification row. Callers should wrap in try/catch if failures
 * must not block the primary operation (e.g. PO transitions).
 */
export async function emitNotification(
  entry: NotificationEntry
): Promise<void> {
  const recipientRole = entry.recipientRole?.trim() || null;
  const recipientEmail = entry.recipientEmail?.trim() || null;

  if (!recipientRole && !recipientEmail) {
    throw new Error(
      "emitNotification requires recipientRole or recipientEmail"
    );
  }

  const title = entry.title.trim();
  if (!title) {
    throw new Error("emitNotification requires a title");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    tenant_id: TENANT_ID,
    recipient_role: recipientRole,
    recipient_email: recipientEmail,
    type: entry.type,
    title,
    body: entry.body?.trim() || null,
    link: entry.link?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
