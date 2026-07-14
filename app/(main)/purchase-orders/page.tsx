import { PoListTable } from "@/components/purchase-orders/po-list-table";
import { getPurchaseOrderList } from "@/lib/queries/purchase-orders";

type PurchaseOrdersPageProps = {
  searchParams?: {
    created?: string;
  };
};

export default async function PurchaseOrdersPage({
  searchParams,
}: PurchaseOrdersPageProps) {
  const orders = await getPurchaseOrderList();
  const createdPo = searchParams?.created?.trim() || null;

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
      <PoListTable orders={orders} />
    </div>
  );
}
