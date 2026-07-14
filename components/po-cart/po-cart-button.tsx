"use client";

import { usePoCart } from "@/components/po-cart/po-cart-provider";

/** Compact cart trigger for the sticky page header (beside the bell). */
export function PoCartButton() {
  const { totalItems, isOpen, toggle } = usePoCart();
  const badgeLabel = totalItems > 99 ? "99+" : String(totalItems);

  return (
    <button
      type="button"
      onClick={toggle}
      title="Purchase order cart"
      aria-label={
        isOpen ? "Close purchase order cart" : "Open purchase order cart"
      }
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] transition-colors duration-150 hover:bg-[#F3F4F6] hover:text-[#111111]"
    >
      <i className="ti ti-shopping-cart text-xl" aria-hidden="true" />
      {totalItems > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#CC2B2B] px-1 text-[10px] text-white">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}
