import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import type {
  InboundContainerRecord,
  InboundContainerStatus,
  InboundEntrySource,
} from "@/lib/inbound-containers/group";

export type InboundContainerRow = {
  id: string;
  tenant_id: string;
  supplier: string;
  supplier_invoice: string | null;
  quote_ref: string | null;
  container_count: number | string | null;
  container_size: string | null;
  eta_port: string | null;
  eta_warehouse: string | null;
  bl_number: string | null;
  container_numbers: string | null;
  source_month: string | null;
  loaded_at: string;
  entry_source: string | null;
  status: string | null;
  arrived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

function toNullableNumber(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function coerceEntrySource(value: string | null | undefined): InboundEntrySource {
  return value === "manual" ? "manual" : "upload";
}

function coerceStatus(value: string | null | undefined): InboundContainerStatus {
  return value === "arrived" ? "arrived" : "inbound";
}

export function mapInboundContainerRow(
  row: InboundContainerRow
): InboundContainerRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    supplier: row.supplier,
    supplierInvoice: row.supplier_invoice,
    quoteRef: row.quote_ref,
    containerCount: toNullableNumber(row.container_count),
    containerSize: row.container_size,
    etaPort: row.eta_port,
    etaWarehouse: row.eta_warehouse,
    blNumber: row.bl_number,
    containerNumbers: row.container_numbers,
    sourceMonth: row.source_month,
    loadedAt: row.loaded_at,
    entrySource: coerceEntrySource(row.entry_source),
    status: coerceStatus(row.status),
    arrivedAt: row.arrived_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function fetchInboundContainerRows(): Promise<
  InboundContainerRecord[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inbound_containers")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("supplier", { ascending: true })
    .order("eta_port", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InboundContainerRow[]).map(mapInboundContainerRow);
}
