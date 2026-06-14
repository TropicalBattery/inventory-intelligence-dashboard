"use client";

import type { ReorderPageTab } from "@/lib/reorder-tab-classification";
import { formatNumber } from "@/lib/format";

type ReorderTabBarProps = {
  activeTab: ReorderPageTab;
  reorderAttentionCount: number;
  nonStockCount: number;
  unclassifiedCount: number;
  onTabChange: (tab: ReorderPageTab) => void;
};

const tabButtonClassName = (isActive: boolean) =>
  [
    "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
    isActive
      ? "border-tbc-red text-tbc-red"
      : "border-transparent text-[#6B7280] hover:text-[#111111]",
  ].join(" ");

export function ReorderTabBar({
  activeTab,
  reorderAttentionCount,
  nonStockCount,
  unclassifiedCount,
  onTabChange,
}: ReorderTabBarProps) {
  return (
    <div className="border-b border-[#E5E7EB] bg-white px-2 pt-2">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={tabButtonClassName(activeTab === "reorder")}
          onClick={() => onTabChange("reorder")}
        >
          Reorder Action
          {reorderAttentionCount > 0 ? (
            <span className="ml-2 text-xs font-normal text-[#6B7280]">
              ({formatNumber(reorderAttentionCount)} need attention)
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={tabButtonClassName(activeTab === "nonstock")}
          onClick={() => onTabChange("nonstock")}
        >
          Non-Stock Items ({formatNumber(nonStockCount)})
        </button>
        <button
          type="button"
          className={tabButtonClassName(activeTab === "unclassified")}
          onClick={() => onTabChange("unclassified")}
        >
          Unclassified ({formatNumber(unclassifiedCount)})
        </button>
      </div>
    </div>
  );
}
