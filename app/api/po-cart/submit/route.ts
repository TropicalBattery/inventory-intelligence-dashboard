import {
  coerceOptionalString,
  requireUserEmail,
} from "@/lib/po/cart-auth";
import { logPoAudit } from "@/lib/po/approval";
import { fetchUserCartItems, mapCartRow } from "@/lib/po/cart";
import {
  computeLineTotal,
  sumKnownLineTotals,
} from "@/lib/po/line-cost";
import { generatePoNumber } from "@/lib/po/po-number";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const supplierExternalId = coerceOptionalString(body.supplierExternalId);

    if (!supplierExternalId || supplierExternalId === "UNASSIGNED") {
      return NextResponse.json(
        {
          error: "Assign a supplier to all items before submitting.",
        },
        { status: 400 }
      );
    }

    const cartRows = await fetchUserCartItems(auth.email);
    const items = cartRows
      .map(mapCartRow)
      .filter((item) => item.supplierExternalId === supplierExternalId);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No cart items for that supplier" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("external_id, supplier_code, name")
      .eq("tenant_id", TENANT_ID)
      .eq("external_id", supplierExternalId)
      .maybeSingle();

    const skuList = items.map((item) => item.sku);
    const { data: products } = await supabase
      .from("products")
      .select("sku, external_id")
      .eq("tenant_id", TENANT_ID)
      .in("sku", skuList);

    const productExternalBySku = new Map<string, string | null>();
    for (const row of (products ?? []) as Array<{
      sku: string;
      external_id: string | null;
    }>) {
      productExternalBySku.set(row.sku, row.external_id);
    }

    const poNumber = await generatePoNumber();
    const now = new Date().toISOString();
    const lineTotals = items.map((item) => ({
      lineTotal: computeLineTotal(item.quantity, item.unitPrice),
    }));
    const totalAmount = sumKnownLineTotals(lineTotals);

    const { data: purchaseOrder, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        tenant_id: TENANT_ID,
        external_id: poNumber,
        po_number: poNumber,
        supplier_external_id: supplierExternalId,
        supplier_code:
          (supplier as { supplier_code?: string | null } | null)
            ?.supplier_code ?? null,
        po_date: now,
        status: "draft",
        total_amount: totalAmount,
        memo: null,
        source_system: "po-cart",
        source_updated_at: now,
        created_by: auth.email,
      })
      .select("id, po_number")
      .single();

    if (orderError || !purchaseOrder) {
      return NextResponse.json(
        {
          error: orderError?.message ?? "Failed to create purchase order",
        },
        { status: 500 }
      );
    }

    const lineRows = items.map((item, index) => {
      const lineIndex = String(index + 1).padStart(3, "0");
      const lineTotal = computeLineTotal(item.quantity, item.unitPrice);

      return {
        tenant_id: TENANT_ID,
        external_id: `${poNumber}-${lineIndex}`,
        po_external_id: poNumber,
        po_number: poNumber,
        product_external_id: productExternalBySku.get(item.sku) ?? null,
        sku: item.sku,
        quantity_ordered: item.quantity,
        unit_cost: item.unitPrice,
        line_total: lineTotal,
        source_system: "po-cart",
        source_updated_at: now,
      };
    });

    const { error: linesError } = await supabase
      .from("purchase_order_lines")
      .insert(lineRows);

    if (linesError) {
      await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
      return NextResponse.json(
        {
          error: linesError.message ?? "Failed to create purchase order lines",
        },
        { status: 500 }
      );
    }

    try {
      await logPoAudit({
        poId: purchaseOrder.id,
        poNumber: purchaseOrder.po_number ?? poNumber,
        action: "created",
        fromStatus: null,
        toStatus: "draft",
        actor: auth.email,
        note: null,
      });
    } catch (auditError) {
      console.error(
        "PO created but audit log failed:",
        auditError,
        purchaseOrder.id
      );
    }

    const { error: clearError } = await supabase
      .from("po_cart_items")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("created_by", auth.email)
      .eq("supplier_external_id", supplierExternalId);

    if (clearError) {
      console.error(
        "PO created but cart clear failed:",
        clearError.message,
        purchaseOrder.id
      );
    }

    revalidatePath("/purchase-orders");
    revalidatePath("/reorder");

    return NextResponse.json({
      poId: purchaseOrder.id,
      poNumber: purchaseOrder.po_number ?? poNumber,
    });
  } catch (error) {
    console.error("POST /api/po-cart/submit failed:", error);
    return NextResponse.json(
      { error: "Failed to submit cart group" },
      { status: 500 }
    );
  }
}
