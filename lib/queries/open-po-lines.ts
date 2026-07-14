import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { TENANT_ID } from "@/lib/tenant";

const OPEN_PO_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
] as const;

export type OpenPoLineRef = {
  poId: string;
  poNumber: string;
  status: string;
  quantity: number;
};

type OpenPoHeaderRow = {
  id: string;
  external_id: string | null;
  po_number: string | null;
  status: string | null;
};

type OpenPoLineRow = {
  sku: string | null;
  quantity_ordered: number | string | null;
  po_external_id: string | null;
  po_number: string | null;
};

function toFiniteQty(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Platform POs still "open" for double-order awareness.
 * Statuses: draft | pending_approval | approved | sent.
 * Note: no receiving flow yet — sent POs stay open until that exists.
 */
export async function getOpenPoLinesBySku(): Promise<
  Map<string, OpenPoLineRef[]>
> {
  const supabase = createAdminClient();

  const openOrders = await fetchAllPages<OpenPoHeaderRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("id, external_id, po_number, status")
      .eq("tenant_id", TENANT_ID)
      .in("status", [...OPEN_PO_STATUSES])
      .range(from, to);

    return { data, error };
  });

  if (openOrders.length === 0) {
    return new Map();
  }

  const orderByExternalId = new Map<string, OpenPoHeaderRow>();
  for (const order of openOrders) {
    const externalId = order.external_id?.trim();
    if (!externalId) {
      continue;
    }
    orderByExternalId.set(externalId, order);
  }

  const externalIds = Array.from(orderByExternalId.keys());
  if (externalIds.length === 0) {
    return new Map();
  }

  const lines = await fetchAllPages<OpenPoLineRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("purchase_order_lines")
      .select("sku, quantity_ordered, po_external_id, po_number")
      .eq("tenant_id", TENANT_ID)
      .in("po_external_id", externalIds)
      .range(from, to);

    return { data, error };
  });

  // Aggregate per SKU + PO (multiple line rows for same SKU on one PO sum).
  const bySkuPo = new Map<
    string,
    Map<string, OpenPoLineRef>
  >();

  for (const line of lines) {
    const sku = line.sku?.trim();
    const poExternalId = line.po_external_id?.trim();
    if (!sku || !poExternalId) {
      continue;
    }

    const order = orderByExternalId.get(poExternalId);
    if (!order) {
      continue;
    }

    const qty = toFiniteQty(line.quantity_ordered);
    if (qty <= 0) {
      continue;
    }

    let perPo = bySkuPo.get(sku);
    if (!perPo) {
      perPo = new Map();
      bySkuPo.set(sku, perPo);
    }

    const existing = perPo.get(order.id);
    if (existing) {
      existing.quantity += qty;
      continue;
    }

    const poNumber =
      order.po_number?.trim() || line.po_number?.trim() || poExternalId;

    perPo.set(order.id, {
      poId: order.id,
      poNumber,
      status: (order.status ?? "draft").trim() || "draft",
      quantity: qty,
    });
  }

  const result = new Map<string, OpenPoLineRef[]>();
  for (const [sku, perPo] of Array.from(bySkuPo.entries())) {
    result.set(sku, Array.from(perPo.values()));
  }

  return result;
}
