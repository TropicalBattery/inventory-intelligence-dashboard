"use client";

import {
  inputToFormFields,
  validateReferenceInputClient,
} from "@/lib/reference-data/validation";
import { formatCurrencyJMD, formatNumber } from "@/lib/format";
import type {
  ItemSupplierReferenceInput,
  ItemSupplierReferenceRow,
  ProductOption,
  SupplierOption,
} from "@/lib/types";
import { SUPPLIER_RELIABILITY_RATINGS } from "@/lib/types";

type ReferenceFormFieldsProps = {
  input: ItemSupplierReferenceInput;
  products: ProductOption[];
  suppliers: SupplierOption[];
  onChange: (next: ItemSupplierReferenceInput) => void;
  idPrefix?: string;
  disabledKeys?: Array<"sku" | "supplier_external_id">;
};

const inputClassName =
  "w-full min-w-[7rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function ReferenceFormFields({
  input,
  products,
  suppliers,
  onChange,
  idPrefix = "ref",
  disabledKeys = [],
}: ReferenceFormFieldsProps) {
  function updateField<K extends keyof ItemSupplierReferenceInput>(
    key: K,
    value: ItemSupplierReferenceInput[K]
  ) {
    onChange({ ...input, [key]: value });
  }

  function updateNumericField(
    key:
      | "lead_time_days"
      | "safety_stock_months"
      | "qty_in_transit"
      | "qty_in_bond"
      | "qty_at_port"
      | "qty_in_clearing"
      | "min_order_qty"
      | "pallet_qty"
      | "container_qty"
      | "ordering_cost_per_order"
      | "holding_cost_per_unit_year"
      | "unit_price",
    value: string
  ) {
    const trimmed = value.trim();
    updateField(key, trimmed === "" ? null : Number(trimmed));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label htmlFor={`${idPrefix}-sku`} className="mb-1 block text-xs font-medium text-slate-600">
          SKU
        </label>
        <select
          id={`${idPrefix}-sku`}
          value={input.sku}
          disabled={disabledKeys.includes("sku")}
          onChange={(event) => updateField("sku", event.target.value)}
          className={inputClassName}
        >
          <option value="">Select SKU</option>
          {products.map((product) => (
            <option key={product.sku} value={product.sku}>
              {product.sku}
              {product.name ? ` - ${product.name}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-supplier`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Supplier
        </label>
        <select
          id={`${idPrefix}-supplier`}
          value={input.supplier_external_id}
          disabled={disabledKeys.includes("supplier_external_id")}
          onChange={(event) =>
            updateField("supplier_external_id", event.target.value)
          }
          className={inputClassName}
        >
          <option value="">Select supplier</option>
          {suppliers.map((supplier) => (
            <option key={supplier.external_id} value={supplier.external_id}>
              {supplier.name ?? supplier.external_id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-vendor-item-number`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Vendor item #
        </label>
        <input
          id={`${idPrefix}-vendor-item-number`}
          value={input.vendor_item_number ?? ""}
          onChange={(event) =>
            updateField("vendor_item_number", event.target.value || null)
          }
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-lead-time`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Lead time (days)
        </label>
        <input
          id={`${idPrefix}-lead-time`}
          type="number"
          min="0"
          step="any"
          value={input.lead_time_days ?? ""}
          onChange={(event) =>
            updateNumericField("lead_time_days", event.target.value)
          }
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-safety-stock-months`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Safety stock (months)
        </label>
        <input
          id={`${idPrefix}-safety-stock-months`}
          type="number"
          min="0"
          step="any"
          value={input.safety_stock_months ?? ""}
          onChange={(event) =>
            updateNumericField("safety_stock_months", event.target.value)
          }
          className={inputClassName}
          placeholder="3"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-reliability-rating`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Reliability rating
        </label>
        <select
          id={`${idPrefix}-reliability-rating`}
          value={input.reliability_rating ?? ""}
          onChange={(event) =>
            updateField(
              "reliability_rating",
              event.target.value
                ? (event.target.value as ItemSupplierReferenceInput["reliability_rating"])
                : null
            )
          }
          className={inputClassName}
        >
          <option value="">Select rating</option>
          {SUPPLIER_RELIABILITY_RATINGS.map((rating) => (
            <option key={rating} value={rating}>
              {rating}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-supplier-region`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Supplier region
        </label>
        <input
          id={`${idPrefix}-supplier-region`}
          value={input.supplier_region ?? ""}
          onChange={(event) =>
            updateField("supplier_region", event.target.value || null)
          }
          placeholder="e.g. Korea, Local"
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-min-order-qty`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Min order qty
        </label>
        <input
          id={`${idPrefix}-min-order-qty`}
          type="number"
          min="0"
          step="1"
          value={input.min_order_qty ?? ""}
          onChange={(event) =>
            updateNumericField("min_order_qty", event.target.value)
          }
          className={inputClassName}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pipeline stock (manual until GP sync)
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor={`${idPrefix}-qty-in-transit`}
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              In transit
            </label>
            <input
              id={`${idPrefix}-qty-in-transit`}
              type="number"
              min="0"
              step="1"
              value={input.qty_in_transit ?? ""}
              onChange={(event) =>
                updateNumericField("qty_in_transit", event.target.value)
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-qty-in-bond`}
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              In bond
            </label>
            <input
              id={`${idPrefix}-qty-in-bond`}
              type="number"
              min="0"
              step="1"
              value={input.qty_in_bond ?? ""}
              onChange={(event) =>
                updateNumericField("qty_in_bond", event.target.value)
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-qty-at-port`}
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              At port
            </label>
            <input
              id={`${idPrefix}-qty-at-port`}
              type="number"
              min="0"
              step="1"
              value={input.qty_at_port ?? ""}
              onChange={(event) =>
                updateNumericField("qty_at_port", event.target.value)
              }
              className={inputClassName}
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-qty-in-clearing`}
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              In clearing
            </label>
            <input
              id={`${idPrefix}-qty-in-clearing`}
              type="number"
              min="0"
              step="1"
              value={input.qty_in_clearing ?? ""}
              onChange={(event) =>
                updateNumericField("qty_in_clearing", event.target.value)
              }
              className={inputClassName}
            />
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-pallet-qty`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Pallet qty
        </label>
        <input
          id={`${idPrefix}-pallet-qty`}
          type="number"
          min="0"
          step="any"
          value={input.pallet_qty ?? ""}
          onChange={(event) =>
            updateNumericField("pallet_qty", event.target.value)
          }
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-container-qty`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Container qty
        </label>
        <input
          id={`${idPrefix}-container-qty`}
          type="number"
          min="0"
          step="any"
          value={input.container_qty ?? ""}
          onChange={(event) =>
            updateNumericField("container_qty", event.target.value)
          }
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-ordering-cost`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Ordering cost
        </label>
        <input
          id={`${idPrefix}-ordering-cost`}
          type="number"
          min="0"
          step="any"
          value={input.ordering_cost_per_order ?? ""}
          onChange={(event) =>
            updateNumericField("ordering_cost_per_order", event.target.value)
          }
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-holding-cost`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Holding cost/unit/year
        </label>
        <input
          id={`${idPrefix}-holding-cost`}
          type="number"
          min="0"
          step="any"
          value={input.holding_cost_per_unit_year ?? ""}
          onChange={(event) =>
            updateNumericField("holding_cost_per_unit_year", event.target.value)
          }
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-unit-price`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Unit price
        </label>
        <input
          id={`${idPrefix}-unit-price`}
          type="number"
          min="0"
          step="any"
          value={input.unit_price ?? ""}
          onChange={(event) =>
            updateNumericField("unit_price", event.target.value)
          }
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-currency`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Currency
        </label>
        <input
          id={`${idPrefix}-currency`}
          value={input.currency}
          onChange={(event) => updateField("currency", event.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <label
          htmlFor={`${idPrefix}-notes`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Notes
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          rows={2}
          value={input.notes ?? ""}
          onChange={(event) => updateField("notes", event.target.value || null)}
          className={inputClassName}
        />
      </div>

      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <input
          id={`${idPrefix}-priority-vendor`}
          type="checkbox"
          checked={input.is_priority_vendor}
          onChange={(event) =>
            updateField("is_priority_vendor", event.target.checked)
          }
          className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/20"
        />
        <label
          htmlFor={`${idPrefix}-priority-vendor`}
          className="text-sm font-medium text-slate-700"
        >
          Priority vendor
        </label>
      </div>
    </div>
  );
}

export function emptyReferenceInput(): ItemSupplierReferenceInput {
  return {
    sku: "",
    supplier_external_id: "",
    vendor_item_number: null,
    lead_time_days: null,
    safety_stock_months: null,
    qty_in_transit: null,
    qty_in_bond: null,
    qty_at_port: null,
    qty_in_clearing: null,
    reliability_rating: null,
    supplier_region: null,
    min_order_qty: null,
    pallet_qty: null,
    container_qty: null,
    is_priority_vendor: false,
    ordering_cost_per_order: null,
    holding_cost_per_unit_year: null,
    unit_price: null,
    currency: "JMD",
    notes: null,
  };
}

export function rowToReferenceInput(
  row: ItemSupplierReferenceRow
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
    reliability_rating: row.reliability_rating,
    supplier_region: row.supplier_region,
    min_order_qty: row.min_order_qty,
    pallet_qty: row.pallet_qty,
    container_qty: row.container_qty,
    is_priority_vendor: row.is_priority_vendor,
    ordering_cost_per_order: row.ordering_cost_per_order,
    holding_cost_per_unit_year: row.holding_cost_per_unit_year,
    unit_price: row.unit_price,
    currency: row.currency ?? "JMD",
    notes: row.notes,
  };
}

export function referenceInputToFormData(
  input: ItemSupplierReferenceInput
): FormData {
  const formData = new FormData();
  const fields = inputToFormFields(input);

  Object.entries(fields).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

export function formatOptionalNumber(value: number | null): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return formatNumber(value);
}

export function formatOptionalCurrency(value: number | null): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return formatCurrencyJMD(value);
}

export function validateBeforeSubmit(
  input: ItemSupplierReferenceInput
): string | null {
  const result = validateReferenceInputClient(input);
  return result.success ? null : result.error ?? "Invalid input";
}
