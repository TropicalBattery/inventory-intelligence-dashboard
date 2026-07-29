"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/auth/role-guards";
import { formatCurrencyUSD, formatNumber } from "@/lib/format";
import { resolveCartSupplierLineState } from "@/lib/po/cart-supplier-field";
import type { PoReviewSkuSupplierOption } from "@/lib/queries/po-cart-review";
import type { ItemPurchaseRule, PoCartItem } from "@/lib/types";

export type CartSupplierChangePayload = {
  supplierExternalId: string;
  override?: { reason: string };
};

type CartSupplierFieldProps = {
  item: PoCartItem;
  options: PoReviewSkuSupplierOption[];
  purchaseRule: ItemPurchaseRule | null | undefined;
  userRole: UserRole;
  /** Compact layout for the cart drawer. */
  compact?: boolean;
  onChangeSupplier: (payload: CartSupplierChangePayload) => Promise<void>;
};

function supplierLabel(option: PoReviewSkuSupplierOption): string {
  return option.supplierName?.trim() || option.supplierExternalId;
}

function formatLead(option: PoReviewSkuSupplierOption): string {
  if (option.leadTimeDays === null || !Number.isFinite(option.leadTimeDays)) {
    return "—";
  }
  return `${formatNumber(option.leadTimeDays)}d`;
}

function formatPrice(option: PoReviewSkuSupplierOption): string {
  return formatCurrencyUSD(option.unitPrice);
}

