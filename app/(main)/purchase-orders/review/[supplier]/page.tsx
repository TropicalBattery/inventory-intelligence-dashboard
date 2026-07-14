import { redirect } from "next/navigation";

/** Legacy per-supplier review URL — cart review is now a single page. */
export default function PurchaseOrderReviewSupplierRedirect() {
  redirect("/purchase-orders/review");
}
