"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PoCartPanel } from "@/components/po-cart/po-cart-panel";
import { panelBus } from "@/lib/ui/panel-bus";
import type { PoCartGroup, PoCartResponse } from "@/lib/types";

export type PoCartAddItemInput = {
  sku: string;
  quantity: number;
  supplierExternalId?: string | null;
  unitPrice?: number | null;
  productName?: string | null;
  sourceStatus?: string | null;
};

export type PoCartUpdatePatch = {
  quantity?: number;
  supplierExternalId?: string | null;
};

type PoCartContextValue = {
  groups: PoCartGroup[];
  totalItems: number;
  isOpen: boolean;
  cartSkus: ReadonlySet<string>;
  refresh: () => Promise<void>;
  addItem: (item: PoCartAddItemInput) => Promise<void>;
  addItems: (items: PoCartAddItemInput[]) => Promise<void>;
  updateItem: (sku: string, patch: PoCartUpdatePatch) => Promise<void>;
  removeItem: (sku: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggle: () => void;
  open: () => void;
  close: () => void;
};

const PoCartContext = createContext<PoCartContextValue | null>(null);

export function usePoCart(): PoCartContextValue {
  const value = useContext(PoCartContext);
  if (!value) {
    throw new Error("usePoCart must be used within PoCartProvider");
  }
  return value;
}

export function PoCartProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<PoCartGroup[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/po-cart");
    if (!response.ok) {
      throw new Error("Failed to load cart");
    }

    const data = (await response.json()) as PoCartResponse;
    setGroups(data.groups ?? []);
    setTotalItems(data.totalItems ?? 0);
  }, []);

  useEffect(() => {
    void refresh().catch((error) => {
      console.error("Failed to load PO cart on mount:", error);
    });
  }, [refresh]);

  useEffect(() => {
    return panelBus.subscribe((panel) => {
      if (panel !== "cart") {
        setIsOpen(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const cartSkus = useMemo(() => {
    const skus = new Set<string>();
    for (const group of groups) {
      for (const item of group.items) {
        skus.add(item.sku);
      }
    }
    return skus;
  }, [groups]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    panelBus.open("cart");
    setIsOpen(true);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => {
      const next = !current;
      if (next) {
        panelBus.open("cart");
      }
      return next;
    });
  }, []);

  const addItems = useCallback(
    async (items: PoCartAddItemInput[]) => {
      if (items.length === 0) {
        return;
      }

      setTotalItems((current) => {
        const newSkus = items.filter((item) => !cartSkus.has(item.sku));
        const uniqueNew = new Set(newSkus.map((item) => item.sku));
        return current + uniqueNew.size;
      });

      await Promise.all(
        items.map(async (item) => {
          const response = await fetch("/api/po-cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sku: item.sku,
              quantity: item.quantity,
              supplierExternalId: item.supplierExternalId ?? null,
              unitPrice: item.unitPrice ?? null,
              productName: item.productName ?? null,
              sourceStatus: item.sourceStatus ?? null,
            }),
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(data?.error ?? `Failed to add ${item.sku}`);
          }
        })
      );

      await refresh();
    },
    [cartSkus, refresh]
  );

  const addItem = useCallback(
    async (item: PoCartAddItemInput) => {
      await addItems([item]);
    },
    [addItems]
  );

  const updateItem = useCallback(
    async (sku: string, patch: PoCartUpdatePatch) => {
      const response = await fetch("/api/po-cart/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "supplierExternalId")
            ? { supplierExternalId: patch.supplierExternalId ?? null }
            : {}),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to update cart item");
      }

      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (sku: string) => {
      const response = await fetch(
        `/api/po-cart?sku=${encodeURIComponent(sku)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to remove cart item");
      }

      await refresh();
    },
    [refresh]
  );

  const clearCart = useCallback(async () => {
    const response = await fetch("/api/po-cart?all=true", { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "Failed to clear cart");
    }

    await refresh();
  }, [refresh]);

  const value = useMemo<PoCartContextValue>(
    () => ({
      groups,
      totalItems,
      isOpen,
      cartSkus,
      refresh,
      addItem,
      addItems,
      updateItem,
      removeItem,
      clearCart,
      toggle,
      open,
      close,
    }),
    [
      groups,
      totalItems,
      isOpen,
      cartSkus,
      refresh,
      addItem,
      addItems,
      updateItem,
      removeItem,
      clearCart,
      toggle,
      open,
      close,
    ]
  );

  return (
    <PoCartContext.Provider value={value}>
      {children}
      {isOpen ? (
        // Layering: header sticky z-40 → overlays z-40 → panels z-50
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={close}
          aria-hidden="true"
        />
      ) : null}
      <PoCartPanel />
    </PoCartContext.Provider>
  );
}
