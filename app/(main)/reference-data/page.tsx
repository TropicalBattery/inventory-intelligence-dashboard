import { ReferenceDataManager } from "@/components/reference-data/reference-data-manager";
import {
  getProductOptions,
  getReferenceDataPage,
  getSupplierOptions,
} from "@/lib/queries/reference-data";

type ReferenceDataPageProps = {
  searchParams?: {
    q?: string;
    page?: string;
  };
};

export default async function ReferenceDataPage({
  searchParams,
}: ReferenceDataPageProps) {
  const search = searchParams?.q?.trim() ?? "";
  const page = Number(searchParams?.page ?? "1");

  const [pageData, products, suppliers] = await Promise.all([
    getReferenceDataPage(search, page),
    getProductOptions(),
    getSupplierOptions(),
  ]);

  return (
    <ReferenceDataManager
      rows={pageData.rows}
      products={products}
      suppliers={suppliers}
      totalCount={pageData.totalCount}
      page={pageData.page}
      totalPages={pageData.totalPages}
      search={search}
    />
  );
}
