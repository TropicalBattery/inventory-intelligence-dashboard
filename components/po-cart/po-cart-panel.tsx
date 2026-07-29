"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartSupplierField } from "@/components/po-cart/cart-supplier-field";
import { usePoCart } from "@/components/po-cart/po-cart-provider";
import { Modal } from "@/components/ui/Modal";
import { formatCurrencyUSD } from "@/lib/format";
import { formatCasesHelper, parseUom } from "@/lib/format/uom";
import type { PoCartGroup, PoCartItem } from "@/lib/types";

function formatGroupSubtotal(group: PoCartGroup): string {
  const hasMissingPrice = group.items.some(
    (item) => item.unitPrice === null || !Number.isFinite(item.unitPrice)
  );
  if (hasMissingPrice || group.subtotalUsd === null) {
    return "-";
  }
  return formatCurrencyUSD(group.subtotalUsd);
}

function CartQtyInput({ item }: { item: PoCartItem }) {
  const { updateItem } = usePoCart();
  const [value, setValue] = useState(String(item.quantity));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(String(item.quantity));
  }, [item.quantity, item.id]);

  useEffect(() => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    if (parsed === item.quantity) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateItem(item.sku, { quantity: parsed }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Update failed");
        setValue(String(item.quantity));
      });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [value, item.quantity, item.sku, updateItem]);

  return (
    <div className="shrink-0">
      <input
        type="number"
        min={0.01}
        step="any"
        value={value}
        aria-label={`Quantity for ${item.sku}`}
        onChange={(event) => {
          setError(null);
          setValue(event.target.value);
        }}
        className="h-8 w-16 rounded-lg border border-[#E5E7EB] px-2 text-sm text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
      />
      {(() => {
        const pack = parseUom(item.unitOfMeasure);
        const parsed = Number(value);
        if (pack.unitsPerCase == null || !Number.isFinite(parsed)) {
          return null;
        }
        const helper = formatCasesHelper(parsed, pack.unitsPerCase);
        return helper ? (
          <p className="mt-1 max-w-[5.5rem] text-[10px] text-[#9CA3AF]">
            {helper}
          </p>
        ) : null;
      })()}
      {error ? (
        <p className="mt-1 max-w-[4rem] text-[10px] text-[#CC2B2B]">{error}</p>
      ) : null}
    </div>
  );
}

