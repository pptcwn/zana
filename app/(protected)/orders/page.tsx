import { getOrders, getProducts } from "@/lib/data/orders";
import OrdersClient from "./orders-client";

export default async function OrdersPage() {
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">จัดการออเดอร์ทั้งหมด</p>
      </div>
      <OrdersClient orders={orders} products={products} />
    </div>
  );
}
