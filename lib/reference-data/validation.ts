import {
  ItemSupplierReferenceInput,
  NUMERIC_REFERENCE_FIELDS,
  NumericReferenceField,
  ReferenceDataActionResult,
  SUPPLIER_RELIABILITY_RATINGS,
  SupplierReliabilityRating,
} from "@/lib/types";

function parseReliabilityRating(
  value: string | null | undefined
): SupplierReliabilityRating | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  if ((SUPPLIER_RELIABILITY_RATINGS as readonly string[]).includes(trimmed)) {
    return trimmed as SupplierReliabilityRating;
  }

  return null;
}

function parseOptionalNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return Number.NaN;
  }

  return parsed;
}

function validateNumericField(
  field: NumericReferenceField,
  value: number | null
): string | null {
  if (value === null) {
    return null;
  }

  if (Number.isNaN(value)) {
    return `${field.replace(/_/g, " ")} must be a valid number`;
  }

  if (value < 0) {
    return `${field.replace(/_/g, " ")} must be greater than or equal to 0`;
  }

  return null;
}

export function parseReferenceInput(
  formData: FormData
): { data: ItemSupplierReferenceInput | null; error: string | null } {
  const sku = String(formData.get("sku") ?? "").trim();
  const supplierExternalId = String(
    formData.get("supplier_external_id") ?? ""
  ).trim();
  const vendorItemNumber = String(formData.get("vendor_item_number") ?? "").trim();
  const currency = String(formData.get("currency") ?? "JMD").trim() || "JMD";
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const supplierRegion = String(formData.get("supplier_region") ?? "").trim();
  const reliabilityRating = parseReliabilityRating(
    formData.get("reliability_rating")?.toString()
  );
  const isPriorityVendor = formData.get("is_priority_vendor") === "on" ||
    formData.get("is_priority_vendor") === "true";

  if (!sku) {
    return { data: null, error: "SKU is required" };
  }

  if (!supplierExternalId) {
    return { data: null, error: "Supplier is required" };
  }

  const numericValues = {
    lead_time_days: parseOptionalNumber(
      formData.get("lead_time_days")?.toString()
    ),
    safety_stock_months: parseOptionalNumber(
      formData.get("safety_stock_months")?.toString()
    ),
    qty_in_transit: parseOptionalNumber(formData.get("qty_in_transit")?.toString()),
    qty_in_bond: parseOptionalNumber(formData.get("qty_in_bond")?.toString()),
    qty_at_port: parseOptionalNumber(formData.get("qty_at_port")?.toString()),
    qty_in_clearing: parseOptionalNumber(
      formData.get("qty_in_clearing")?.toString()
    ),
    min_order_qty: parseOptionalNumber(formData.get("min_order_qty")?.toString()),
    pallet_qty: parseOptionalNumber(formData.get("pallet_qty")?.toString()),
    container_qty: parseOptionalNumber(
      formData.get("container_qty")?.toString()
    ),
    ordering_cost_per_order: parseOptionalNumber(
      formData.get("ordering_cost_per_order")?.toString()
    ),
    holding_cost_per_unit_year: parseOptionalNumber(
      formData.get("holding_cost_per_unit_year")?.toString()
    ),
    unit_price: parseOptionalNumber(formData.get("unit_price")?.toString()),
  };

  for (const field of NUMERIC_REFERENCE_FIELDS) {
    const validationError = validateNumericField(field, numericValues[field]);
    if (validationError) {
      return { data: null, error: validationError };
    }
  }

  return {
    data: {
      sku,
      supplier_external_id: supplierExternalId,
      vendor_item_number: vendorItemNumber || null,
      lead_time_days: numericValues.lead_time_days,
      safety_stock_months: numericValues.safety_stock_months,
      qty_in_transit: numericValues.qty_in_transit,
      qty_in_bond: numericValues.qty_in_bond,
      qty_at_port: numericValues.qty_at_port,
      qty_in_clearing: numericValues.qty_in_clearing,
      pallet_qty: numericValues.pallet_qty,
      container_qty: numericValues.container_qty,
      is_priority_vendor: isPriorityVendor,
      ordering_cost_per_order: numericValues.ordering_cost_per_order,
      holding_cost_per_unit_year: numericValues.holding_cost_per_unit_year,
      unit_price: numericValues.unit_price,
      currency,
      reliability_rating: reliabilityRating,
      supplier_region: supplierRegion || null,
      min_order_qty: numericValues.min_order_qty,
      notes: notesRaw || null,
    },
    error: null,
  };
}

