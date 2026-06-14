import Link from "next/link";
import { notFound } from "next/navigation";
import { PoDetailActions } from "@/components/purchase-orders/po-detail-actions";
import { getPurchaseOrderDocumentWithReferenceDetails } from "@/lib/queries/purchase-orders";

type PurchaseOrderDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function PurchaseOrderDetailPage({
  params,
}: PurchaseOrderDetailPageProps) {
  const purchaseOrder = await getPurchaseOrderDocumentWithReferenceDetails(
    params.id
  );

  if (!purchaseOrder) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link
        href="/purchase-orders"
        className="inline-flex text-sm font-medium text-accent hover:text-accent-hover"
      >
        Back to Purchase Orders
      </Link>
      <PoDetailActions purchaseOrder={purchaseOrder} />
    </div>
  );
}
