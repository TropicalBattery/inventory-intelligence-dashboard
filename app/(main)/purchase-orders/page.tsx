import { PoListTable } from "@/components/purchase-orders/po-list-table";
import { getPurchaseOrderList } from "@/lib/queries/purchase-orders";

export default async function PurchaseOrdersPage() {
  const orders = await getPurchaseOrderList();

  return (
    <div className="space-y-6">
      <PoListTable orders={orders} />
    </div>
  );
}