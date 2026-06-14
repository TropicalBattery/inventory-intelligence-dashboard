import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  computeLineTotal,
  hasUnknownLineCosts,
  normalizeStoredLineCost,
  resolveUnitCostFromSources,
  sumKnownLineTotals,
} from "@/lib/po/line-cost";
import { resolvePoSupplierDisplayName } from "@/lib/po/supplier-display";
import { stripAiPreamble } from "@/lib/ai/strip-preamble";
import { TENANT_ID } from "@/lib/tenant";
import type {
  PoReviewLine,
  PoReviewSupplierGroup,
  PurchaseOrderDocument,
  PurchaseOrderLineDocument,
  PurchaseOrderListItem,
  PurchaseOrderRecord,
} from "@/lib/types";

type DraftSelectionRow = {
  sku: string;
  supplier_external_id: string | null;
  suggested_qty: number;
};

type ProductRow = {
  sku: string | null;
  external_id: string;
  name: string | null;
  cost_price: number | null;
};

type SupplierRow = {
  external_id: string;
  name: string | null;
  email: string | null;
  address: string | null;
};

type ReferenceRow = {
  sku: string;
  supplier_external_id: string;
  vendor_item_number: string | null;
  unit_price: number | null;
};

function resolveUnitCost(
  product: ProductRow | undefined,
  reference: ReferenceRow | undefined
): number | null {
  return resolveUnitCostFromSources(
    reference?.unit_price,
    product?.cost_price
  );
}

export async function getDraftPoReviewGroups(
  batchId: string
): Promise<PoReviewSupplierGroup[]> {
  const supabase = await createClient();

  const { data: draftRows, error } = await supabase
    .from("draft_po_selections")
    .select("sku, supplier_external_id, suggested_qty")
    .eq("tenant_id", TENANT_ID)
    .eq("batch_id", batchId)
    .order("sku");

  if (error) {
    console.error("Failed to load draft PO selections:", error.message);
    return [];
  }

  const selections = (draftRows ?? []) as DraftSelectionRow[];
  if (selections.length === 0) {
    return [];
  }

  const skus = Array.from(new Set(selections.map((row) => row.sku)));
  const supplierIds = Array.from(
    new Set(
      selections
        .map((row) => row.supplier_external_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const [productsResult, suppliersResult, referencesResult] = await Promise.all([
    supabase
      .from("products")
      .select("sku, external_id, name, cost_price")
      .eq("tenant_id", TENANT_ID)
      .in("sku", skus),
    supplierIds.length > 0
      ? supabase
          .from("suppliers")
          .select("external_id, name, email, address")
          .eq("tenant_id", TENANT_ID)
          .in("external_id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
    supplierIds.length > 0
      ? supabase
          .from("item_supplier_reference")
          .select("sku, supplier_external_id, vendor_item_number, unit_price")
          .eq("tenant_id", TENANT_ID)
          .in("sku", skus)
          .in("supplier_external_id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const products = (productsResult.data ?? []) as ProductRow[];
  const suppliers = (suppliersResult.data ?? []) as SupplierRow[];
  const references = (referencesResult.data ?? []) as ReferenceRow[];

  const productBySku = new Map(
    products
      .filter((product): product is ProductRow & { sku: string } =>
        Boolean(product.sku)
      )
      .map((product) => [product.sku, product])
  );

  const supplierByExternalId = new Map(
    suppliers.map((supplier) => [supplier.external_id, supplier])
  );

  const referenceByKey = new Map(
    references.map((reference) => [
      `${reference.sku}:${reference.supplier_external_id}`,
      reference,
    ])
  );

  const groups = new Map<string, PoReviewSupplierGroup>();

  for (const selection of selections) {
    const supplierExternalId = selection.supplier_external_id ?? "unknown";
    const product = productBySku.get(selection.sku);
    const supplier = supplierByExternalId.get(supplierExternalId);
    const reference = referenceByKey.get(
      `${selection.sku}:${supplierExternalId}`
    );
    const quantity = Number(selection.suggested_qty) || 0;
    const unitCost = resolveUnitCost(product, reference);

    const line: PoReviewLine = {
      sku: selection.sku,
      productExternalId: product?.external_id ?? null,
      name: product?.name ?? null,
      vendorItemNumber: reference?.vendor_item_number ?? null,
      quantity,
      unitCost,
      lineTotal: computeLineTotal(quantity, unitCost),
    };

    const existing = groups.get(supplierExternalId);
    if (existing) {
      existing.lines.push(line);
      continue;
    }

    groups.set(supplierExternalId, {
      supplierExternalId,
      supplierName: supplier?.name ?? supplierExternalId,
      supplierEmail: supplier?.email ?? null,
      supplierAddress: supplier?.address ?? null,
      lines: [line],
    });
  }

  return Array.from(groups.values()).sort((a, b) =>
    (a.supplierName ?? a.supplierExternalId).localeCompare(
      b.supplierName ?? b.supplierExternalId
    )
  );
}

export async function getPurchaseOrderList(): Promise<PurchaseOrderListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, external_id, po_number, supplier_external_id, po_date, total_amount, status, sent_at"
    )
    .eq("tenant_id", TENANT_ID)
    .order("po_date", { ascending: false });

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
