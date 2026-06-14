import { createClient } from "@/lib/supabase/server";
import { TENANT_ID } from "@/lib/tenant";
import type {
  ConnectorHeartbeat,
  ConnectorSyncStatus,
} from "@/lib/types/database";

export async function getLatestConnectorHeartbeat(): Promise<ConnectorHeartbeat | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connector_heartbeats")
    .select(
      "id, tenant_id, connector_id, status, version, uptime_seconds, sent_at"
    )
    .eq("tenant_id", TENANT_ID)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch connector heartbeat:", error.message);
    return null;
  }

  return data as ConnectorHeartbeat | null;
}

export async function getRecentSyncRuns(): Promise<ConnectorSyncStatus[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connector_sync_status")
    .select(
      "id, tenant_id, connector_id, job_name, status, records_read, records_pushed, records_failed, started_at, completed_at"
    )
    .eq("tenant_id", TENANT_ID)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch connector sync status:", error.message);
    return [];
  }

  return (data ?? []) as ConnectorSyncStatus[];
}
