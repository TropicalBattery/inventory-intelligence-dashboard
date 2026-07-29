"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CartSupplierField,
  type CartSupplierChangePayload,
} from "@/components/po-cart/cart-supplier-field";
import { usePoCart } from "@/components/po-cart/po-cart-provider";
import { Badge } from "@/components/ui/Badge";
import type { UserRole } from "@/lib/auth/role-guards";
import { formatCurrencyUSD, formatNumber } from "@/lib/format";
import { formatCasesHelper, parseUom } from "@/lib/format/uom";
import {
  isReorderStatus,
  type PoCartFullReviewData,
  type PoReviewGroup,
  type PoReviewSkuSupplierOption,
} from "@/lib/queries/po-cart-review";
import { computeLineTotal } from "@/lib/po/line-cost";
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import type { PoCartItem, PoCartResponse } from "@/lib/types";

type PoReviewProps = {
  initial: PoCartFullReviewData;
  userRole: UserRole;
};

type SaveMode = "draft" | "submit_for_approval";
type GroupReadiness = "ready_for_approval" | "needs_pricing" | "supplier_required";
type GroupActionLoading = false | SaveMode;
type GroupActionState = {
  loading: GroupActionLoading;
  error: string | null;
};
type SuccessNotice = {
  id: string;
  poNumber: string;
  purchaseOrderId?: string;
  mode: SaveMode;
};

function formatUsdOrUnavailable(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Estimated total unavailable";
  }
  return formatCurrencyUSD(value);
}

function resolvePalletQty(
  item: PoCartItem,
  options: PoReviewSkuSupplierOption[]
): number | null {
  const supplierId = item.supplierExternalId;
  if (supplierId) {
    const match = options.find((opt) => opt.supplierExternalId === supplierId);
    if (match?.palletQty !== null && match?.palletQty !== undefined) {
      return match.palletQty;
    }
  }
  const preferred = options.find((opt) => opt.isPriorityVendor);
  if (preferred?.palletQty !== null && preferred?.palletQty !== undefined) {
    return preferred.palletQty;
  }
  return options.find((opt) => opt.palletQty !== null)?.palletQty ?? null;
}

function groupSubtotal(items: PoCartItem[]): number | null {
  let known = 0;
  let hasPriced = false;
  for (const item of items) {
    if (item.unitPrice === null || !Number.isFinite(item.unitPrice)) {
      continue;
    }
    hasPriced = true;
    known += item.quantity * item.unitPrice;
  }
  return hasPriced ? known : null;
}

function readinessMeta(
  group: PoReviewGroup
): {
  readiness: GroupReadiness;
  hasInvalidQty: boolean;
  missingPriceCount: number;
  itemCount: number;
} {
  const hasSupplier = Boolean(group.supplierExternalId?.trim());
  const hasInvalidQty = group.items.some((item) => !(item.quantity > 0));
  const missingPriceCount = group.items.filter(
    (item) => item.unitPrice === null || !Number.isFinite(item.unitPrice)
  ).length;

  if (!hasSupplier) {
    return {
      readiness: "supplier_required",
      hasInvalidQty,
      missingPriceCount,
      itemCount: group.items.length,
    };
  }
  if (missingPriceCount > 0) {
    return {
      readiness: "needs_pricing",
      hasInvalidQty,
      missingPriceCount,
      itemCount: group.items.length,
    };
  }
  return {
    readiness: "ready_for_approval",
    hasInvalidQty,
    missingPriceCount,
    itemCount: group.items.length,
  };
}

function QtyInput({
  sku,
  quantity,
  unitOfMeasure,
  disabled = false,
  onCommit,
}: {
  sku: string;
  quantity: number;
  unitOfMeasure: string | null;
  disabled?: boolean;
  onCommit: (sku: string, quantity: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(quantity));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(String(quantity));
  }, [quantity]);

  useEffect(() => {
    if (disabled) {
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    if (parsed === quantity) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void onCommit(sku, parsed).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Update failed");
        setValue(String(quantity));
      });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [value, quantity, sku, onCommit, disabled]);

  const pack = parseUom(unitOfMeasure);
  const parsedQty = Number(value);
  const casesHelper =
    pack.unitsPerCase != null && Number.isFinite(parsedQty)
      ? formatCasesHelper(parsedQty, pack.unitsPerCase)
      : null;

  return (
    <div>
      <input
        type="number"
        min={0.01}
        step="any"
        value={value}
        disabled={disabled}
        aria-label={`Quantity for ${sku}`}
        onChange={(event) => {
          setError(null);
          setValue(event.target.value);
        }}
        className="h-9 w-20 rounded-lg border border-[#E5E7EB] px-2 text-sm text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {casesHelper ? (
        <p className="mt-1 text-xs text-[#9CA3AF]">{casesHelper}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[10px] text-[#CC2B2B]">{error}</p>
      ) : null}
    </div>
  );
}

