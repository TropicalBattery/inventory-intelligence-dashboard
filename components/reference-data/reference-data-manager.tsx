"use client";

import Link from "next/link";
import { Check, Database, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import {
  createReferenceRow,
  deleteReferenceRow,
  updateReferenceRow,
} from "@/app/(main)/reference-data/actions";
import { ReferenceAddModalForm } from "@/components/reference-data/reference-add-modal-form";
import {
  emptyReferenceInput,
  formatOptionalCurrency,
  formatOptionalNumber,
  referenceInputToFormData,
  rowToReferenceInput,
  validateBeforeSubmit,
} from "@/components/reference-data/reference-form-fields";
import { isPlaceholderReferenceRow } from "@/lib/reference-data/placeholder-rows";
import { NO_QUOTE_ON_FILE_LABEL } from "@/lib/suppliers/no-quote";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import {  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type {
  ItemSupplierReferenceInput,
  ItemSupplierReferenceRow,
  ProductOption,
  SupplierOption,
} from "@/lib/types";

type ReferenceDataManagerProps = {
  rows: ItemSupplierReferenceRow[];
  products: ProductOption[];
  suppliers: SupplierOption[];
  totalCount: number;
  page: number;
  totalPages: number;
  search: string;
};

const filterInputClassName =
  "h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

const inlineInputClassName =
  "w-full min-w-[4.5rem] rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

const iconButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50";

const editActionClassName = `${iconButtonClassName} text-[#6B7280] hover:border-tbc-red hover:bg-tbc-red-light hover:text-tbc-red`;

const deleteActionClassName = `${iconButtonClassName} text-[#6B7280] hover:border-red-300 hover:bg-[#FDF2F2] hover:text-red-600`;

function buildPageHref(page: number, search: string): string {
  const params = new URLSearchParams();
  if (search) {
    params.set("q", search);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/reference-data?${query}` : "/reference-data";
}

function PriorityVendorBadge({ isPriority }: { isPriority: boolean }) {
  if (!isPriority) {
    return <span className="text-slate-400">No</span>;
  }

  return <Badge variant="success">Priority</Badge>;
}

function updateNumericField(
  input: ItemSupplierReferenceInput,
  key:
    | "lead_time_days"
    | "safety_stock_months"
    | "qty_in_transit"
    | "qty_in_bond"
    | "qty_at_port"
    | "qty_in_clearing"
    | "pallet_qty"
    | "container_qty"
    | "ordering_cost_per_order"
    | "holding_cost_per_unit_year"
    | "unit_price",
  value: string
): ItemSupplierReferenceInput {
  const trimmed = value.trim();
  return {
    ...input,
    [key]: trimmed === "" ? null : Number(trimmed),
  };
}

export function ReferenceDataManager({
  rows,
  products,
  suppliers,
  totalCount,
  page,
  totalPages,
  search,
}: ReferenceDataManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addInput, setAddInput] = useState<ItemSupplierReferenceInput>(
    emptyReferenceInput()
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<ItemSupplierReferenceInput>(
    emptyReferenceInput()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchInput.trim()) {
      params.set("q", searchInput.trim());
    }
    router.push(
      params.toString()
        ? `/reference-data?${params.toString()}`
        : "/reference-data"
    );
  }

  function openAddModalForRow(row?: ItemSupplierReferenceRow) {
    if (row && isPlaceholderReferenceRow(row)) {
      setAddInput({
        ...emptyReferenceInput(),
        sku: row.sku,
        supplier_external_id: row.supplier_external_id,
      });
    } else {
      setAddInput(emptyReferenceInput());
    }
    setErrorMessage(null);
    setShowAddModal(true);
  }

  function openAddModal() {
    openAddModalForRow();
  }

  function closeAddModal() {
    setShowAddModal(false);
    setAddInput(emptyReferenceInput());
    setErrorMessage(null);
  }

  function startEditing(row: ItemSupplierReferenceRow) {
    setEditingId(row.id);
    setEditInput(rowToReferenceInput(row));
    setErrorMessage(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditInput(emptyReferenceInput());
    setErrorMessage(null);
  }

  function handleCreate() {
    const validationError = validateBeforeSubmit(addInput);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    startTransition(async () => {
      const result = await createReferenceRow(referenceInputToFormData(addInput));
      if (!result.success) {
        setErrorMessage(result.error ?? "Failed to create row");
        return;
      }

      closeAddModal();
      router.refresh();
    });
  }

  function handleUpdate(id: string) {
    const validationError = validateBeforeSubmit(editInput);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    startTransition(async () => {
      const result = await updateReferenceRow(
        id,
        referenceInputToFormData(editInput)
      );
      if (!result.success) {
        setErrorMessage(result.error ?? "Failed to update row");
        return;
      }

      cancelEditing();
      router.refresh();
    });
  }

  function handleDelete(id: string, sku: string, supplierName: string | null) {
    const label = `${sku}${supplierName ? ` / ${supplierName}` : ""}`;
    const confirmed = window.confirm(
      `Delete reference row for ${label}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteReferenceRow(id);
      if (!result.success) {
        setErrorMessage(result.error ?? "Failed to delete row");
        return;
      }

      if (editingId === id) {
        cancelEditing();
      }

      router.refresh();
    });
  }

  const addRowButton = (
    <button
      type="button"
      onClick={openAddModal}
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add Row
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">{addRowButton}</div>

      <form        onSubmit={handleSearchSubmit}
        className="flex flex-wrap items-end gap-4 rounded-2xl border border-transparent shadow-card bg-white p-4"
      >
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="reference-search"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="reference-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by SKU or product name"
              className={filterInputClassName}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Filter
          </label>
          <button
            type="submit"
            className="h-10 rounded-2xl border border-transparent shadow-card bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Search
          </button>
        </div>
      </form>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      {totalCount === 0 && !search ? (
        <Card className="p-0">
          <EmptyState
            icon={Database}
            title="No reference data yet"
            description="Add lead times, pack sizes, and costs for items where this information isn't available from the source system."
            action={addRowButton}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-slate-600">
          No rows match your search.
        </Card>
      ) : (
        <div className="overflow-x-auto">
        <Table containerClassName="min-w-[88rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Vendor #</TableHead>
              <TableHead className="text-right">Lead time</TableHead>
              <TableHead className="text-right">Safety mo.</TableHead>
              <TableHead className="text-right">Transit</TableHead>
              <TableHead className="text-right">Bond</TableHead>
              <TableHead className="text-right">Port</TableHead>
              <TableHead className="text-right">Clearing</TableHead>
              <TableHead className="text-right">Pallet</TableHead>
              <TableHead className="text-right">Container</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Order cost</TableHead>
              <TableHead className="text-right">Hold cost</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isEditing = editingId === row.id;
              const isMissingQuote = isPlaceholderReferenceRow(row);

              if (isEditing) {
                return (
                  <TableRow key={row.id} className="bg-blue-50 hover:bg-blue-50">
                    <TableCell>
                      <select
                        value={editInput.sku}
                        disabled
                        className={inlineInputClassName}
                      >
                        <option value={editInput.sku}>{editInput.sku}</option>
                      </select>
                    </TableCell>
                    <TableCell>{row.product_name ?? "-"}</TableCell>
                    <TableCell>
                      <select
                        value={editInput.supplier_external_id}
                        disabled
                        className={inlineInputClassName}
                      >
                        <option value={editInput.supplier_external_id}>
                          {row.supplier_name ?? editInput.supplier_external_id}
                        </option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <input
                        value={editInput.vendor_item_number ?? ""}
                        onChange={(event) =>
                          setEditInput({
                            ...editInput,
                            vendor_item_number: event.target.value || null,
                          })
                        }
                        className={inlineInputClassName}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInput.lead_time_days ?? ""}
                        onChange={(event) =>
                          setEditInput(
                            updateNumericField(
                              editInput,
                              "lead_time_days",
                              event.target.value
                            )
                          )
                        }
                        className={`${inlineInputClassName} text-right`}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInput.safety_stock_months ?? ""}
                        onChange={(event) =>
                          setEditInput(
                            updateNumericField(
                              editInput,
                              "safety_stock_months",
                              event.target.value
                            )
                          )
                        }
                        className={`${inlineInputClassName} text-right`}
                      />
                    </TableCell>
                    {(
                      [
                        "qty_in_transit",
                        "qty_in_bond",
                        "qty_at_port",
                        "qty_in_clearing",
                      ] as const
                    ).map((field) => (
                      <TableCell key={field}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editInput[field] ?? ""}
                          onChange={(event) =>
                            setEditInput(
                              updateNumericField(
                                editInput,
                                field,
                                event.target.value
                              )
                            )
                          }
                          className={`${inlineInputClassName} text-right`}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInput.pallet_qty ?? ""}
                        onChange={(event) =>
                          setEditInput(
                            updateNumericField(
                              editInput,
                              "pallet_qty",
                              event.target.value
                            )
                          )
                        }
                        className={`${inlineInputClassName} text-right`}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInput.container_qty ?? ""}
                        onChange={(event) =>
                          setEditInput(
                            updateNumericField(
                              editInput,
                              "container_qty",
                              event.target.value
                            )
                          )
                        }
                        className={`${inlineInputClassName} text-right`}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={editInput.is_priority_vendor}
                        onChange={(event) =>
                          setEditInput({
                            ...editInput,
                            is_priority_vendor: event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/20"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInput.ordering_cost_per_order ?? ""}
                        onChange={(event) =>
                          setEditInput(
                            updateNumericField(
                              editInput,
                              "ordering_cost_per_order",
                              event.target.value
                            )
                          )
                        }
                        className={`${inlineInputClassName} text-right`}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInput.holding_cost_per_unit_year ?? ""}
                        onChange={(event) =>
                          setEditInput(
                            updateNumericField(
                              editInput,
                              "holding_cost_per_unit_year",
                              event.target.value
                            )
                          )
                        }
                        className={`${inlineInputClassName} text-right`}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editInput.unit_price ?? ""}
                        onChange={(event) =>
                          setEditInput(
                            updateNumericField(
                              editInput,
                              "unit_price",
                              event.target.value
                            )
                          )
                        }
                        className={`${inlineInputClassName} text-right`}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        value={editInput.notes ?? ""}
                        onChange={(event) =>
                          setEditInput({
                            ...editInput,
                            notes: event.target.value || null,
                          })
                        }
                        className={inlineInputClassName}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdate(row.id)}
                          className={`${iconButtonClassName} border-green-200 text-green-700 hover:bg-green-50`}
                          title="Save"
                          aria-label="Save changes"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={cancelEditing}
                          className={`${iconButtonClassName} text-slate-600`}
                          title="Cancel"
                          aria-label="Cancel editing"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow
                  key={row.id}
                  className={isMissingQuote ? "bg-slate-50/80" : undefined}
                >
                  <TableCell className="font-medium text-slate-900">
                    {row.sku}
                  </TableCell>
                  <TableCell>{row.product_name ?? "-"}</TableCell>
                  <TableCell>
                    {row.supplier_name ?? row.supplier_external_id}
                  </TableCell>
                  <TableCell>
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      (row.vendor_item_number ?? "-")
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.lead_time_days)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.safety_stock_months)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.qty_in_transit)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.qty_in_bond)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.qty_at_port)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.qty_in_clearing)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.pallet_qty)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalNumber(row.container_qty)
                    )}
                  </TableCell>
                  <TableCell>
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <PriorityVendorBadge isPriority={row.is_priority_vendor} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalCurrency(row.ordering_cost_per_order)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      formatOptionalCurrency(row.holding_cost_per_unit_year)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMissingQuote ? (
                      <span className="text-sm text-slate-500 italic">
                        {NO_QUOTE_ON_FILE_LABEL}
                      </span>
                    ) : (
                      formatOptionalCurrency(row.unit_price)
                    )}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate">
                    {isMissingQuote ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      (row.notes ?? "-")
                    )}
                  </TableCell>
                  <TableCell>
                    {isMissingQuote ? (
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => openAddModalForRow(row)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-tbc-red hover:text-tbc-red"
                        >
                          Add quote
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEditing(row)}
                          className={`group ${editActionClassName}`}
                          title="Edit row"
                          aria-label={`Edit ${row.sku}`}
                        >
                          <i
                            className="ti ti-pencil text-[16px] transition-transform duration-200 group-hover:-rotate-12"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleDelete(row.id, row.sku, row.supplier_name)
                          }
                          className={`group ${deleteActionClassName}`}
                          title="Delete row"
                          aria-label={`Delete ${row.sku}`}
                        >
                          <i
                            className="ti ti-trash text-[16px] transition-transform duration-200 group-hover:scale-110"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-2xl border border-transparent shadow-card bg-white px-6 py-4 text-sm">
          <p className="text-slate-600">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildPageHref(page - 1, search)}
                className="rounded-2xl border border-transparent shadow-card bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildPageHref(page + 1, search)}
                className="rounded-2xl border border-transparent shadow-card bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <Modal
        open={showAddModal}
        onClose={closeAddModal}
        ariaLabelledBy="add-reference-title"
      >
        <h3
          id="add-reference-title"
          className="text-lg font-semibold text-slate-900"
        >
          Add reference row
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Link a product SKU to supplier ordering parameters.
        </p>

        <div className="mt-4">
          <ReferenceAddModalForm
            input={addInput}
            products={products}
            suppliers={suppliers}
            onChange={setAddInput}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeAddModal}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleCreate}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
