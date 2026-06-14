import Link from "next/link";
import { PoReviewClient } from "@/components/purchase-orders/po-review-client";
import { Card } from "@/components/ui/Card";
import { getDraftPoReviewGroups } from "@/lib/queries/purchase-orders";
type NewPurchaseOrderPageProps = {
  searchParams?: {
    batch?: string;
  };
};

export default async function NewPurchaseOrderPage({
  searchParams,
}: NewPurchaseOrderPageProps) {
  const batchId = searchParams?.batch;

  if (!batchId) {
    return (
      <div className="space-y-6">
        <Card>
          <p className="text-sm text-slate-600">
            Select items on the Reorder Recommendations page to start a draft
            purchase order.
          </p>
          <Link
            href="/reorder"
            className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Go to Reorder Recommendations
          </Link>
        </Card>
      </div>
    );
  }

  const supplierGroups = await getDraftPoReviewGroups(batchId);

  return <PoReviewClient batchId={batchId} supplierGroups={supplierGroups} />;
}
