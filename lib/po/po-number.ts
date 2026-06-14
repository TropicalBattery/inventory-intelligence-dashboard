import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantPrefix } from "@/lib/po/config";
import { TENANT_ID } from "@/lib/tenant";

function formatDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function buildPoNumberPrefix(date: Date): string {
  return `PO-${getTenantPrefix()}-${formatDateStamp(date)}`;
}

export async function generatePoNumber(date = new Date()): Promise<string> {
  const supabase = createAdminClient();
  const prefix = buildPoNumberPrefix(date);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { count, error } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("source_system", "dashboard")
    .gte("po_date", startOfDay.toISOString())
    .lte("po_date", endOfDay.toISOString());

  if (error) {
    throw new Error(`Failed to allocate PO sequence: ${error.message}`);
  }

  const sequence = (count ?? 0) + 1;
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}
