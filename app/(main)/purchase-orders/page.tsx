import { PoListTable } from "@/components/purchase-orders/po-list-table";
import { getUserRole } from "@/lib/auth/roles";
import {
  getApprovedMetricsThisMonth,
  getPurchaseOrderList,
} from "@/lib/queries/purchase-orders";
import { createClient } from "@/lib/supabase/server";

type PurchaseOrdersPageProps = {
  searchParams?: {
    status?: string;
    showSuppressed?: string;
    created?: string;
    submitted?: string;
    createdCount?: string;
    remainingGroups?: string;
    mode?: string;
  };
};

export default async function PurchaseOrdersPage({
  searchParams,
}: PurchaseOrdersPageProps) {
  const [orders, approvedMetrics] = await Promise.all([
    getPurchaseOrderList(),
    getApprovedMetricsThisMonth(),
  ]);
  const requestedStatus = searchParams?.status?.trim() || null;
  const explicitStatus =
    requestedStatus === "all" ||
    requestedStatus === "draft" ||
    requestedStatus === "pending_approval" ||
    requestedStatus === "approved" ||
    requestedStatus === "sent"
      ? requestedStatus
      : null;
  const showSuppressed = searchParams?.showSuppressed === "1";
  const createdPo = searchParams?.created?.trim() || null;
  const submittedPo = searchParams?.submitted?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email?.trim() ?? "";
  const userRole = userEmail ? await getUserRole(userEmail) : "buyer";
  const pendingApprovalCount = orders.filter(
    (order) => order.status.trim().toLowerCase() === "pending_approval"
  ).length;
  const defaultStatus =
    userRole === "approver" &&
    pendingApprovalCount > 0 &&
    explicitStatus === null
      ? "pending_approval"
      : "all";
  const activeStatus = explicitStatus ?? defaultStatus;
  const createdCount = Number(searchParams?.createdCount ?? "");
  const remainingGroups = Number(searchParams?.remainingGroups ?? "");
  const mode = searchParams?.mode?.trim() ?? "";

  return (
    <div className="space-y-6">
      {createdPo ? (
        <div
          role="status"
          className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          PO {createdPo} created as draft
        </div>
      ) : null}
      {submittedPo ? (
        <div
          role="status"
          className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          {submittedPo} sent for approval
        </div>
      ) : null}
      {Number.isFinite(createdCount) && createdCount > 0 ? (
        <div
          role="status"
          className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          {mode === "submit_for_approval"
            ? `${createdCount} purchase orders were sent for approval.`
            : `${createdCount} purchase orders were saved as drafts.`}{" "}
          {Number.isFinite(remainingGroups) && remainingGroups > 0
            ? `${remainingGroups} supplier groups remain in your cart because they are incomplete.`
            : ""}
        </div>
      ) : null}
      <PoListTable
        orders={orders}
        userRole={userRole}
        userEmail={userEmail}
        activeStatus={activeStatus}
        showSuppressed={showSuppressed}
        pendingApprovalCount={pendingApprovalCount}
        approvedMetrics={approvedMetrics}
      />
    </div>
  );
}
