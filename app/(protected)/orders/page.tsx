import { getOrders, getOrderStatusCounts, getProducts } from "@/lib/data/orders";
import { parsePositiveInteger, singleSearchParam } from "@/lib/data/pagination";
import OrdersClient from "./orders-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    page: parsePositiveInteger(params.page),
    limit: parsePositiveInteger(params.limit),
    search: singleSearchParam(params.search),
    status: singleSearchParam(params.status),
    platform: singleSearchParam(params.platform),
  };
  const [orders, counts, products] = await Promise.all([
    getOrders(filters),
    getOrderStatusCounts(filters),
    getProducts(),
  ]);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">จัดการออเดอร์ทั้งหมด</p>
      </div>
      <OrdersClient
        key={`${filters.search ?? ""}:${filters.status ?? "all"}:${filters.platform ?? "all"}`}
        orders={orders.data}
        products={products}
        page={orders.page}
        pageCount={orders.pageCount}
        total={orders.total}
        counts={counts}
        filters={{
          search: filters.search ?? "",
          status: filters.status ?? "all",
          platform: filters.platform ?? "all",
        }}
      />
    </div>
  );
}
