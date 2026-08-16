"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  InboundContainerFormModal,
  toDateInputValue,
  type InboundContainerFormValues,
} from "@/components/inbound-containers/inbound-container-form-modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { formatNumber, formatRelativeTimeShort } from "@/lib/format";
import type {
  InboundContainerRecord,
  InboundContainersSummary,
} from "@/lib/inbound-containers/group";
import { Package } from "lucide-react";

type InboundContainersClientProps = {
  initial: InboundContainersSummary;
};

type UploadPhase = "uploading" | "parsing" | null;

type Banner = {
  tone: "success" | "error";
  message: string;
};

type ConfirmState =
  | { kind: "upload"; file: File }
  | { kind: "refresh" }
  | { kind: "delete"; row: InboundContainerRecord }
  | null;

const primaryBtnClass =
  "inline-flex items-center gap-2 rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryBtnClass =
  "inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60";
const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-50";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatEtaDisplay(value: string | null | undefined): string {
  if (!value || !value.trim() || /^tba$/i.test(value.trim())) {
    return "TBA";
  }
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) {
    return value.trim();
  }
  const monthIdx = Number(iso[2]) - 1;
  const day = Number(iso[3]);
  if (monthIdx < 0 || monthIdx > 11 || !Number.isFinite(day)) {
    return value.trim();
  }
  return `${day} ${MONTH_SHORT[monthIdx]}`;
}

