import { NextRequest, NextResponse } from "next/server";
import { getSupplierNameMap } from "@/lib/queries/suppliers";
import { sortSupplierReferencesForComparison } from "@/lib/suppliers/sort-supplier-references";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupplierReference, SupplierReliabilityRating } from "@/lib/types";

type SupplierReferenceRow = {
  supplier_external_id: string;
  unit_price: number | null;
  lead_time_days: number | null;
  is_priority_vendor: boolean | null;
  vendor_item_number: string | null;
  currency: string | null;
  reliability_rating: string | null;
  supplier_region: string | null;
  min_order_qty: number | null;
  notes: string | null;
};

function parseReliabilityRating(
  value: string | null
): SupplierReliabilityRating | null {
  if (
    value === "Preferred" ||
    value === "Approved" ||
    value === "Conditional"
  ) {
    return value;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const sku = request.nextUrl.searchParams.get("sku");
  const tenantId =
    request.nextUrl.searchParams.get("tenantId") ?? "tropical-battery";

  if (!sku) {
    return NextResponse.json({ suppliers: [] });
  }

  try {
    const supabase = createAdminClient();
    const [referenceResult, supplierNames] = await Promise.all([
      supabase
        .from("item_supplier_reference")
        .select(
          "supplier_external_id, unit_price, lead_time_days, is_priority_vendor, vendor_item_number, currency, reliability_rating, supplier_region, min_order_qty, notes"
        )
        .eq("tenant_id", tenantId)
        .eq("sku", sku),
      getSupplierNameMap(),
    ]);

    if (referenceResult.error) {
      console.error("Supplier fetch error:", referenceResult.error);
      return NextResponse.json({ suppliers: [] });
    }

    const suppliers: SupplierReference[] = (
      (referenceResult.data ?? []) as SupplierReferenceRow[]
    ).map((row) => ({
      supplierExternalId: row.supplier_external_id,
      supplierName: supplierNames.get(row.supplier_external_id) ?? null,
      unitPrice: row.unit_price,
      leadTimeDays: row.lead_time_days,
      isPriorityVendor: row.is_priority_vendor ?? false,
      vendorItemNumber: row.vendor_item_number,
      currency: row.currency ?? "JMD",
      reliabilityRating: parseReliabilityRating(row.reliability_rating),
      supplierRegion: row.supplier_region,
      minOrderQty: row.min_order_qty,
      notes: row.notes,
    }));

    return NextResponse.json({
      suppliers: sortSupplierReferencesForComparison(suppliers),
    });
  } catch (err) {
    console.error("Supplier route error:", err);
    return NextResponse.json({ suppliers: [] });
  }
}
