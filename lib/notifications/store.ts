import { getUserRole, type UserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  recipientRole: string | null;
  recipientEmail: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationDbRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  recipient_role: string | null;
  recipient_email: string | null;
  read_at: string | null;
  created_at: string;
};

function mapRow(row: NotificationDbRow): NotificationRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    recipientRole: row.recipient_role,
    recipientEmail: row.recipient_email,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function matchesViewer(
  row: Pick<NotificationDbRow, "recipient_role" | "recipient_email">,
  email: string,
  role: UserRole
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const recipientEmail = row.recipient_email?.trim().toLowerCase() ?? "";
  if (recipientEmail && recipientEmail === normalizedEmail) {
    return true;
  }

  const recipientRole = row.recipient_role?.trim().toLowerCase() ?? "";
  return Boolean(recipientRole && recipientRole === role);
}

const SELECT_COLS =
  "id, type, title, body, link, recipient_role, recipient_email, read_at, created_at";

export async function listNotificationsForUser(
  email: string,
  limit = 15
): Promise<{ notifications: NotificationRow[]; unreadCount: number }> {
  const role = await getUserRole(email);
  const supabase = createAdminClient();

  // Fetch recent tenant rows, then filter by viewer in app.
  // Role-targeted rows are broadly SELECT-visible under RLS; this is the
  // authoritative audience filter for the two-role model.
  const { data, error } = await supabase
    .from("notifications")
    .select(SELECT_COLS)
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as NotificationDbRow[]).filter((row) =>
    matchesViewer(row, email, role)
  );

  const notifications = rows.slice(0, limit).map(mapRow);
  const unreadCount = rows.filter((row) => !row.read_at).length;

  return { notifications, unreadCount };
}

export async function markNotificationRead(
  id: string,
  email: string
): Promise<NotificationRow | null> {
  const role = await getUserRole(email);
  const supabase = createAdminClient();

  const { data: existing, error: loadError } = await supabase
    .from("notifications")
    .select(SELECT_COLS)
    .eq("tenant_id", TENANT_ID)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }

  if (!existing) {
    return null;
  }

  const row = existing as NotificationDbRow;
  if (!matchesViewer(row, email, role)) {
    return null;
  }

  if (row.read_at) {
    return mapRow(row);
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("tenant_id", TENANT_ID)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to mark notification read");
  }

  return mapRow(updated as NotificationDbRow);
}

export async function markAllNotificationsRead(
  email: string
): Promise<number> {
  const role = await getUserRole(email);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_role, recipient_email, read_at")
    .eq("tenant_id", TENANT_ID)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const ids = (
    (data ?? []) as Array<{
      id: string;
      recipient_role: string | null;
      recipient_email: string | null;
      read_at: string | null;
    }>
  )
    .filter((row) => matchesViewer(row, email, role))
    .map((row) => row.id);

  if (ids.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("tenant_id", TENANT_ID)
    .in("id", ids);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return ids.length;
}
