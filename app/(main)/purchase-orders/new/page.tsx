import { redirect } from "next/navigation";

/** Legacy draft-batch page. Cart review is at /purchase-orders/review/[supplier]. */
export default function NewPurchaseOrderPage() {
  redirect("/purchase-orders");
}
