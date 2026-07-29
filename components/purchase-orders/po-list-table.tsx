import Link from "next/link";
import { useMemo } from "react";
import { FileText } from "lucide-react";
import { PoListCard } from "@/components/purchase-orders/po-list-card";
import { PoSummaryCards } from "@/components/purchase-orders/po-summary-cards";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { UserRole } from "@/lib/auth/role-guards";
import type { ApprovedMetrics } from "@/lib/queries/purchase-orders";
import type { PurchaseOrderListItem } from "@/lib/types";

type PoListTableProps = {
  orders: PurchaseOrderListItem[];
  userRole: UserRole;
  userEmail: string;
  activeStatus: "all" | "draft" | "pending_approval" | "approved" | "sent";
  showSuppressed: boolean;
  pendingApprovalCount: number;
  approvedMetrics: ApprovedMetrics;
};

export function PoListTable({
  orders,
  userRole,
  userEmail,
  activeStatus,
  showSuppressed,
  pendingApprovalCount,
  approvedMetrics,
}: PoListTableProps) {
  const filteredOrders = useMemo(() => {
    const normalized = orders.filter((order) =>
      showSuppressed ? true : order.status.trim().toLowerCase() !== "suppressed"
    );
    if (activeStatus === "all") {
      return normalized;
    }
    return normalized.filter(
      (order) => order.status.trim().toLowerCase() === activeStatus
    );
  }, [activeStatus, orders, showSuppressed]);

  const tabs: Array<{
    status: "all" | "draft" | "pending_approval" | "approved" | "sent";
    label: string;
  }> = [
    { status: "all", label: "All" },
    { status: "draft", label: "Drafts" },
    {
      status: "pending_approval",
      label: `Awaiting approval (${pendingApprovalCount})`,
    },
    { status: "approved", label: "Approved" },
    { status: "sent", label: "Sent" },
  ];

  const suppressedCount = orders.filter(
    (order) => order.status.trim().toLowerCase() === "suppressed"
  ).length;

  return (
    <div>
      <PoSummaryCards orders={orders} approvedMetrics={approvedMetrics} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.status}
            href={`/purchase-orders?status=${tab.status}${
              showSuppressed ? "&showSuppressed=1" : ""
            }`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeStatus === tab.status
                ? "bg-[#CC2B2B] text-white"
                : "bg-white text-[#374151] hover:bg-[#F9FAFB]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
        {suppressedCount > 0 ? (
          <Link
            href={`/purchase-orders?status=${activeStatus}&showSuppressed=${
              showSuppressed ? "0" : "1"
            }`}
            className="ml-1 text-sm text-[#6B7280] underline underline-offset-2 hover:text-[#111111]"
          >
            {showSuppressed
              ? "Hide archive"
              : `Show archive (${suppressedCount})`}
          </Link>
        ) : null}
      </div>

      {filteredOrders.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={FileText}
            title="No purchase orders in this view"
            description="Create POs from the review screen or switch tabs."
            action={
              <Link
                href="/purchase-orders/review"
                className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Review and create POs
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <PoListCard
              key={order.id}
              order={order}
              userRole={userRole}
              userEmail={userEmail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