function CartLineRow({ item }: { item: PoCartItem }) {
  const {
    removeItem,
    updateItem,
    userRole,
    skuSupplierOptions,
    purchaseRulesBySku,
  } = usePoCart();
  const options = skuSupplierOptions[item.sku] ?? [];
  const purchaseRule = purchaseRulesBySku[item.sku];
  const lineTotal =
    item.unitPrice !== null && Number.isFinite(item.unitPrice)
      ? item.unitPrice * item.quantity
      : null;

  return (
    <li className="border-t border-[#E5E7EB] px-4 py-2.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-[#6B7280]">{item.sku}</p>
          <p className="truncate text-sm text-[#111111]">
            {item.productName?.trim() || "—"}
          </p>
          <div className="mt-1.5">
            <CartSupplierField
              compact
              item={item}
              options={options}
              purchaseRule={purchaseRule}
              userRole={userRole}
              onChangeSupplier={async (payload) => {
                await updateItem(item.sku, {
                  supplierExternalId: payload.supplierExternalId,
                  ...(payload.override
                    ? { override: payload.override }
                    : {}),
                });
              }}
            />
          </div>
          {lineTotal !== null ? (
            <p className="mt-1 text-[11px] tabular-nums text-[#9CA3AF]">
              Line {formatCurrencyUSD(lineTotal)}
            </p>
          ) : null}
        </div>
        <CartQtyInput item={item} />
        <button
          type="button"
          onClick={() => {
            void removeItem(item.sku).catch((err: unknown) => {
              console.error(err);
            });
          }}
          className="shrink-0 rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:text-[#CC2B2B]"
          aria-label={`Remove ${item.sku}`}
        >
          <i className="ti ti-trash text-base" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function CartGroupCard({ group }: { group: PoCartGroup }) {
  const isUnassigned = group.supplierExternalId === null;
  const supplierLabel =
    group.supplierName?.trim() ||
    group.supplierExternalId ||
    "Unassigned";
  const supplierTitle =
    group.supplierName?.trim() && group.supplierExternalId
      ? group.supplierExternalId
      : undefined;

  return (
    <div className="mx-4 mb-3 mt-4 overflow-hidden rounded-xl border border-[#E5E7EB]">
      <div className="flex items-center justify-between rounded-t-xl bg-[#F9FAFB] px-4 py-3">
        <div className="min-w-0">
          {isUnassigned ? (
            <span className="inline-flex rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309]">
              Needs supplier
            </span>
          ) : (
            <p
              className="truncate text-sm font-medium text-[#111111]"
              title={supplierTitle}
            >
              {supplierLabel}
            </p>
          )}
        </div>
        <p className="shrink-0 pl-3 text-xs text-[#9CA3AF]">
          {group.items.length} item{group.items.length === 1 ? "" : "s"} ·{" "}
          {formatGroupSubtotal(group)}
        </p>
      </div>

      <ul>
        {group.items.map((item) => (
          <CartLineRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function PoCartPanel() {
  const { groups, totalItems, isOpen, close, clearCart } = usePoCart();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  async function handleConfirmClear() {
    if (isClearing) {
      return;
    }

    setIsClearing(true);
    try {
      await clearCart();
      setShowClearConfirm(false);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <>
      {/* Layering: header sticky z-40 → overlays z-40 → panels z-50
          (panels above header so close controls stay clickable) */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-[#E5E7EB] bg-white transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <header className="flex h-16 items-center justify-between border-b border-[#E5E7EB] px-5">
          <div className="flex items-center gap-2">
            <i
              className="ti ti-shopping-cart text-lg text-[#111111]"
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-[#111111]">PO Cart</span>
            <span className="text-xs text-[#9CA3AF]">{totalItems} items</span>
          </div>
          <div className="flex items-center gap-1">
            {totalItems > 0 ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111111]"
              >
                Clear all
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-2 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111111]"
              aria-label="Close purchase order cart"
            >
              <i className="ti ti-x text-lg" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-4">
          {groups.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <i
                className="ti ti-shopping-cart-off text-[32px] text-[#9CA3AF]"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-[#111111]">
                Cart is empty
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Add items from the Reorder page.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <CartGroupCard
                key={group.supplierExternalId ?? "UNASSIGNED"}
                group={group}
              />
            ))
          )}
        </div>

        {totalItems > 0 ? (
          <div className="border-t border-[#E5E7EB] bg-white p-4">
            <Link
              href="/purchase-orders/review"
              onClick={close}
              className="flex w-full items-center justify-center rounded-xl bg-[#CC2B2B] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B02626]"
            >
              Review and create POs ({totalItems} item{totalItems === 1 ? "" : "s"})
            </Link>
          </div>
        ) : null}
      </aside>

      <Modal
        open={showClearConfirm}
        onClose={() => {
          if (!isClearing) {
            setShowClearConfirm(false);
          }
        }}
        ariaLabelledBy="po-cart-clear-title"
        className="max-w-md"
      >
        <h3
          id="po-cart-clear-title"
          className="text-lg font-semibold text-[#111111]"
        >
          Clear purchase order cart?
        </h3>
        <p className="mt-2 text-sm text-[#6B7280]">
          Clear all items from your purchase order cart?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowClearConfirm(false)}
            disabled={isClearing}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleConfirmClear();
            }}
            disabled={isClearing}
            className="rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white hover:bg-[#B02626] disabled:opacity-60"
          >
            {isClearing ? "Clearing..." : "Clear all"}
          </button>
        </div>
      </Modal>
    </>
  );
}
