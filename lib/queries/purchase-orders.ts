import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasUnknownLineCosts,
  normalizeStoredLineCost,
  sumKnownLineTotals,
} from "@/lib/po/line-cost";
import { resolvePoSupplierDisplayName } from "@/lib/po/supplier-display";
import { stripAiPreamble } from "@/lib/ai/strip-preamble";
import { TENANT_ID } from "@/lib/tenant";
import type {
  PurchaseOrderDocument,
  PurchaseOrderLineDocument,
  PurchaseOrderListItem,
  PurchaseOrderRecord,
} from "@/lib/types";

export async function getPurchaseOrderList(): Promise<PurchaseOrderListItem[]> {
  // Use service role — same as document/detail paths. Session/RLS client
  // cannot see rows written by po-cart (and other) admin inserts.
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, external_id, po_number, supplier_external_id, po_date, total_amount, status, sent_at, created_by, source_system"
    )
    .eq("tenant_id", TENANT_ID)
    .order("po_date", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Failed to fetch purchase orders:", error.message);
    return [];
  }

  const orders = (data ?? []) as Array<
    PurchaseOrderRecord & { supplier_external_id: string | null }
  >;

  const supplierIds = Array.from(
    new Set(
      orders
        .map((order) => order.supplier_external_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let supplierNameById = new Map<string, string | null>();
  let supplierEmailById = new Map<string, string | null>();

  if (supplierIds.length > 0) {
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("external_id, name, email")
      .eq("tenant_id", TENANT_ID)
      .in("external_id", supplierIds);

    supplierNameById = new Map(
      (suppliers ?? []).map((supplier) => [
        supplier.external_id,
        supplier.name,
      ])
    );
    supplierEmailById = new Map(
      (suppliers ?? []).map((supplier) => [
        supplier.external_id,
        supplier.email,
      ])
    );
  }

  return orders.map((order) => ({
    id: order.id,
    poNumber: order.po_number ?? order.external_id,
    supplierName: order.supplier_external_id
      ? supplierNameById.get(order.supplier_external_id) ?? null
      : null,
    supplierEmail: order.supplier_external_id
      ? supplierEmailById.get(order.supplier_external_id) ?? null
      : null,
    poDate: order.po_date,
    totalAmount:
      order.total_amount === null || order.total_amount === undefined
        ? null
        : Number(order.total_amount),
    status: order.status ?? "draft",
    sentAt: order.sent_at,
    createdBy: order.created_by?.trim() || null,
  }));
}

export async function getPurchaseOrderDocument(
  purchaseOrderId: string
): Promise<PurchaseOrderDocument | null> {
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (orderError || !order) {
    if (orderError) {
      console.error("Failed to fetch purchase order:", orderError.message);
    }
    return null;
  }

  const po = order as PurchaseOrderRecord;

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("po_external_id", po.external_id)
    .order("external_id");

  if (linesError) {
    console.error("Failed to fetch purchase order lines:", linesError.message);
    return null;
  }

  let supplierName: string | null = null;
  let supplierEmail: string | null = null;
  let supplierAddress: string | null = null;

  if (po.supplier_external_id) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("name, email, address")
      .eq("tenant_id", TENANT_ID)
      .eq("external_id", po.supplier_external_id)
      .maybeSingle();

    supplierName = supplier?.name ?? null;
    supplierEmail = supplier?.email ?? null;
    supplierAddress = supplier?.address ?? null;
  }

  const supplierExternalId = po.supplier_external_id ?? null;
  const supplierDisplayName = resolvePoSupplierDisplayName(
    supplierName,
    supplierExternalId,
    `purchase order ${po.po_number ?? po.external_id}`
  );

  const { data: products } = await supabase
    .from("products")
    .select("sku, name")
    .eq("tenant_id", TENANT_ID)
    .in(
      "sku",
      (lines ?? [])
        .map((line) => line.sku)
        .filter((sku): sku is string => Boolean(sku))
    );

  const productNameBySku = new Map(
    (products ?? []).map((product) => [product.sku, product.name])
  );

  const documentLines: PurchaseOrderLineDocument[] = (lines ?? []).map(
    (line) => {
      const quantityOrdered = Number(line.quantity_ordered ?? 0);
      const normalizedCost = normalizeStoredLineCost(
        line.unit_cost,
        quantityOrdered,
        line.line_total
      );

      return {
        sku: line.sku ?? "Unknown",
        vendorItemNumber: null,
        description: line.sku ? productNameBySku.get(line.sku) ?? null : null,
        quantityOrdered,
        unitCost: normalizedCost.unitCost,
        lineTotal: normalizedCost.lineTotal,
      };
    }
  );

  const unknownLineCosts = hasUnknownLineCosts(documentLines);
  const computedTotal = sumKnownLineTotals(documentLines);
  const storedTotal =
    po.total_amount === null || po.total_amount === undefined
      ? null
      : Number(po.total_amount);

  return {
    id: po.id,
    poNumber: po.po_number ?? po.external_id,
    poDate: po.po_date ?? new Date().toISOString(),
    status: po.status ?? "draft",
    totalAmount: unknownLineCosts ? computedTotal : storedTotal ?? computedTotal,
    hasUnknownLineCosts: unknownLineCosts,
    memo: po.memo ? stripAiPreamble(po.memo) : null,
    sentAt: po.sent_at,
    createdBy: po.created_by?.trim() || null,
    supplierExternalId,
    supplierName: supplierDisplayName,
    supplierEmail,
    supplierAddress,
    lines: documentLines,
  };
}

export async function getPurchaseOrderDocumentWithReferenceDetails(
  purchaseOrderId: string
): Promise<PurchaseOrderDocument | null> {
  const document = await getPurchaseOrderDocument(purchaseOrderId);
  if (!document) {
    return null;
  }

  const supabase = createAdminClient();
  const po = await supabase
    .from("purchase_orders")
    .select("supplier_external_id, external_id")
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (!po.data?.supplier_external_id) {
    return document;
  }

  const skus = document.lines.map((line) => line.sku);
  const { data: references } = await supabase
    .from("item_supplier_reference")
    .select("sku, vendor_item_number")
    .eq("tenant_id", TENANT_ID)
    .eq("supplier_external_id", po.data.supplier_external_id)
    .in("sku", skus);

  const vendorBySku = new Map(
    (references ?? []).map((reference) => [
      reference.sku,
      reference.vendor_item_number,
    ])
  );

  return {
    ...document,
    lines: document.lines.map((line) => ({
      ...line,
      vendorItemNumber: vendorBySku.get(line.sku) ?? line.vendorItemNumber,
    })),
  };
}
