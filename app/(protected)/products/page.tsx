import { getProducts } from "@/lib/data/products";
import ProductsClient from "./products-client";

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Products</h1>
        <p className="text-sm text-slate-500 mt-1">จัดการสินค้าและ stock</p>
      </div>
      <ProductsClient products={products} />
    </div>
  );
}