export function validateReferenceInputClient(
  input: ItemSupplierReferenceInput
): ReferenceDataActionResult {
  if (!input.sku.trim()) {
    return { success: false, error: "SKU is required" };
  }

  if (!input.supplier_external_id.trim()) {
    return { success: false, error: "Supplier is required" };
  }

  const numericValues: Record<NumericReferenceField, number | null> = {
    lead_time_days: input.lead_time_days,
    safety_stock_months: input.safety_stock_months,
    qty_in_transit: input.qty_in_transit,
    qty_in_bond: input.qty_in_bond,
    qty_at_port: input.qty_at_port,
    qty_in_clearing: input.qty_in_clearing,
    min_order_qty: input.min_order_qty,
    pallet_qty: input.pallet_qty,
    container_qty: input.container_qty,
    ordering_cost_per_order: input.ordering_cost_per_order,
    holding_cost_per_unit_year: input.holding_cost_per_unit_year,
    unit_price: input.unit_price,
  };

  for (const field of NUMERIC_REFERENCE_FIELDS) {
    const validationError = validateNumericField(field, numericValues[field]);
    if (validationError) {
      return { success: false, error: validationError };
    }
  }

  return { success: true };
}

export function inputToFormFields(input: ItemSupplierReferenceInput): Record<string, string> {
  return {
    sku: input.sku,
    supplier_external_id: input.supplier_external_id,
    vendor_item_number: input.vendor_item_number ?? "",
    lead_time_days: input.lead_time_days?.toString() ?? "",
    safety_stock_months: input.safety_stock_months?.toString() ?? "",
    qty_in_transit: input.qty_in_transit?.toString() ?? "",
    qty_in_bond: input.qty_in_bond?.toString() ?? "",
    qty_at_port: input.qty_at_port?.toString() ?? "",
    qty_in_clearing: input.qty_in_clearing?.toString() ?? "",
    pallet_qty: input.pallet_qty?.toString() ?? "",
    container_qty: input.container_qty?.toString() ?? "",
    ordering_cost_per_order: input.ordering_cost_per_order?.toString() ?? "",
    holding_cost_per_unit_year:
      input.holding_cost_per_unit_year?.toString() ?? "",
    unit_price: input.unit_price?.toString() ?? "",
    currency: input.currency || "JMD",
    reliability_rating: input.reliability_rating ?? "",
    supplier_region: input.supplier_region ?? "",
    min_order_qty: input.min_order_qty?.toString() ?? "",
    notes: input.notes ?? "",
    is_priority_vendor: input.is_priority_vendor ? "true" : "false",
  };
}

export function rowToInput(
  row: ItemSupplierReferenceInput & { id?: string }
): ItemSupplierReferenceInput {
  return {
    sku: row.sku,
    supplier_external_id: row.supplier_external_id,
    vendor_item_number: row.vendor_item_number,
    lead_time_days: row.lead_time_days,
    safety_stock_months: row.safety_stock_months,
    qty_in_transit: row.qty_in_transit,
    qty_in_bond: row.qty_in_bond,
    qty_at_port: row.qty_at_port,
    qty_in_clearing: row.qty_in_clearing,
    pallet_qty: row.pallet_qty,
    container_qty: row.container_qty,
    is_priority_vendor: row.is_priority_vendor,
    ordering_cost_per_order: row.ordering_cost_per_order,
    holding_cost_per_unit_year: row.holding_cost_per_unit_year,
    unit_price: row.unit_price,
    currency: row.currency || "JMD",
    reliability_rating: row.reliability_rating,
    supplier_region: row.supplier_region,
    min_order_qty: row.min_order_qty,
    notes: row.notes,
  };
}
