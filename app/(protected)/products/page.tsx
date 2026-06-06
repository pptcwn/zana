import { getProducts } from "@/lib/data/products";
import { parsePositiveInteger, singleSearchParam } from "@/lib/data/pagination";
import ProductsClient from "./products-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const activeParam = singleSearchParam(params.active);
  const active: "active" | "inactive" | "all" = activeParam === "inactive" || activeParam === "all"
    ? activeParam
    : "active";
  const filters = {
    page: parsePositiveInteger(params.page),
    limit: parsePositiveInteger(params.limit),
    search: singleSearchParam(params.search),
    active,
  };
  const products = await getProducts(filters);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground mt-1">จัดการสินค้าและ stock</p>
      </div>
      <ProductsClient
        key={`${filters.search ?? ""}:${active}`}
        products={products.data}
        lowStock={products.lowStock}
        page={products.page}
        pageCount={products.pageCount}
        total={products.total}
        filters={{ search: filters.search ?? "", active }}
      />
    </div>
  );
}
