import {
  coerceOptionalString,
  coercePositiveQuantity,
  requireUserEmail,
} from "@/lib/po/cart-auth";
import { lookupSupplierUnitPrice, lookupUnitOfMeasureBySkus, mapCartRow } from "@/lib/po/cart";
import {
  getItemPurchaseRuleForSku,
  isPurchaseBlocked,
  purchaseBlockErrorMessage,
} from "@/lib/queries/item-purchase-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const sku = coerceOptionalString(body.sku);

    if (!sku) {
      return NextResponse.json({ error: "sku is required" }, { status: 400 });
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

    const hasQuantity = Object.prototype.hasOwnProperty.call(body, "quantity");
    const hasSupplier = Object.prototype.hasOwnProperty.call(
      body,
      "supplierExternalId"
    );

    if (!hasQuantity && !hasSupplier) {
      return NextResponse.json(
        { error: "Provide quantity and/or supplierExternalId" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasQuantity) {
      const quantity = coercePositiveQuantity(body.quantity);
      if (quantity === null) {
        return NextResponse.json(
          { error: "quantity must be a number greater than 0" },
          { status: 400 }
        );
      }
      updates.quantity = quantity;
    }

    if (hasSupplier) {
      let supplierExternalId =
        body.supplierExternalId === null
          ? null
          : coerceOptionalString(body.supplierExternalId);

      if (
        purchaseRule?.ruleType === "vendor_lock" &&
        purchaseRule.lockedVendorId
      ) {
        supplierExternalId = purchaseRule.lockedVendorId;
      }

      updates.supplier_external_id = supplierExternalId;

      if (supplierExternalId) {
        updates.unit_price = await lookupSupplierUnitPrice(
          sku,
          supplierExternalId
        );
      } else {
        updates.unit_price = null;
      }
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("po_cart_items")
      .update(updates)
      .eq("tenant_id", TENANT_ID)
      .eq("created_by", auth.email)
      .eq("sku", sku)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 }
      );
    }

    const uomBySku = await lookupUnitOfMeasureBySkus([sku]);
    return NextResponse.json({
      item: mapCartRow(data, uomBySku.get(sku) ?? null),
    });
  } catch (error) {
    console.error("PATCH /api/po-cart/item failed:", error);
    return NextResponse.json(
      { error: "Failed to update cart item" },
      { status: 500 }
    );
  }
}
