import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupplierReference } from "@/lib/types";

type SupplierReferenceRow = {
  supplier_external_id: string;
  unit_price: number | null;
  lead_time_days: number | null;
  is_priority_vendor: boolean | null;
  vendor_item_number: string | null;
  currency: string | null;
};

export async function GET(request: NextRequest) {
  const sku = request.nextUrl.searchParams.get("sku");
  const tenantId =
    request.nextUrl.searchParams.get("tenantId") ?? "tropical-battery";

  if (!sku) {
    return NextResponse.json({ suppliers: [] });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("item_supplier_reference")
      .select(
        "supplier_external_id, unit_price, lead_time_days, is_priority_vendor, vendor_item_number, currency"
      )
      .eq("tenant_id", tenantId)
      .eq("sku", sku)
      .order("is_priority_vendor", { ascending: false })
      .order("unit_price", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Supplier fetch error:", error);
      return NextResponse.json({ suppliers: [] });
    }

    const suppliers: SupplierReference[] = (
      (data ?? []) as SupplierReferenceRow[]
    ).map((row) => ({
      supplierExternalId: row.supplier_external_id,
      unitPrice: row.unit_price,
      leadTimeDays: row.lead_time_days,
      isPriorityVendor: row.is_priority_vendor ?? false,
      vendorItemNumber: row.vendor_item_number,
      currency: row.currency ?? "USD",
    }));

    return NextResponse.json({ suppliers });
  } catch (err) {
    console.error("Supplier route error:", err);
    return NextResponse.json({ suppliers: [] });
  }
}