function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "priority" | "lowest" | "locked" | "muted";
}) {
  const className =
    tone === "priority"
      ? "bg-[#EEF2FF] text-[#3730A3]"
      : tone === "lowest"
        ? "bg-[#ECFDF5] text-[#047857]"
        : tone === "locked"
          ? "bg-[#F3F4F6] text-[#6B7280]"
          : "bg-[#F9FAFB] text-[#9CA3AF]";
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

function LockIcon({ open = false }: { open?: boolean }) {
  return (
    <i
      className={`ti ${open ? "ti-lock-open" : "ti-lock"} text-sm`}
      aria-hidden="true"
    />
  );
}

function OptionRow({
  option,
  selected,
  disabled,
  isLowest,
  lockedTag,
  onSelect,
  compact,
}: {
  option: PoReviewSkuSupplierOption;
  selected: boolean;
  disabled: boolean;
  isLowest: boolean;
  lockedTag?: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
        selected
          ? "border-[#CC2B2B] bg-[#FEF2F2]"
          : "border-transparent hover:bg-[#F9FAFB]"
      } ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}
    >
      <span
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border ${
          selected
            ? "border-[#CC2B2B] bg-[#CC2B2B]"
            : "border-[#D1D5DB] bg-white"
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-[#6B7280]">
            {option.supplierExternalId}
          </span>
          <span
            className={`text-sm text-[#111111] ${compact ? "truncate" : ""}`}
          >
            {supplierLabel(option)}
          </span>
          {option.isPriorityVendor ? (
            <Tag tone="priority">priority</Tag>
          ) : null}
          {isLowest ? <Tag tone="lowest">lowest</Tag> : null}
          {lockedTag ? <Tag tone="locked">locked vendor</Tag> : null}
        </span>
        <span className="mt-0.5 block text-xs text-[#6B7280]">
          Lead {formatLead(option)} · {formatPrice(option)}
        </span>
      </span>
    </button>
  );
}

export function CartSupplierField({
  item,
  options,
  purchaseRule,
  userRole,
  compact = false,
  onChangeSupplier,
}: CartSupplierFieldProps) {
  const resolved = useMemo(
    () =>
      resolveCartSupplierLineState({
        item,
        options,
        purchaseRule,
        userRole,
      }),
    [item, options, purchaseRule, userRole]
  );

  const {
    state,
    lockedVendorId,
    sortedOptions,
    cheapestAlt,
    isApprover,
  } = resolved;

  const lowestId = useMemo(() => {
    const priced = sortedOptions.filter(
      (opt) => opt.unitPrice !== null && Number.isFinite(opt.unitPrice)
    );
    if (priced.length === 0) return null;
    let best = priced[0]!;
    for (const opt of priced) {
      if ((opt.unitPrice ?? Infinity) < (best.unitPrice ?? Infinity)) {
        best = opt;
      }
    }
    return best.supplierExternalId;
  }, [sortedOptions]);

  const [expanded, setExpanded] = useState(false);
  const [pendingAlt, setPendingAlt] = useState<string | null>(null);
  const [showReasonForm, setShowReasonForm] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  useEffect(() => {
    setExpanded(false);
    setPendingAlt(null);
    setShowReasonForm(false);
    setReason("");
    setReasonError(false);
    setLocalError(null);
  }, [item.sku, item.supplierExternalId, item.lockOverriddenBy]);

  async function applySupplier(
    supplierExternalId: string,
    override?: { reason: string }
  ): Promise<boolean> {
    setBusy(true);
    setLocalError(null);
    try {
      await onChangeSupplier({
        supplierExternalId,
        ...(override ? { override } : {}),
      });
      if (override) {
        setConfirmMessage(
          `Lock overridden to ${supplierExternalId}. Logged with reason.`
        );
        setShowReasonForm(false);
        setReason("");
        setPendingAlt(null);
        setExpanded(false);
      } else {
        setConfirmMessage(null);
      }
      return true;
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const currentOption =
    sortedOptions.find(
      (opt) => opt.supplierExternalId === item.supplierExternalId
    ) ?? null;
  const missingPrice =
    item.unitPrice === null || !Number.isFinite(item.unitPrice);

  const lockedDisplayId = lockedVendorId ?? item.supplierExternalId ?? "—";
  const lockedName =
    sortedOptions.find((opt) => opt.supplierExternalId === lockedVendorId)
      ?.supplierName ??
    lockedVendorId ??
    null;

  const pendingOption =
    pendingAlt != null
      ? sortedOptions.find((opt) => opt.supplierExternalId === pendingAlt)
      : null;

  function renderSummary(label: string, iconOpen?: boolean) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-[#111111]">
        <LockIcon open={iconOpen} />
        <span className="font-medium">{label}</span>
      </span>
    );
  }

  if (state === "plain_lock") {
    return (
      <div className={compact ? "min-w-0" : "max-w-[18rem]"}>
        {renderSummary(`${lockedDisplayId} · locked`)}
        {lockedName && lockedName !== lockedDisplayId ? (
          <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{lockedName}</p>
        ) : null}
      </div>
    );
  }

  if (state === "overridden") {
    const tip = [
      item.lockOverrideReason
        ? `Reason: ${item.lockOverrideReason}`
        : null,
      item.lockOverriddenBy ? `By: ${item.lockOverriddenBy}` : null,
      item.lockOriginalVendor
        ? `Original lock: ${item.lockOriginalVendor}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <div className={compact ? "min-w-0" : "max-w-[20rem]"}>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-sm text-[#111111]"
          title={tip || undefined}
          onClick={() => {
            if (isApprover && sortedOptions.length > 1) {
              setExpanded((v) => !v);
            }
          }}
        >
          <LockIcon open />
          <span className="font-medium">
            {item.supplierExternalId ?? "—"} · overridden
          </span>
        </button>
        {confirmMessage ? (
          <p className="mt-1 text-xs text-[#047857]">{confirmMessage}</p>
        ) : null}
        {isApprover && expanded ? (
          <div className="mt-2 space-y-1 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
              Switch supplier
            </p>
            {sortedOptions.map((opt) => {
              const isLockedVendor = opt.supplierExternalId === lockedVendorId;
              return (
                <OptionRow
                  key={opt.supplierExternalId}
                  option={opt}
                  selected={item.supplierExternalId === opt.supplierExternalId}
                  disabled={busy}
                  isLowest={opt.supplierExternalId === lowestId}
                  lockedTag={isLockedVendor}
                  compact={compact}
                  onSelect={() => {
                    if (isLockedVendor) {
                      void applySupplier(opt.supplierExternalId);
                      return;
                    }
                    setPendingAlt(opt.supplierExternalId);
                    setShowReasonForm(true);
                  }}
                />
              );
            })}
            {showReasonForm && pendingOption && lockedVendorId ? (
              <OverrideReasonForm
                lockedVendor={lockedVendorId}
                target={pendingOption}
                reason={reason}
                reasonError={reasonError}
                busy={busy}
                onReasonChange={(value) => {
                  setReason(value);
                  setReasonError(false);
                }}
                onCancel={() => {
                  setShowReasonForm(false);
                  setPendingAlt(null);
                  setReason("");
                  setReasonError(false);
                }}
                onConfirm={() => {
                  const trimmed = reason.trim();
                  if (!trimmed) {
                    setReasonError(true);
                    return;
                  }
                  void applySupplier(pendingOption.supplierExternalId, {
                    reason: trimmed,
                  });
                }}
              />
            ) : null}
            {localError ? (
              <p role="alert" className="px-1 text-xs text-[#CC2B2B]">
                {localError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (state === "unlocked_picker") {
    const triggerLabel = item.supplierExternalId
      ? `${item.supplierExternalId}${
          currentOption ? ` · ${supplierLabel(currentOption)}` : ""
        }`
      : "Select supplier…";

    return (
      <div className={compact ? "min-w-0" : "max-w-[20rem]"}>
        {missingPrice ? (
          <p className="mb-1.5 text-xs text-[#B45309]">
            No price on file for current supplier — switch to a quoted supplier.
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          aria-expanded={expanded}
          aria-label={`Supplier for ${item.sku}`}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-left text-sm text-[#111111] hover:bg-[#F9FAFB] disabled:opacity-60"
        >
          <span className="truncate font-medium">{triggerLabel}</span>
          <i
            className={`ti ti-chevron-${expanded ? "up" : "down"} shrink-0 text-xs text-[#9CA3AF]`}
            aria-hidden="true"
          />
        </button>
        {expanded ? (
          <div className="mt-2 space-y-1 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
            {sortedOptions.map((opt) => (
              <OptionRow
                key={opt.supplierExternalId}
                option={opt}
                selected={item.supplierExternalId === opt.supplierExternalId}
                disabled={busy}
                isLowest={opt.supplierExternalId === lowestId}
                compact={compact}
                onSelect={() => {
                  if (opt.supplierExternalId === item.supplierExternalId) {
                    setExpanded(false);
                    return;
                  }
                  void applySupplier(opt.supplierExternalId).then((ok) => {
                    if (ok) setExpanded(false);
                  });
                }}
              />
            ))}
          </div>
        ) : null}
        {localError ? (
          <p role="alert" className="mt-1 text-xs text-[#CC2B2B]">
            {localError}
          </p>
        ) : null}
      </div>
    );
  }

  if (state === "locked_buyer_view" || state === "locked_approver_override") {
    const selectable = state === "locked_approver_override";
    return (
      <div className={compact ? "min-w-0" : "max-w-[22rem]"}>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-sm text-[#111111]"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {renderSummary(`${lockedDisplayId} · locked`)}
          <i
            className={`ti ti-chevron-${expanded ? "up" : "down"} text-xs text-[#9CA3AF]`}
            aria-hidden="true"
          />
        </button>

        {!expanded && cheapestAlt && state === "locked_buyer_view" ? (
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Lower quotes exist ({cheapestAlt.supplierExternalId}{" "}
            {formatCurrencyUSD(cheapestAlt.unitPrice)}) — ask an approver to
            override.
          </p>
        ) : null}

        {expanded ? (
          <div className="mt-2 space-y-1 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
              {selectable ? "Suppliers" : "Alternatives (view only)"}
            </p>
            {sortedOptions.map((opt) => {
              const isLockedVendor = opt.supplierExternalId === lockedVendorId;
              const isSelected =
                (pendingAlt ?? item.supplierExternalId) ===
                opt.supplierExternalId;
              return (
                <OptionRow
                  key={opt.supplierExternalId}
                  option={opt}
                  selected={isSelected}
                  disabled={busy || !selectable || isLockedVendor}
                  isLowest={opt.supplierExternalId === lowestId}
                  lockedTag={isLockedVendor}
                  compact={compact}
                  onSelect={() => {
                    if (!selectable || isLockedVendor) return;
                    setPendingAlt(opt.supplierExternalId);
                    setConfirmMessage(null);
                  }}
                />
              );
            })}

            {state === "locked_buyer_view" && cheapestAlt ? (
              <p className="px-1 pt-1 text-xs text-[#9CA3AF]">
                Lower quotes exist ({cheapestAlt.supplierExternalId}{" "}
                {formatCurrencyUSD(cheapestAlt.unitPrice)}) — ask an approver to
                override.
              </p>
            ) : null}

            {selectable ? (
              <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
                <button
                  type="button"
                  disabled={
                    busy ||
                    !pendingAlt ||
                    pendingAlt === lockedVendorId ||
                    pendingAlt === item.supplierExternalId
                  }
                  onClick={() => {
                    if (!pendingAlt) return;
                    setShowReasonForm(true);
                    setReasonError(false);
                  }}
                  className="rounded-lg bg-[#CC2B2B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Override lock
                </button>
              </div>
            ) : null}

            {showReasonForm && pendingOption && lockedVendorId ? (
              <OverrideReasonForm
                lockedVendor={lockedVendorId}
                target={pendingOption}
                reason={reason}
                reasonError={reasonError}
                busy={busy}
                onReasonChange={(value) => {
                  setReason(value);
                  setReasonError(false);
                }}
                onCancel={() => {
                  setShowReasonForm(false);
                  setReason("");
                  setReasonError(false);
                }}
                onConfirm={() => {
                  const trimmed = reason.trim();
                  if (!trimmed) {
                    setReasonError(true);
                    return;
                  }
                  void applySupplier(pendingOption.supplierExternalId, {
                    reason: trimmed,
                  });
                }}
              />
            ) : null}

            {confirmMessage ? (
              <p className="px-1 text-xs text-[#047857]">{confirmMessage}</p>
            ) : null}
            {localError ? (
              <p role="alert" className="px-1 text-xs text-[#CC2B2B]">
                {localError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  // static fallback
  return (
    <div className="text-sm text-[#111111]">
      {item.supplierExternalId ?? "Needs supplier"}
      {missingPrice ? (
        <p className="mt-1 text-xs text-[#B45309]">No price on file</p>
      ) : null}
    </div>
  );
}

function OverrideReasonForm({
  lockedVendor,
  target,
  reason,
  reasonError,
  busy,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  lockedVendor: string;
  target: PoReviewSkuSupplierOption;
  reason: string;
  reasonError: boolean;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3">
      <p className="text-xs leading-relaxed text-[#7F1D1D]">
        This item is locked to {lockedVendor}. Overriding may affect supplier
        agreements or warranty terms. Enter the reason for this override.
      </p>
      <p className="text-xs font-medium text-[#111111]">
        Switching to: {target.supplierExternalId} · {supplierLabel(target)} at{" "}
        {formatPrice(target)}
      </p>
      <label className="block">
        <span className="sr-only">Override reason</span>
        <textarea
          value={reason}
          rows={3}
          disabled={busy}
          placeholder="Reason for override (required)"
          onChange={(event) => onReasonChange(event.target.value)}
          className={`w-full rounded-lg border bg-white px-2.5 py-2 text-sm text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
            reasonError
              ? "border-[#CC2B2B] focus:ring-[#CC2B2B]/20"
              : "border-[#E5E7EB] focus:border-[#CC2B2B] focus:ring-[#CC2B2B]/10"
          }`}
        />
      </label>
      {reasonError ? (
        <p className="text-xs text-[#CC2B2B]">Override reason is required</p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-lg bg-[#CC2B2B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#B02626] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
