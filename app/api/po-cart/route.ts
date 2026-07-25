import {
  coerceNullableNumber,
  coerceOptionalString,
  coercePositiveQuantity,
  requireUserEmail,
} from "@/lib/po/cart-auth";
import {
  buildCartResponse,
  fetchUserCartItems,
  lookupSupplierNames,
  lookupSupplierUnitPrice,
  lookupUnitOfMeasureBySkus,
  mapCartRow,
  mapCartRowsWithUom,
} from "@/lib/po/cart";
import {
  getItemPurchaseRuleForSku,
  isPurchaseBlocked,
  purchaseBlockErrorMessage,
} from "@/lib/queries/item-purchase-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const rows = await fetchUserCartItems(auth.email);
    const items = await mapCartRowsWithUom(rows);
    const supplierIds = Array.from(
      new Set(
        items
          .map((item) => item.supplierExternalId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const supplierNames = await lookupSupplierNames(supplierIds);

    return NextResponse.json(buildCartResponse(items, supplierNames));
  } catch (error) {
    console.error("GET /api/po-cart failed:", error);
    return NextResponse.json(
      { error: "Failed to load cart" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const sku = coerceOptionalString(body.sku);
    const quantity = coercePositiveQuantity(body.quantity);

    if (!sku) {
      return NextResponse.json({ error: "sku is required" }, { status: 400 });
    }

    if (quantity === null) {
      return NextResponse.json(
        { error: "quantity must be a number greater than 0" },
        { status: 400 }
      );
    }

    const purchaseRule = await getItemPurchaseRuleForSku(sku);
    if (isPurchaseBlocked(purchaseRule)) {
      return NextResponse.json(
        {
          error: purchaseBlockErrorMessage(sku, purchaseRule.ruleType),
        },
        { status: 400 }
      );
    }

    let supplierExternalId = coerceOptionalString(body.supplierExternalId);
    let unitPrice = coerceNullableNumber(body.unitPrice);

    if (
      purchaseRule?.ruleType === "vendor_lock" &&
      purchaseRule.lockedVendorId
    ) {
      supplierExternalId = purchaseRule.lockedVendorId;
      const lockedPrice = await lookupSupplierUnitPrice(
        sku,
        purchaseRule.lockedVendorId
      );
      if (lockedPrice !== null) {
        unitPrice = lockedPrice;
      }
    }

    const productName = coerceOptionalString(body.productName);
    const sourceStatus = coerceOptionalString(body.sourceStatus);
    const now = new Date().toISOString();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("po_cart_items")
      .upsert(
        {
          tenant_id: TENANT_ID,
          created_by: auth.email,
          sku,
          quantity,
          supplier_external_id: supplierExternalId,
          unit_price: unitPrice,
          product_name: productName,
          source_status: sourceStatus,
          currency: "USD",
          updated_at: now,
        },
        { onConflict: "tenant_id,created_by,sku" }
      )
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to upsert cart item" },
        { status: 500 }
      );
    }

    const uomBySku = await lookupUnitOfMeasureBySkus([sku]);
    return NextResponse.json({
      item: mapCartRow(data, uomBySku.get(sku) ?? null),
    });
  } catch (error) {
    console.error("POST /api/po-cart failed:", error);
    return NextResponse.json(
      { error: "Failed to add cart item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get("all") === "true";
    const sku = coerceOptionalString(searchParams.get("sku"));

    const supabase = createAdminClient();

    if (clearAll) {
      const { error } = await supabase
        .from("po_cart_items")
        .delete()
        .eq("tenant_id", TENANT_ID)
        .eq("created_by", auth.email);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ cleared: true });
    }

    if (!sku) {
      return NextResponse.json(
        { error: "Provide ?sku= or ?all=true" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("po_cart_items")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("created_by", auth.email)
      .eq("sku", sku);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ removed: sku });
  } catch (error) {
    console.error("DELETE /api/po-cart failed:", error);
    return NextResponse.json(
      { error: "Failed to remove cart item" },
      { status: 500 }
    );
  }
}
