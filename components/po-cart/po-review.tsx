"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type SuccessBanner = {
  poNumber: string;
  poId?: string;
};

function formatUsdOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
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
  let missing = false;
  for (const item of items) {
    if (item.unitPrice === null || !Number.isFinite(item.unitPrice)) {
      missing = true;
    } else {
      known += item.quantity * item.unitPrice;
    }
  }
  return missing ? null : known;
}

function QtyInput({
  sku,
  quantity,
  unitOfMeasure,
  onCommit,
}: {
  sku: string;
  quantity: number;
  unitOfMeasure: string | null;
  onCommit: (sku: string, quantity: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(quantity));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(String(quantity));
  }, [quantity]);

  useEffect(() => {
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
  }, [value, quantity, sku, onCommit]);

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
        aria-label={`Quantity for ${sku}`}
        onChange={(event) => {
          setError(null);
          setValue(event.target.value);
        }}
        className="h-9 w-20 rounded-lg border border-[#E5E7EB] px-2 text-sm text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
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
  const [submittingSupplierId, setSubmittingSupplierId] = useState<
    string | null
  >(null);
  const [successBanner, setSuccessBanner] = useState<SuccessBanner | null>(
    null
  );

  const allItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  const totals = useMemo(() => {
    let totalQty = 0;
    let knownValue = 0;
    let missingPrice = false;

    for (const item of allItems) {
      totalQty += item.quantity;
      if (item.unitPrice === null || !Number.isFinite(item.unitPrice)) {
        missingPrice = true;
      } else {
        knownValue += item.quantity * item.unitPrice;
      }
    }

    return {
      itemCount: allItems.length,
      totalQty,
      orderValue: missingPrice ? null : knownValue,
      missingPrice,
    };
  }, [allItems]);

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

  async function handleSubmitGroup(supplierExternalId: string) {
    setError(null);
    setSubmittingSupplierId(supplierExternalId);
    try {
      const response = await fetch("/api/po-cart/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierExternalId }),
      });
      const data = (await response.json().catch(() => null)) as {
        poNumber?: string;
        poId?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.poNumber) {
        throw new Error(data?.error ?? "Failed to submit purchase order");
      }

      setSuccessBanner({
        poNumber: data.poNumber,
        poId: data.poId,
      });
      await reloadFromCartApi();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit purchase order"
      );
    } finally {
      setSubmittingSupplierId(null);
    }
  }

  if (groups.length === 0) {
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
            Review purchase order
          </h1>
        </div>

        {successBanner ? (
          <div
            role="status"
            className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
          >
            PO {successBanner.poNumber} created —{" "}
            <Link
              href={
                successBanner.poId
                  ? `/purchase-orders/${successBanner.poId}`
                  : "/purchase-orders"
              }
              className="font-medium underline underline-offset-2"
            >
              view
            </Link>
          </div>
        ) : null}

        <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-card">
          <p className="text-sm font-medium text-[#111111]">Cart is empty</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Add items from the Reorder page, or view purchase orders.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reorder"
              className="inline-flex rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#F9FAFB]"
            >
              Back to reorder
            </Link>
            <Link
              href="/purchase-orders"
              className="inline-flex rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white hover:bg-[#B02626]"
            >
              View purchase orders
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
          Review purchase order
        </h1>
      </div>

      {successBanner ? (
        <div
          role="status"
          className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          PO {successBanner.poNumber} created —{" "}
          <Link
            href={
              successBanner.poId
                ? `/purchase-orders/${successBanner.poId}`
                : "/purchase-orders"
            }
            className="font-medium underline underline-offset-2"
          >
            view
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
            Order value
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#111111]">
            {formatUsdOrDash(totals.orderValue)}
          </p>
          {totals.missingPrice ? (
            <p className="mt-2 text-xs text-[#9CA3AF]">some prices missing</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[#CC2B2B]">
          {error}
        </p>
      ) : null}

      <div className="space-y-6">
        {groups.map((group) => {
          const isUnassigned = group.supplierExternalId === null;
          const supplierTitle =
            group.supplierName?.trim() ||
            group.supplierCode?.trim() ||
            group.supplierExternalId ||
            "Supplier";
          const subtotal = groupSubtotal(group.items);
          const unpricedCount = group.items.filter(
            (item) =>
              item.unitPrice === null || !Number.isFinite(item.unitPrice)
          ).length;
          const hasInvalidQty = group.items.some((item) => !(item.quantity > 0));
          const canSubmit =
            !isUnassigned &&
            Boolean(group.supplierExternalId) &&
            group.items.length > 0 &&
            !hasInvalidQty;
          const submitReason = isUnassigned
            ? null
            : hasInvalidQty
              ? "Fix quantities"
              : null;

          return (
            <div
              key={group.supplierExternalId ?? "UNASSIGNED"}
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
                <p className="shrink-0 text-xs text-[#9CA3AF]">
                  {group.items.length} item
                  {group.items.length === 1 ? "" : "s"} ·{" "}
                  {formatUsdOrDash(subtotal)}
                </p>
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
                              {row.productName?.trim() || "—"}
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
                              <span className="text-[#9CA3AF]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <CartSupplierField
                              item={row}
                              options={options}
                              purchaseRule={purchaseRule}
                              userRole={userRole}
                              onChangeSupplier={(payload) =>
                                handleSupplierChange(row.sku, payload)
                              }
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <QtyInput
                              sku={row.sku}
                              quantity={row.quantity}
                              unitOfMeasure={row.unitOfMeasure}
                              onCommit={handleQuantityCommit}
                            />
                            {palletQty !== null && palletQty > 0 ? (
                              <p className="mt-1 text-xs text-[#9CA3AF]">
                                Pallet: {formatNumber(palletQty)} units
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top text-right tabular-nums text-[#111111]">
                            {formatUsdOrDash(row.unitPrice)}
                          </td>
                          <td className="px-4 py-3 align-top text-right tabular-nums font-medium text-[#111111]">
                            {formatUsdOrDash(lineTotal)}
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <button
                              type="button"
                              onClick={() => {
                                void handleRemove(row.sku);
                              }}
                              className="rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:text-[#CC2B2B]"
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

              {!isUnassigned ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-[#111111]">
                      {formatUsdOrDash(subtotal)}
                    </p>
                    {unpricedCount > 0 ? (
                      <p className="mt-1 text-xs text-[#B45309]">
                        This PO has {formatNumber(unpricedCount)} item
                        {unpricedCount === 1 ? "" : "s"} with no price on file
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {submitReason ? (
                      <span className="text-xs text-[#9CA3AF]">
                        {submitReason}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={
                        !canSubmit ||
                        submittingSupplierId === group.supplierExternalId
                      }
                      onClick={() => {
                        if (group.supplierExternalId) {
                          void handleSubmitGroup(group.supplierExternalId);
                        }
                      }}
                      className="rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingSupplierId === group.supplierExternalId
                        ? "Submitting…"
                        : "Submit this PO"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-[#E5E7EB] px-4 py-3">
                  <p className="text-xs text-[#9CA3AF]">
                    Assign a supplier on each row. Items move into that
                    supplier&apos;s group automatically.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
