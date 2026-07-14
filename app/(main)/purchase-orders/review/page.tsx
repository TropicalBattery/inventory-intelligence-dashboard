import { redirect } from "next/navigation";
import { PoReview } from "@/components/po-cart/po-review";
import { getFullPoCartReviewData } from "@/lib/queries/po-cart-review";
import { createClient } from "@/lib/supabase/server";

export default async function PurchaseOrderReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  const data = await getFullPoCartReviewData(user.email);

  return <PoReview initial={data} />;
}
