import { createAdminClient } from "@/lib/supabase/admin";
import {
  countUnknownLineCosts,
  hasUnknownLineCosts,
  normalizeStoredLineCost,
  resolvePoDisplayTotal,
} from "@/lib/po/line-cost";
import { resolvePoSupplierDisplayName } from "@/lib/po/supplier-display";
import { stripAiPreamble } from "@/lib/ai/strip-preamble";
import { TENANT_ID } from "@/lib/tenant";
import type {
  PurchaseOrderDocument,
  PurchaseOrderLineDocument,
  PurchaseOrderListItem,
  PurchaseOrderListLineSummary,
  PurchaseOrderRecord,
} from "@/lib/types";

type PoLineRow = {
  po_external_id: string;
  sku: string | null;
  quantity_ordered: number | string | null;
  unit_cost: number | string | null;
  line_total: number | string | null;
};

export type ApprovedMetrics = {
  approvedThisMonthCount: number;
  approvedValueThisMonth: number;
};

function toQuantity(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

  const externalIds = orders.map((order) => order.external_id);
  const linesByPoExternalId = new Map<string, PoLineRow[]>();

  if (externalIds.length > 0) {
    const { data: lineRows, error: linesError } = await supabase
      .from("purchase_order_lines")
      .select("po_external_id, sku, quantity_ordered, unit_cost, line_total")
      .eq("tenant_id", TENANT_ID)
      .in("po_external_id", externalIds);

    if (linesError) {
      console.error(
        "Failed to fetch purchase order lines for list:",
        linesError.message
      );
    } else {
      for (const row of (lineRows ?? []) as PoLineRow[]) {
        const list = linesByPoExternalId.get(row.po_external_id) ?? [];
        list.push(row);
        linesByPoExternalId.set(row.po_external_id, list);
      }
    }
  }

  const allSkus = Array.from(
    new Set(
      Array.from(linesByPoExternalId.values())
        .flat()
        .map((line) => line.sku)
        .filter((sku): sku is string => Boolean(sku))
    )
  );

  let productNameBySku = new Map<string, string | null>();
  if (allSkus.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("sku, name")
      .eq("tenant_id", TENANT_ID)
      .in("sku", allSkus);

    productNameBySku = new Map(
      (products ?? []).map((product) => [product.sku, product.name])
    );
  }

  return orders.map((order) => {
    const rawLines = linesByPoExternalId.get(order.external_id) ?? [];
    const normalizedLines = rawLines.map((line) => {
      const quantity = toQuantity(line.quantity_ordered);
      const cost = normalizeStoredLineCost(
        line.unit_cost === null || line.unit_cost === undefined
          ? null
          : Number(line.unit_cost),
        quantity,
        line.line_total === null || line.line_total === undefined
          ? null
          : Number(line.line_total)
      );
      const sku = line.sku ?? "Unknown";
      const productName =
        (line.sku ? productNameBySku.get(line.sku) : null)?.trim() || sku;

      return {
        sku,
        productName,
        quantity,
        unitCost: cost.unitCost,
        lineTotal: cost.lineTotal,
      };
    });

    const lines: PurchaseOrderListLineSummary[] = normalizedLines.map(
      (line) => ({
        sku: line.sku,
        productName: line.productName,
        quantity: line.quantity,
      })
    );

    const unpricedLineCount = countUnknownLineCosts(normalizedLines);
    const displayTotal = resolvePoDisplayTotal(normalizedLines);
    const storedTotal =
      order.total_amount === null || order.total_amount === undefined
        ? null
        : Number(order.total_amount);

    return {
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
        unpricedLineCount > 0
          ? null
          : displayTotal ??
            (storedTotal !== null && Number.isFinite(storedTotal)
              ? storedTotal
              : null),
      hasUnknownLineCosts: unpricedLineCount > 0,
      unpricedLineCount,
      lineCount: lines.length,
      totalUnits: lines.reduce((sum, line) => sum + line.quantity, 0),
      lines,
      status: order.status ?? "draft",
      sentAt: order.sent_at,
      createdBy: order.created_by?.trim() || null,
    };
  });
}

export async function getApprovedMetricsThisMonth(): Promise<ApprovedMetrics> {
  const supabase = createAdminClient();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data: approvals, error: approvalsError } = await supabase
    .from("po_audit_log")
    .select("po_id, created_at")
    .eq("tenant_id", TENANT_ID)
    .eq("action", "approved")
    .gte("created_at", start)
    .lt("created_at", end);

  if (approvalsError) {
    console.error("Failed to fetch monthly approval metrics:", approvalsError.message);
    return { approvedThisMonthCount: 0, approvedValueThisMonth: 0 };
  }

  const poIds = Array.from(
    new Set(
      (approvals ?? [])
        .map((row) => row.po_id)
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    )
  );

  if (poIds.length === 0) {
    return { approvedThisMonthCount: 0, approvedValueThisMonth: 0 };
  }

  const { data: orders, error: ordersError } = await supabase
    .from("purchase_orders")
    .select("id, total_amount")
    .eq("tenant_id", TENANT_ID)
    .in("id", poIds);

  if (ordersError) {
    console.error(
      "Failed to fetch approved PO values for monthly metrics:",
      ordersError.message
    );
    return { approvedThisMonthCount: poIds.length, approvedValueThisMonth: 0 };
  }

  let approvedValueThisMonth = 0;
  for (const order of orders ?? []) {
    const value =
      order.total_amount === null || order.total_amount === undefined
        ? null
        : Number(order.total_amount);
    if (value !== null && Number.isFinite(value)) {
      approvedValueThisMonth += value;
    }
  }

  return {
    approvedThisMonthCount: poIds.length,
    approvedValueThisMonth,
  };
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

  const lineSkus = (lines ?? [])
    .map((line) => line.sku)
    .filter((sku): sku is string => Boolean(sku));

  let productNameBySku = new Map<string, string | null>();
  if (lineSkus.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("sku, name")
      .eq("tenant_id", TENANT_ID)
      .in("sku", lineSkus);

    productNameBySku = new Map(
      (products ?? []).map((product) => [product.sku, product.name])
    );
  }

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

  const unpricedLineCount = countUnknownLineCosts(documentLines);
  const unknownLineCosts = hasUnknownLineCosts(documentLines);
  const displayTotal = resolvePoDisplayTotal(documentLines);
  const storedTotal =
    po.total_amount === null || po.total_amount === undefined
      ? null
      : Number(po.total_amount);

  return {
    id: po.id,
    poNumber: po.po_number ?? po.external_id,
    poDate: po.po_date ?? new Date().toISOString(),
    status: po.status ?? "draft",
    totalAmount: unknownLineCosts
      ? null
      : displayTotal ??
        (storedTotal !== null && Number.isFinite(storedTotal)
          ? storedTotal
          : null),
    hasUnknownLineCosts: unknownLineCosts,
    unpricedLineCount,
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
