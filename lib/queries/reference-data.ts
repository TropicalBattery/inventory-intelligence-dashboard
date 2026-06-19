import { createClient } from "@/lib/supabase/server";
import {
  appendMissingSupplierPlaceholderRows,
  resolveSingleSkuForSupplierComparison,
} from "@/lib/reference-data/placeholder-rows";
import { TENANT_ID } from "@/lib/tenant";
import {
  REFERENCE_DATA_PAGE_SIZE,
  type ItemSupplierReference,
  type ItemSupplierReferenceRow,
  type ProductOption,
  type SupplierOption,
} from "@/lib/types";

const PAGE_SIZE = REFERENCE_DATA_PAGE_SIZE;

function joinReferenceRows(
  references: ItemSupplierReference[],
  products: ProductOption[],
  suppliers: SupplierOption[]
): ItemSupplierReferenceRow[] {
  const productBySku = new Map(products.map((product) => [product.sku, product.name]));
  const supplierByExternalId = new Map(
    suppliers.map((supplier) => [supplier.external_id, supplier.name])
  );

  return references.map((reference) => ({
    ...reference,
    product_name: productBySku.get(reference.sku) ?? null,
    supplier_name: supplierByExternalId.get(reference.supplier_external_id) ?? null,
  }));
}

function filterRows(
  rows: ItemSupplierReferenceRow[],
  search: string
): ItemSupplierReferenceRow[] {
  const query = search.trim().toLowerCase();
  if (!query) {
    return rows;
  }

  return rows.filter((row) => {
    const skuMatch = row.sku.toLowerCase().includes(query);
    const nameMatch = row.product_name?.toLowerCase().includes(query) ?? false;
    return skuMatch || nameMatch;
  });
}

export async function getProductOptions(): Promise<ProductOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("sku, name")
    .eq("tenant_id", TENANT_ID)
    .not("sku", "is", null)
    .order("sku");

  if (error) {
    console.error("Failed to fetch products:", error.message);
    return [];
  }

  return (data ?? [])
    .filter((row): row is { sku: string; name: string | null } => Boolean(row.sku))
    .map((row) => ({
      sku: row.sku,
      name: row.name,
    }));
}

export async function getSupplierOptions(): Promise<SupplierOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .select("external_id, name")
    .eq("tenant_id", TENANT_ID)
    .order("name");

  if (error) {
    console.error("Failed to fetch suppliers:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    external_id: row.external_id,
    name: row.name,
  }));
}

export type ReferenceDataPageResult = {
  rows: ItemSupplierReferenceRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
};

export async function getReferenceDataPage(
  search = "",
  page = 1
): Promise<ReferenceDataPageResult> {
  const supabase = await createClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const [referencesResult, products, suppliers] = await Promise.all([
    supabase
      .from("item_supplier_reference")
      .select("*")
      .eq("tenant_id", TENANT_ID)
      .order("sku", { ascending: true }),
    getProductOptions(),
    getSupplierOptions(),
  ]);

  if (referencesResult.error) {
    console.error(
      "Failed to fetch item supplier reference:",
      referencesResult.error.message
    );
  }

  const references = (referencesResult.data ?? []) as ItemSupplierReference[];
  const joinedRows = joinReferenceRows(references, products, suppliers);
  let filteredRows = filterRows(joinedRows, search);

  const comparisonSku = resolveSingleSkuForSupplierComparison(
    search,
    products,
    filteredRows
  );
  if (comparisonSku) {
    const exactProduct = products.find(
      (product) => product.sku.toLowerCase() === search.trim().toLowerCase()
    );
    if (exactProduct) {
      filteredRows = joinedRows.filter((row) => row.sku === exactProduct.sku);
    }

    filteredRows = appendMissingSupplierPlaceholderRows(
      filteredRows,
      comparisonSku,
      products,
      suppliers
    );
  }

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(safePage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const rows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);

  return {
    rows,
    totalCount,
    page: currentPage,
    pageSize: PAGE_SIZE,
    totalPages,
    search,
  };
}