function groupKey(group: PoReviewGroup): string {
  return group.supplierExternalId ?? "UNASSIGNED";
}

function UnitPriceInput({
  sku,
  disabled = false,
  onCommit,
}: {
  sku: string;
  disabled?: boolean;
  onCommit: (sku: string, unitPrice: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commitIfValid(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setError("Enter a price");
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid non-negative price");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onCommit(sku, parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        disabled={disabled || saving}
        aria-label={`Unit price for ${sku}`}
        placeholder="0.00"
        onChange={(event) => {
          setError(null);
          setValue(event.target.value);
        }}
        onBlur={() => {
          void commitIfValid(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="h-9 w-24 rounded-lg border border-[#E5E7EB] px-2 text-right text-sm text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {saving ? (
        <p className="mt-1 text-[10px] text-[#9CA3AF]">Saving…</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[10px] text-[#CC2B2B]">{error}</p>
      ) : null}
    </div>
  );
}

function mergeGroupsFromCartResponse(
  response: PoCartResponse,
  previous: PoReviewGroup[]
): PoReviewGroup[] {
  const metaById = new Map(
    previous
      .filter((g) => g.supplierExternalId)
      .map((g) => [g.supplierExternalId!, g])
  );

  const groups: PoReviewGroup[] = response.groups.map((group) => {
    const meta = group.supplierExternalId
      ? metaById.get(group.supplierExternalId)
      : null;
    return {
      supplierExternalId: group.supplierExternalId,
      supplierName: group.supplierName ?? meta?.supplierName ?? null,
      supplierEmail: meta?.supplierEmail ?? null,
      supplierAddress: meta?.supplierAddress ?? null,
      supplierCode: meta?.supplierCode ?? null,
      items: group.items,
      subtotalUsd: group.subtotalUsd,
    };
  });

  return groups.sort((left, right) => {
    if (left.supplierExternalId === null && right.supplierExternalId !== null) {
      return -1;
    }
    if (right.supplierExternalId === null && left.supplierExternalId !== null) {
      return 1;
    }
    const leftName = left.supplierName ?? left.supplierExternalId ?? "";
    const rightName = right.supplierName ?? right.supplierExternalId ?? "";
    return leftName.localeCompare(rightName);
  });
}

export function PoReview({ initial, userRole }: PoReviewProps) {
  const { refresh: refreshCart } = usePoCart();
  const [groups, setGroups] = useState<PoReviewGroup[]>(initial.groups);
  const [skuSupplierOptions, setSkuSupplierOptions] = useState(
    initial.skuSupplierOptions
  );
  const [purchaseRulesBySku] = useState(initial.purchaseRulesBySku);
  const [error, setError] = useState<string | null>(null);
  const [groupActions, setGroupActions] = useState<
    Record<string, GroupActionState>
  >({});
  const [successNotices, setSuccessNotices] = useState<SuccessNotice[]>([]);

  const allItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  const totals = useMemo(() => {
    let totalQty = 0;
    let knownValue = 0;
    let missingPrice = false;
    let hasPriced = false;
    let poCandidateCount = 0;
    const uniqueSuppliers = new Set<string>();

    for (const item of allItems) {
      totalQty += item.quantity;
      if (item.unitPrice === null || !Number.isFinite(item.unitPrice)) {
        missingPrice = true;
      } else {
        hasPriced = true;
        knownValue += item.quantity * item.unitPrice;
      }
      if (item.supplierExternalId?.trim()) {
        uniqueSuppliers.add(item.supplierExternalId);
      }
    }
    poCandidateCount = uniqueSuppliers.size;

    return {
      poCandidateCount,
      itemCount: allItems.length,
      totalQty,
      orderValue: hasPriced ? knownValue : null,
      missingPrice,
    };
  }, [allItems]);

  const missingPriceItems = useMemo(
    () =>
      allItems.filter(
        (item) => item.unitPrice === null || !Number.isFinite(item.unitPrice)
      ).length,
    [allItems]
  );

  const reloadFromCartApi = useCallback(async () => {
    const response = await fetch("/api/po-cart");
    if (!response.ok) {
      throw new Error("Failed to refresh cart");
    }
    const data = (await response.json()) as PoCartResponse;
    setGroups((current) => mergeGroupsFromCartResponse(data, current));
    if (data.skuSupplierOptions) {
      setSkuSupplierOptions(data.skuSupplierOptions);
    }
    await refreshCart().catch(() => undefined);
  }, [refreshCart]);

  async function patchItem(
    sku: string,
    body: Record<string, unknown>
  ): Promise<PoCartItem> {
    const response = await fetch("/api/po-cart/item", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, ...body }),
    });
    const data = (await response.json().catch(() => null)) as {
      item?: PoCartItem;
      error?: string;
    } | null;
    if (!response.ok || !data?.item) {
      throw new Error(data?.error ?? "Failed to update item");
    }
    return data.item;
  }

  useEffect(() => {
    // Snap non-overridden locked lines back to the locked vendor once on mount.
    const lockedNeedingAssign = allItems.filter((item) => {
      const rule = purchaseRulesBySku[item.sku];
      if (item.lockOverriddenBy) {
        return false;
      }
      return (
        rule?.ruleType === "vendor_lock" &&
        Boolean(rule.lockedVendorId) &&
        item.supplierExternalId !== rule.lockedVendorId
      );
    });

    if (lockedNeedingAssign.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        for (const item of lockedNeedingAssign) {
          const lockedVendorId =
            purchaseRulesBySku[item.sku]?.lockedVendorId;
          if (!lockedVendorId) {
            continue;
          }
          await patchItem(item.sku, { supplierExternalId: lockedVendorId });
        }
        if (!cancelled) {
          await reloadFromCartApi();
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to apply vendor locks"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Apply once on mount for vendor-locked cart rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuantityCommit = useCallback(
    async (sku: string, quantity: number) => {
      setError(null);
      await patchItem(sku, { quantity });
      await reloadFromCartApi();
    },
    [reloadFromCartApi]
  );

  const handleUnitPriceCommit = useCallback(
    async (sku: string, unitPrice: number) => {
      setError(null);
      await patchItem(sku, { unitPrice });
      await reloadFromCartApi();
    },
    [reloadFromCartApi]
  );

  async function handleSupplierChange(
    sku: string,
    payload: CartSupplierChangePayload
  ) {
    if (!payload.supplierExternalId) {
      return;
    }

    setError(null);
    await patchItem(sku, {
      supplierExternalId: payload.supplierExternalId,
      ...(payload.override ? { override: payload.override } : {}),
    });
    await reloadFromCartApi();
  }

  async function handleRemove(sku: string) {
    setError(null);
    const response = await fetch(
      `/api/po-cart?sku=${encodeURIComponent(sku)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Failed to remove item");
      return;
    }
    await reloadFromCartApi();
  }

  async function handleGroupSave(
    supplierExternalId: string,
    mode: SaveMode
  ) {
    setGroupActions((current) => ({
      ...current,
      [supplierExternalId]: { loading: mode, error: null },
    }));

    try {
      const response = await fetch("/api/po-cart/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveMode: mode,
          supplierExternalIds: [supplierExternalId],
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        results?: Array<{
          supplierExternalId: string;
          success: boolean;
          purchaseOrderId?: string;
          poNumber?: string;
          error?: string;
        }>;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create purchase order");
      }

      const result =
        data?.results?.find(
          (entry) => entry.supplierExternalId === supplierExternalId
        ) ?? data?.results?.[0];

      if (!result?.success || !result.poNumber) {
        throw new Error(result?.error ?? "Failed to create purchase order");
      }

      setSuccessNotices((current) => [
        ...current,
        {
          id: `${result.poNumber}-${Date.now()}`,
          poNumber: result.poNumber!,
          purchaseOrderId: result.purchaseOrderId,
          mode,
        },
      ]);
      setGroupActions((current) => {
        const next = { ...current };
        delete next[supplierExternalId];
        return next;
      });
      await reloadFromCartApi();
    } catch (err) {
      setGroupActions((current) => ({
        ...current,
        [supplierExternalId]: {
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to create purchase order",
        },
      }));
    }
  }

  function scrollToGroupFocus(
    supplierKey: string,
    focus: "supplier" | "pricing" | "quantity"
  ) {
    const selector =
      focus === "supplier"
        ? `[data-group-key="${supplierKey}"] [data-focus="supplier"]`
        : focus === "pricing"
          ? `[data-group-key="${supplierKey}"] [data-focus="pricing"]`
          : `[data-group-key="${supplierKey}"] [data-focus="quantity"]`;
    const target = document.querySelector(selector);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus?.();
    }
  }

  if (groups.length === 0) {
    const completed = successNotices.length > 0;
    return (
      <div className="space-y-6 pb-8">
        <div className="space-y-3">
          <Link
            href="/reorder"
            className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] transition-colors hover:text-[#111111]"
          >
            <i className="ti ti-arrow-left text-base" aria-hidden="true" />
            Back to reorder
          </Link>
          <h1 className="text-2xl font-semibold text-[#111111]">
            Review cart and create POs
          </h1>
          <p className="text-sm text-[#6B7280]">
            Cart lines are grouped by supplier. One purchase order will be created
            for each supplier group.
          </p>
        </div>

        {successNotices.map((notice) => (
          <SuccessNoticeBanner key={notice.id} notice={notice} />
        ))}

        <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-card">
          <p className="text-sm font-medium text-[#111111]">
            {completed
              ? "All purchase orders have been created."
              : "Cart is empty"}
          </p>
          {!completed ? (
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Add items from the Reorder page, or view purchase orders.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/purchase-orders"
              className="inline-flex rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white hover:bg-[#B02626]"
            >
              View purchase orders
            </Link>
            <Link
              href="/reorder"
              className="inline-flex rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#F9FAFB]"
            >
              Return to reorder
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-3">
        <Link
          href="/reorder"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] transition-colors hover:text-[#111111]"
        >
          <i className="ti ti-arrow-left text-base" aria-hidden="true" />
          Back to reorder
        </Link>
        <h1 className="text-2xl font-semibold text-[#111111]">
          Review cart and create POs
        </h1>
        <p className="text-sm text-[#6B7280]">
          Cart lines are grouped by supplier. One purchase order will be created
          for each supplier group.
        </p>
      </div>

      {successNotices.map((notice) => (
        <SuccessNoticeBanner key={notice.id} notice={notice} />
      ))}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            Purchase orders
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#111111]">
            {formatNumber(totals.poCandidateCount)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            Items
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#111111]">
            {formatNumber(totals.itemCount)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            Total quantity
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#111111]">
            {formatNumber(totals.totalQty)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            Estimated total
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#111111]">
            {formatUsdOrUnavailable(totals.orderValue)}
          </p>
          {totals.missingPrice ? (
            <p className="mt-2 text-xs text-[#B45309]">
              {formatNumber(missingPriceItems)} items need pricing
            </p>
          ) : null}
        </div>
      </div>

      {totals.missingPrice ? (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          Pricing issues found: {formatNumber(missingPriceItems)} item
          {missingPriceItems === 1 ? "" : "s"} are missing a valid price.
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[#CC2B2B]">
          {error}
        </p>
      ) : null}

      <div className="space-y-6">
        {groups.map((group) => {
          const key = groupKey(group);
          const isUnassigned = group.supplierExternalId === null;
          const supplierTitle =
            group.supplierName?.trim() ||
            group.supplierCode?.trim() ||
            group.supplierExternalId ||
            "Supplier";
          const subtotal = groupSubtotal(group.items);
          const meta = readinessMeta(group);
          const unpricedCount = meta.missingPriceCount;
          const action = groupActions[key] ?? { loading: false, error: null };
          const groupBusy = Boolean(action.loading);
          const readinessLabel =
            meta.readiness === "ready_for_approval"
              ? "Ready for approval"
              : meta.readiness === "needs_pricing"
                ? "Needs pricing"
                : "Supplier required";
          const readinessTone =
            meta.readiness === "ready_for_approval"
              ? "success"
              : meta.readiness === "needs_pricing"
                ? "warn"
                : "neutral";

          return (
            <div
              key={key}
              data-group-key={key}
              className="overflow-hidden rounded-2xl bg-white shadow-card"
            >
              <div
                className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3 ${
                  isUnassigned ? "bg-[#FFFBEB]" : "bg-[#F9FAFB]"
                }`}
              >
                <div className="min-w-0">
                  {isUnassigned ? (
                    <p className="text-base font-bold text-[#B45309]">
                      Unassigned items
                    </p>
                  ) : (
                    <>
                      <p className="text-base font-bold text-[#111111]">
                        {supplierTitle}
                      </p>
                      {group.supplierEmail || group.supplierAddress ? (
                        <p className="mt-0.5 text-xs text-[#6B7280]">
                          {[group.supplierEmail, group.supplierAddress]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="shrink-0 text-xs text-[#9CA3AF]">
                    {group.items.length} item
                    {group.items.length === 1 ? "" : "s"} ·{" "}
                    {formatUsdOrUnavailable(subtotal)}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      readinessTone === "success"
                        ? "bg-[#ECFDF5] text-[#047857]"
                        : readinessTone === "warn"
                          ? "bg-[#FFFBEB] text-[#B45309]"
                          : "bg-[#F3F4F6] text-[#6B7280]"
                    }`}
                  >
                    {readinessLabel}
                  </span>
                  {meta.hasInvalidQty ? (
                    <span className="inline-flex rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-medium text-[#991B1B]">
                      Invalid quantity
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-white text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      <th className="px-4 py-3">SKU / Product</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3 text-right">Unit price US$</th>
                      <th className="px-4 py-3 text-right">Line total</th>
                      <th className="px-4 py-3 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((row) => {
                      const options = skuSupplierOptions[row.sku] ?? [];
                      const purchaseRule = purchaseRulesBySku[row.sku];
                      const palletQty = resolvePalletQty(row, options);
                      const lineTotal = computeLineTotal(
                        row.quantity,
                        row.unitPrice
                      );
                      const status = row.sourceStatus;
                      const needsPrice =
                        row.unitPrice === null || !Number.isFinite(row.unitPrice);
                      const needsQty = !(row.quantity > 0);

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-[#F3F4F6] last:border-b-0"
                        >
                          <td className="px-4 py-3 align-top">
                            <p className="font-mono text-xs text-[#6B7280]">
                              {row.sku}
                            </p>
                            <p className="text-sm text-[#111111]">
                              {row.productName?.trim() || "-"}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {isReorderStatus(status) ? (
                              <Badge variant={getStatusBadgeVariant(status)}>
                                {getStatusLabel(status)}
                              </Badge>
                            ) : status ? (
                              <Badge variant="neutral">{status}</Badge>
                            ) : (
                              <span className="text-[#9CA3AF]">-</span>
                            )}
                          </td>
                          <td
                            className="px-4 py-3 align-top"
                            data-focus={
                              isUnassigned || !row.supplierExternalId
                                ? "supplier"
                                : undefined
                            }
                            tabIndex={-1}
                          >
                            <div
                              className={
                                groupBusy
                                  ? "pointer-events-none opacity-60"
                                  : undefined
                              }
                            >
                              <CartSupplierField
                                item={row}
                                options={options}
                                purchaseRule={purchaseRule}
                                userRole={userRole}
                                onChangeSupplier={(payload) =>
                                  handleSupplierChange(row.sku, payload)
                                }
                              />
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 align-top"
                            data-focus={needsQty ? "quantity" : undefined}
                            tabIndex={-1}
                          >
                            <QtyInput
                              sku={row.sku}
                              quantity={row.quantity}
                              unitOfMeasure={row.unitOfMeasure}
                              disabled={groupBusy}
                              onCommit={handleQuantityCommit}
                            />
                            {palletQty !== null && palletQty > 0 ? (
                              <p className="mt-1 text-xs text-[#9CA3AF]">
                                Pallet: {formatNumber(palletQty)} units
                              </p>
                            ) : null}
                          </td>
                          <td
                            className="px-4 py-3 align-top text-right tabular-nums text-[#111111]"
                            data-focus={needsPrice ? "pricing" : undefined}
                            tabIndex={-1}
                          >
                            {needsPrice ? (
                              <UnitPriceInput
                                sku={row.sku}
                                disabled={groupBusy}
                                onCommit={handleUnitPriceCommit}
                              />
                            ) : (
                              formatUsdOrUnavailable(row.unitPrice)
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-right tabular-nums font-medium text-[#111111]">
                            {needsPrice
                              ? "Waiting for price"
                              : formatUsdOrUnavailable(lineTotal)}
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <button
                              type="button"
                              disabled={groupBusy}
                              onClick={() => {
                                void handleRemove(row.sku);
                              }}
                              className="rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:text-[#CC2B2B] disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Remove ${row.sku}`}
                            >
                              <i
                                className="ti ti-trash text-base"
                                aria-hidden="true"
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <GroupActionFooter
                meta={meta}
                isUnassigned={isUnassigned}
                unpricedCount={unpricedCount}
                subtotal={subtotal}
                action={action}
                onSaveDraft={() => {
                  if (!group.supplierExternalId) return;
                  void handleGroupSave(group.supplierExternalId, "draft");
                }}
                onSendForApproval={() => {
                  if (!group.supplierExternalId) return;
                  void handleGroupSave(
                    group.supplierExternalId,
                    "submit_for_approval"
                  );
                }}
                onAssignSupplier={() => scrollToGroupFocus(key, "supplier")}
                onFixQuantity={() => scrollToGroupFocus(key, "quantity")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuccessNoticeBanner({ notice }: { notice: SuccessNotice }) {
  const href = notice.purchaseOrderId
    ? `/purchase-orders/${notice.purchaseOrderId}`
    : "/purchase-orders";
  const message =
    notice.mode === "submit_for_approval"
      ? `${notice.poNumber} was created and sent for approval.`
      : `${notice.poNumber} was saved as a draft.`;

  return (
    <div
      role="status"
      className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
    >
      <p>{message}</p>
      <Link
        href={href}
        className="mt-1 inline-flex text-sm font-medium text-[#047857] underline underline-offset-2 hover:text-[#065F46]"
      >
        View purchase order
      </Link>
    </div>
  );
}

function GroupActionFooter({
  meta,
  isUnassigned,
  unpricedCount,
  subtotal,
  action,
  onSaveDraft,
  onSendForApproval,
  onAssignSupplier,
  onFixQuantity,
}: {
  meta: ReturnType<typeof readinessMeta>;
  isUnassigned: boolean;
  unpricedCount: number;
  subtotal: number | null;
  action: GroupActionState;
  onSaveDraft: () => void;
  onSendForApproval: () => void;
  onAssignSupplier: () => void;
  onFixQuantity: () => void;
}) {
  const busy = Boolean(action.loading);

  let helperText: string;
  let actions: ReactNode;

  if (isUnassigned || meta.readiness === "supplier_required") {
    helperText =
      "Assign a supplier on each row. Items move into that supplier group automatically.";
    actions = (
      <button
        type="button"
        disabled={busy}
        onClick={onAssignSupplier}
        className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Assign supplier
      </button>
    );
  } else if (meta.hasInvalidQty) {
    helperText = "Fix invalid quantities before creating a purchase order.";
    actions = (
      <button
        type="button"
        disabled={busy}
        onClick={onFixQuantity}
        className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Fix quantity
      </button>
    );
  } else if (meta.readiness === "needs_pricing") {
    helperText = `${formatNumber(unpricedCount)} item${
      unpricedCount === 1 ? " is" : "s are"
    } missing prices. This group can be saved as a draft but cannot be sent for approval.`;
    actions = (
      <button
        type="button"
        disabled={busy}
        onClick={onSaveDraft}
        className="rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {action.loading === "draft" ? "Creating PO..." : "Save as draft"}
      </button>
    );
  } else {
    helperText = "This supplier group is ready to create.";
    actions = (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={onSaveDraft}
          className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.loading === "draft" ? "Creating PO..." : "Save as draft"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSendForApproval}
          className="rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.loading === "submit_for_approval"
            ? "Sending for approval..."
            : "Create and send for approval"}
        </button>
      </>
    );
  }

  return (
    <div className="space-y-3 border-t border-[#E5E7EB] px-4 py-4">
      {meta.readiness === "ready_for_approval" && !meta.hasInvalidQty ? (
        <p className="text-xs text-[#9CA3AF]">
          Supplier subtotal: {formatUsdOrUnavailable(subtotal)}
        </p>
      ) : null}
      <p className="text-sm text-[#374151]">{helperText}</p>
      {action.error ? (
        <p role="alert" className="text-sm text-[#CC2B2B]">
          {action.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </div>
  );
}