function formatArrivedTag(arrivedAt: string | null): string {
  if (!arrivedAt) return "Arrived";
  const d = new Date(arrivedAt);
  if (Number.isNaN(d.getTime())) return "Arrived";
  return `Arrived ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formToApiBody(values: InboundContainerFormValues) {
  const countRaw = values.container_count.trim();
  return {
    supplier: values.supplier.trim(),
    supplier_invoice: blankToNull(values.supplier_invoice),
    quote_ref: blankToNull(values.quote_ref),
    container_count: countRaw === "" ? 1 : Number(countRaw),
    container_size: blankToNull(values.container_size),
    eta_port: blankToNull(values.eta_port),
    eta_warehouse: blankToNull(values.eta_warehouse),
    bl_number: blankToNull(values.bl_number),
    container_numbers: blankToNull(values.container_numbers),
  };
}

function EtaPortCell({
  row,
  disabled,
  onSaved,
  onError,
}: {
  row: InboundContainerRecord;
  disabled?: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => toDateInputValue(row.etaPort));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => {
    if (disabled || row.status === "arrived") return;
    setValue(toDateInputValue(row.etaPort));
    setEditing(true);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el && "showPicker" in el && typeof el.showPicker === "function") {
        try {
          el.showPicker();
        } catch {
          el.focus();
        }
      } else {
        el?.focus();
      }
    });
  };

  const save = async (next: string) => {
    const etaPort = next.trim() || null;
    const current = toDateInputValue(row.etaPort) || null;
    if (etaPort === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inbound-containers/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, eta_port: etaPort }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        onError(payload?.error ?? "Failed to update ETA");
        return;
      }
      setEditing(false);
      await onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to update ETA");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <input
          ref={inputRef}
          type="date"
          value={value}
          disabled={saving}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            void save(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save(value);
            }
            if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          className="h-8 w-[9.5rem] rounded-md border border-[#E5E7EB] px-2 text-xs text-[#111111] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20"
        />
        <button
          type="button"
          title="Clear (TBA)"
          disabled={saving}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setValue("");
            void save("");
          }}
          className="rounded px-1 text-[10px] font-medium text-[#6B7280] hover:text-[#111111]"
        >
          TBA
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={disabled || row.status === "arrived"}
      title="Click to edit ETA port"
      className="rounded-md px-1 py-0.5 text-left text-[#374151] hover:bg-[#F3F4F6] disabled:cursor-default disabled:hover:bg-transparent"
    >
      {formatEtaDisplay(row.etaPort)}
    </button>
  );
}

export function InboundContainersClient({
  initial,
}: InboundContainersClientProps) {
  const [summary, setSummary] = useState(initial);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formRow, setFormRow] = useState<InboundContainerRecord | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = isPending || uploadPhase !== null || formBusy;

  const sizePills = useMemo(() => {
    return Object.entries(summary.bySize).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [summary.bySize]);

  const extraSuppliers = useMemo(
    () => summary.groups.map((g) => g.supplier),
    [summary.groups]
  );

  const reloadSummary = useCallback(async () => {
    const reload = await fetch("/api/inbound-containers");
    const next = (await reload.json()) as InboundContainersSummary & {
      error?: string;
    };
    if (!reload.ok) {
      throw new Error(next.error ?? "Failed to reload containers");
    }
    setSummary(next);
    return next;
  }, []);

  const showError = useCallback((message: string) => {
    setBanner({ tone: "error", message });
  }, []);

  const runRefresh = useCallback(async () => {
    try {
      const response = await fetch("/api/inbound-containers/refresh", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        inserted?: number;
        replacedUploadedRows?: number;
        sourceMonth?: string | null;
        manualRowsPreserved?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        setBanner({
          tone: "error",
          message: payload?.error ?? "Refresh failed",
        });
        return;
      }

      const next = await reloadSummary();
      const month =
        payload?.sourceMonth?.trim() || next.sourceMonth?.trim();
      const inserted = payload?.inserted ?? 0;
      const cleared = payload?.replacedUploadedRows ?? 0;
      const manualKept = payload?.manualRowsPreserved ?? 0;
      setBanner({
        tone: "success",
        message: `Loaded ${formatNumber(inserted)}${
          month ? ` for ${month}` : ""
        } (replaced ${formatNumber(cleared)} uploaded), ${formatNumber(
          manualKept
        )} manual row${manualKept === 1 ? "" : "s"} kept.`,
      });
    } catch (error) {
      setBanner({
        tone: "error",
        message: error instanceof Error ? error.message : "Refresh failed",
      });
    }
  }, [reloadSummary]);

  const handleUploadFile = useCallback(
    async (file: File) => {
      setBanner(null);
      setUploadPhase("uploading");
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/inbound-containers/upload", {
          method: "POST",
          body,
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          setBanner({
            tone: "error",
            message: payload?.error ?? "Upload failed",
          });
          return;
        }

        setUploadPhase("parsing");
        await runRefresh();
      } catch (error) {
        setBanner({
          tone: "error",
          message: error instanceof Error ? error.message : "Upload failed",
        });
      } finally {
        setUploadPhase(null);
      }
    },
    [runRefresh]
  );

  const openAdd = () => {
    setFormMode("add");
    setFormRow(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: InboundContainerRecord) => {
    setFormMode("edit");
    setFormRow(row);
    setFormError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values: InboundContainerFormValues) => {
    setFormBusy(true);
    setFormError(null);
    try {
      const body = formToApiBody(values);
      if (formMode === "add" && summary.sourceMonth) {
        (body as Record<string, unknown>).source_month = summary.sourceMonth;
      }

      const response = await fetch("/api/inbound-containers/item", {
        method: formMode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          formMode === "edit" && formRow
            ? { id: formRow.id, ...body }
            : body
        ),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setFormError(payload?.error ?? "Save failed");
        return;
      }

      setFormOpen(false);
      await reloadSummary();
      setBanner({
        tone: "success",
        message:
          formMode === "add" ? "Container added." : "Container updated.",
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setFormBusy(false);
    }
  };

  const handleArrive = async (row: InboundContainerRecord, undo: boolean) => {
    setRowBusyId(row.id);
    setBanner(null);
    try {
      const response = await fetch(
        `/api/inbound-containers/${encodeURIComponent(row.id)}/arrive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(undo ? { undo: true } : {}),
        }
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        showError(payload?.error ?? "Failed to update arrival status");
        return;
      }
      await reloadSummary();
      setBanner({
        tone: "success",
        message: undo ? "Marked back as inbound." : "Marked as arrived.",
      });
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to update arrival"
      );
    } finally {
      setRowBusyId(null);
    }
  };

  const handleDelete = async (row: InboundContainerRecord) => {
    setRowBusyId(row.id);
    setBanner(null);
    try {
      const response = await fetch("/api/inbound-containers/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        showError(payload?.error ?? "Delete failed");
        return;
      }
      await reloadSummary();
      setBanner({ tone: "success", message: "Container deleted." });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setRowBusyId(null);
      setConfirm(null);
    }
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "delete") {
      void handleDelete(confirm.row);
      return;
    }
    if (confirm.kind === "refresh") {
      setConfirm(null);
      setBanner(null);
      startTransition(async () => {
        await runRefresh();
      });
      return;
    }
    if (confirm.kind === "upload") {
      const file = confirm.file;
      setConfirm(null);
      void handleUploadFile(file);
    }
  };

  const isEmpty = summary.groups.length === 0;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            setConfirm({ kind: "upload", file });
          }
        }}
      />
      <button
        type="button"
        onClick={openAdd}
        disabled={busy}
        className={primaryBtnClass}
      >
        <i className="ti ti-plus text-base" aria-hidden />
        Add container
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className={secondaryBtnClass}
      >
        {uploadPhase ? (
          <>
            <i className="ti ti-loader-2 animate-spin text-base" aria-hidden />
            {uploadPhase === "uploading" ? "Uploading…" : "Parsing…"}
          </>
        ) : (
          <>
            <i className="ti ti-upload text-base" aria-hidden />
            Upload sheet
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => setConfirm({ kind: "refresh" })}
        disabled={busy}
        className={secondaryBtnClass}
      >
        {isPending ? (
          <>
            <i className="ti ti-loader-2 animate-spin text-base" aria-hidden />
            Refreshing…
          </>
        ) : (
          <>
            <i className="ti ti-refresh text-base" aria-hidden />
            Refresh from file
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#6B7280]">
            {summary.loadedAt
              ? `Updated ${formatRelativeTimeShort(summary.loadedAt)}`
              : "No containers yet"}
            {summary.sourceMonth ? (
              <span className="text-[#9CA3AF]"> · {summary.sourceMonth}</span>
            ) : null}
          </p>
        </div>
        {headerActions}
      </div>

      {banner ? (
        <div
          role="status"
          className={
            banner.tone === "success"
              ? "rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
              : "rounded-2xl border border-[#FCA5A5] bg-[#FDF2F2] px-4 py-3 text-sm text-[#CC2B2B]"
          }
        >
          {banner.message}
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#374151] shadow-card">
            {formatNumber(summary.totalContainers)} containers
          </span>
          {summary.arrivedContainers > 0 ? (
            <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#6B7280] shadow-card">
              {formatNumber(summary.arrivedContainers)} arrived
            </span>
          ) : null}
          {sizePills.map(([size, count]) => (
            <span
              key={size}
              className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#374151] shadow-card"
            >
              {size}: {formatNumber(count)}
            </span>
          ))}
          <span className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#374151] shadow-card">
            {formatNumber(summary.supplierCount)} suppliers
          </span>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="rounded-2xl bg-white p-0 shadow-card">
          <EmptyState
            icon={Package}
            title="No containers yet"
            description="Add one manually or upload a sheet."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={openAdd}
                  disabled={busy}
                  className={primaryBtnClass}
                >
                  <i className="ti ti-plus text-base" aria-hidden />
                  Add container
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className={secondaryBtnClass}
                >
                  <i className="ti ti-upload text-base" aria-hidden />
                  Upload sheet
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {summary.groups.map((group) => (
            <section
              key={group.supplier}
              className="overflow-hidden rounded-2xl bg-white shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3">
                <h2 className="text-base font-bold text-[#111111]">
                  {group.supplier}
                </h2>
                <p className="text-xs text-[#6B7280]">
                  {formatNumber(group.containerCountTotal)} inbound
                  {group.arrivedCountTotal > 0
                    ? ` · ${formatNumber(group.arrivedCountTotal)} arrived`
                    : ""}
                </p>
              </div>

              <div className="overflow-x-auto sm:overflow-x-visible">
                <table className="w-full min-w-0 table-fixed text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      <th className="px-4 py-2.5 font-semibold">Invoice</th>
                      <th className="hidden px-4 py-2.5 font-semibold md:table-cell">
                        Quote
                      </th>
                      <th className="w-16 px-4 py-2.5 font-semibold">Size</th>
                      <th className="w-16 px-4 py-2.5 text-right font-semibold">
                        Qty
                      </th>
                      <th className="px-4 py-2.5 font-semibold">ETA port</th>
                      <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">
                        ETA whse
                      </th>
                      <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">
                        BL#
                      </th>
                      <th className="px-4 py-2.5 font-semibold">Containers</th>
                      <th className="w-36 px-3 py-2.5 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {group.rows.map((row) => {
                      const arrived = row.status === "arrived";
                      const rowBusy = rowBusyId === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={arrived ? "bg-[#F9FAFB] text-[#9CA3AF]" : ""}
                        >
                          <td
                            className={`truncate px-4 py-2.5 ${
                              arrived ? "text-[#9CA3AF]" : "text-[#111111]"
                            }`}
                            title={row.supplierInvoice ?? undefined}
                          >
                            <span className="inline-flex max-w-full items-center gap-1.5">
                              <span className="truncate">
                                {row.supplierInvoice ?? "—"}
                              </span>
                              {row.entrySource === "manual" ? (
                                <span className="shrink-0 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#6B7280]">
                                  Manual
                                </span>
                              ) : null}
                              {arrived ? (
                                <span className="shrink-0 rounded-full border border-[#E5E7EB] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#6B7280]">
                                  {formatArrivedTag(row.arrivedAt)}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td
                            className="hidden truncate px-4 py-2.5 md:table-cell"
                            title={row.quoteRef ?? undefined}
                          >
                            {row.quoteRef ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {row.containerSize ?? "—"}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                              arrived ? "text-[#9CA3AF]" : "text-[#111111]"
                            }`}
                          >
                            {row.containerCount != null
                              ? formatNumber(row.containerCount)
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <EtaPortCell
                              row={row}
                              disabled={busy || rowBusy}
                              onSaved={async () => {
                                await reloadSummary();
                              }}
                              onError={showError}
                            />
                          </td>
                          <td className="hidden px-4 py-2.5 lg:table-cell">
                            {formatEtaDisplay(row.etaWarehouse)}
                          </td>
                          <td
                            className="hidden truncate px-4 py-2.5 font-mono text-xs lg:table-cell"
                            title={row.blNumber ?? undefined}
                          >
                            {row.blNumber ?? "—"}
                          </td>
                          <td
                            className="truncate px-4 py-2.5 font-mono text-xs"
                            title={row.containerNumbers ?? undefined}
                          >
                            {row.containerNumbers ?? "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-0.5">
                              {arrived ? (
                                <button
                                  type="button"
                                  title="Undo arrived"
                                  disabled={busy || rowBusy}
                                  onClick={() => void handleArrive(row, true)}
                                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111111] disabled:opacity-50"
                                >
                                  Undo
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Mark arrived"
                                  disabled={busy || rowBusy}
                                  onClick={() => void handleArrive(row, false)}
                                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#166534] hover:bg-[#F0FDF4] disabled:opacity-50"
                                >
                                  {rowBusy ? "…" : "Arrived"}
                                </button>
                              )}
                              <button
                                type="button"
                                title="Edit"
                                aria-label="Edit container"
                                disabled={busy || rowBusy}
                                onClick={() => openEdit(row)}
                                className={iconBtnClass}
                              >
                                <i className="ti ti-pencil text-[15px]" aria-hidden />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                aria-label="Delete container"
                                disabled={busy || rowBusy}
                                onClick={() =>
                                  setConfirm({ kind: "delete", row })
                                }
                                className={iconBtnClass}
                              >
                                <i className="ti ti-trash text-[15px]" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <InboundContainerFormModal
        open={formOpen}
        mode={formMode}
        initialRow={formRow}
        extraSuppliers={extraSuppliers}
        busy={formBusy}
        error={formError}
        onClose={() => {
          if (!formBusy) setFormOpen(false);
        }}
        onSubmit={(values) => {
          void handleFormSubmit(values);
        }}
      />

      <Modal
        open={confirm !== null}
        onClose={() => {
          if (rowBusyId) return;
          setConfirm(null);
        }}
        ariaLabelledBy="inbound-confirm-title"
        className="max-w-md"
      >
        {confirm ? (
          <div className="space-y-4">
            <h2
              id="inbound-confirm-title"
              className="text-lg font-semibold text-[#111111]"
            >
              {confirm.kind === "delete"
                ? "Delete container?"
                : "Replace uploaded containers?"}
            </h2>
            <p className="text-sm text-[#6B7280]">
              {confirm.kind === "delete" ? (
                <>
                  Remove{" "}
                  <span className="font-medium text-[#111111]">
                    {confirm.row.supplierInvoice ??
                      confirm.row.supplier ??
                      "this row"}
                  </span>
                  ? This cannot be undone.
                </>
              ) : (
                <>
                  This replaces all uploaded containers with the new file.
                  Manually added containers are kept. Continue?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={Boolean(rowBusyId)}
                className={secondaryBtnClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runConfirm}
                disabled={Boolean(rowBusyId)}
                className={
                  confirm.kind === "delete" ? primaryBtnClass : primaryBtnClass
                }
              >
                {confirm.kind === "delete" ? "Delete" : "Continue"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
