"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { KNOWN_INBOUND_SUPPLIERS } from "@/lib/inbound-containers/parse";
import type { InboundContainerRecord } from "@/lib/inbound-containers/group";

export type InboundContainerFormValues = {
  supplier: string;
  supplier_invoice: string;
  quote_ref: string;
  container_count: string;
  container_size: string;
  eta_port: string;
  eta_warehouse: string;
  bl_number: string;
  container_numbers: string;
};

const SIZE_PRESETS = ["20FT", "40FT"] as const;

const emptyValues = (): InboundContainerFormValues => ({
  supplier: "",
  supplier_invoice: "",
  quote_ref: "",
  container_count: "1",
  container_size: "20FT",
  eta_port: "",
  eta_warehouse: "",
  bl_number: "",
  container_numbers: "",
});

function valuesFromRow(row: InboundContainerRecord): InboundContainerFormValues {
  const size = row.containerSize?.trim() ?? "";
  return {
    supplier: row.supplier,
    supplier_invoice: row.supplierInvoice ?? "",
    quote_ref: row.quoteRef ?? "",
    container_count:
      row.containerCount != null ? String(row.containerCount) : "1",
    container_size: size || "20FT",
    eta_port: toDateInputValue(row.etaPort),
    eta_warehouse: toDateInputValue(row.etaWarehouse),
    bl_number: row.blNumber ?? "",
    container_numbers: row.containerNumbers ?? "",
  };
}

/** ISO / date-like text → YYYY-MM-DD for <input type="date">. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const text = value.trim();
  if (!text || /^tba$/i.test(text)) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

const labelClass =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]";
const inputClass =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111111] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

type InboundContainerFormModalProps = {
  open: boolean;
  mode: "add" | "edit";
  initialRow?: InboundContainerRecord | null;
  /** Extra supplier names already on the page (free-text history). */
  extraSuppliers?: string[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: InboundContainerFormValues) => void;
};

export function InboundContainerFormModal({
  open,
  mode,
  initialRow,
  extraSuppliers = [],
  busy = false,
  error = null,
  onClose,
  onSubmit,
}: InboundContainerFormModalProps) {
  const [values, setValues] = useState<InboundContainerFormValues>(emptyValues);
  const [sizeIsOther, setSizeIsOther] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialRow) {
      const next = valuesFromRow(initialRow);
      setValues(next);
      setSizeIsOther(
        Boolean(next.container_size) &&
          !SIZE_PRESETS.includes(
            next.container_size.toUpperCase() as (typeof SIZE_PRESETS)[number]
          )
      );
    } else {
      setValues(emptyValues());
      setSizeIsOther(false);
    }
  }, [open, mode, initialRow]);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>([
      ...KNOWN_INBOUND_SUPPLIERS,
      ...extraSuppliers.filter(Boolean),
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [extraSuppliers]);

  function update<K extends keyof InboundContainerFormValues>(
    key: K,
    value: InboundContainerFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      ariaLabelledBy="inbound-container-form-title"
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2
            id="inbound-container-form-title"
            className="text-lg font-semibold text-[#111111]"
          >
            {mode === "add" ? "Add container" : "Edit container"}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            {mode === "add"
              ? "Manual entry is kept when a sheet is uploaded."
              : "Updates save immediately to this shipment row."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="inbound-supplier" className={labelClass}>
              Supplier
            </label>
            <input
              id="inbound-supplier"
              list="inbound-supplier-options"
              required
              value={values.supplier}
              onChange={(e) => update("supplier", e.target.value)}
              className={inputClass}
              placeholder="Select or type a supplier"
              disabled={busy}
            />
            <datalist id="inbound-supplier-options">
              {supplierOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="inbound-invoice" className={labelClass}>
              Supplier invoice
            </label>
            <input
              id="inbound-invoice"
              value={values.supplier_invoice}
              onChange={(e) => update("supplier_invoice", e.target.value)}
              className={inputClass}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="inbound-quote" className={labelClass}>
              Quote ref
            </label>
            <input
              id="inbound-quote"
              value={values.quote_ref}
              onChange={(e) => update("quote_ref", e.target.value)}
              className={inputClass}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="inbound-count" className={labelClass}>
              Container count
            </label>
            <input
              id="inbound-count"
              type="number"
              min={0}
              step={1}
              value={values.container_count}
              onChange={(e) => update("container_count", e.target.value)}
              className={inputClass}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="inbound-size" className={labelClass}>
              Size
            </label>
            <div className="flex gap-2">
              <select
                id="inbound-size"
                value={
                  sizeIsOther
                    ? "OTHER"
                    : SIZE_PRESETS.includes(
                        values.container_size.toUpperCase() as (typeof SIZE_PRESETS)[number]
                      )
                      ? values.container_size.toUpperCase()
                      : "OTHER"
                }
                onChange={(e) => {
                  if (e.target.value === "OTHER") {
                    setSizeIsOther(true);
                    if (
                      SIZE_PRESETS.includes(
                        values.container_size.toUpperCase() as (typeof SIZE_PRESETS)[number]
                      )
                    ) {
                      update("container_size", "");
                    }
                  } else {
                    setSizeIsOther(false);
                    update("container_size", e.target.value);
                  }
                }}
                className={inputClass}
                disabled={busy}
              >
                <option value="20FT">20FT</option>
                <option value="40FT">40FT</option>
                <option value="OTHER">Other</option>
              </select>
              {sizeIsOther ? (
                <input
                  value={values.container_size}
                  onChange={(e) => update("container_size", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 45FT"
                  disabled={busy}
                />
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="inbound-eta-port" className={labelClass}>
              ETA port
            </label>
            <input
              id="inbound-eta-port"
              type="date"
              value={values.eta_port}
              onChange={(e) => update("eta_port", e.target.value)}
              className={inputClass}
              disabled={busy}
            />
            <p className="mt-1 text-[11px] text-[#9CA3AF]">Leave empty for TBA</p>
          </div>

          <div>
            <label htmlFor="inbound-eta-whse" className={labelClass}>
              ETA warehouse
            </label>
            <input
              id="inbound-eta-whse"
              type="date"
              value={values.eta_warehouse}
              onChange={(e) => update("eta_warehouse", e.target.value)}
              className={inputClass}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="inbound-bl" className={labelClass}>
              BL#
            </label>
            <input
              id="inbound-bl"
              value={values.bl_number}
              onChange={(e) => update("bl_number", e.target.value)}
              className={inputClass}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="inbound-numbers" className={labelClass}>
              Container numbers
            </label>
            <input
              id="inbound-numbers"
              value={values.container_numbers}
              onChange={(e) => update("container_numbers", e.target.value)}
              className={inputClass}
              disabled={busy}
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-[#FCA5A5] bg-[#FDF2F2] px-3 py-2 text-sm text-[#CC2B2B]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !values.supplier.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <i className="ti ti-loader-2 animate-spin text-base" aria-hidden />
                Saving…
              </>
            ) : mode === "add" ? (
              "Add container"
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
