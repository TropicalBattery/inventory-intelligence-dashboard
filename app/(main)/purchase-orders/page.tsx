import { PoListTable } from "@/components/purchase-orders/po-list-table";
import { getUserRole } from "@/lib/auth/roles";
import { getPurchaseOrderList } from "@/lib/queries/purchase-orders";
import { createClient } from "@/lib/supabase/server";

type PurchaseOrdersPageProps = {
  searchParams?: {
    created?: string;
    submitted?: string;
  };
};

export default async function PurchaseOrdersPage({
  searchParams,
}: PurchaseOrdersPageProps) {
  const orders = await getPurchaseOrderList();
  const createdPo = searchParams?.created?.trim() || null;
  const submittedPo = searchParams?.submitted?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email?.trim() ?? "";
  const userRole = userEmail ? await getUserRole(userEmail) : "buyer";

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
          {submittedPo} submitted for approval
        </div>
      ) : null}
      <PoListTable
        orders={orders}
        userRole={userRole}
        userEmail={userEmail}
      />
    </div>
  );
}
