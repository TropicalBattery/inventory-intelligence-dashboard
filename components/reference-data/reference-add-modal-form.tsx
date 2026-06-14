"use client";

import type {
  ItemSupplierReferenceInput,
  ProductOption,
  SupplierOption,
} from "@/lib/types";

type ReferenceAddModalFormProps = {
  input: ItemSupplierReferenceInput;
  products: ProductOption[];
  suppliers: SupplierOption[];
  onChange: (next: ItemSupplierReferenceInput) => void;
};

const labelClassName = "mb-1 block text-sm font-medium text-slate-700";
const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

export function ReferenceAddModalForm({
  input,
  products,
  suppliers,
  onChange,
}: ReferenceAddModalFormProps) {
  function updateField<K extends keyof ItemSupplierReferenceInput>(
    key: K,
    value: ItemSupplierReferenceInput[K]
  ) {
    onChange({ ...input, [key]: value });
  }

  function updateNumericField(
    key:
      | "lead_time_days"
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
    <div className="space-y-4">
      <div>
        <label htmlFor="add-sku" className={labelClassName}>
          SKU
        </label>
        <select
          id="add-sku"
          value={input.sku}
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
        <label htmlFor="add-supplier" className={labelClassName}>
          Supplier
        </label>
        <select
          id="add-supplier"
          value={input.supplier_external_id}
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
        <label htmlFor="add-vendor-item" className={labelClassName}>
          Vendor item #
        </label>
        <input
          id="add-vendor-item"
          value={input.vendor_item_number ?? ""}
          onChange={(event) =>
            updateField("vendor_item_number", event.target.value || null)
          }
          className={inputClassName}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="add-lead-time" className={labelClassName}>
            Lead time (days)
          </label>
          <input
            id="add-lead-time"
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
          <label htmlFor="add-pallet-qty" className={labelClassName}>
            Pallet qty
          </label>
          <input
            id="add-pallet-qty"
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
          <label htmlFor="add-container-qty" className={labelClassName}>
            Container qty
          </label>
          <input
            id="add-container-qty"
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
          <label htmlFor="add-ordering-cost" className={labelClassName}>
            Ordering cost
          </label>
          <input
            id="add-ordering-cost"
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
          <label htmlFor="add-holding-cost" className={labelClassName}>
            Holding cost/unit/year
          </label>
          <input
            id="add-holding-cost"
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
          <label htmlFor="add-unit-price" className={labelClassName}>
            Unit price
          </label>
          <input
            id="add-unit-price"
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
      </div>

      <div className="flex items-center gap-2">
        <input
          id="add-priority-vendor"
          type="checkbox"
          checked={input.is_priority_vendor}
          onChange={(event) =>
            updateField("is_priority_vendor", event.target.checked)
          }
          className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/20"
        />
        <label
          htmlFor="add-priority-vendor"
          className="text-sm font-medium text-slate-700"
        >
          Priority vendor
        </label>
      </div>

      <div>
        <label htmlFor="add-notes" className={labelClassName}>
          Notes
        </label>
        <textarea
          id="add-notes"
          rows={3}
          value={input.notes ?? ""}
          onChange={(event) => updateField("notes", event.target.value || null)}
          className={inputClassName}
        />
      </div>
    </div>
  );
}
