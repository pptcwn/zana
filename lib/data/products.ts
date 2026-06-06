import { createServiceClient } from "@/lib/supabase/server";

export async function getProducts() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, category, cost_price, sell_price, stock_qty, low_stock_threshold, is_active, updated_at")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export type ProductRow = Awaited<ReturnType<typeof getProducts>>[number];

export async function updateProduct(id: string, input: {
  name?: string;
  sell_price?: number;
  cost_price?: number;
  stock_qty?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("products").update(input).eq("id", id);
  if (error) throw error;
}

export async function adjustStock(id: string, qtyChange: number, notes: string) {
  const supabase = createServiceClient();

  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("stock_qty")
    .eq("id", id)
    .single();
  if (pErr) throw pErr;

  const newQty = product.stock_qty + qtyChange;
  if (newQty < 0) throw new Error("stock ไม่เพียงพอ");

  const { error: uErr } = await supabase
    .from("products")
    .update({ stock_qty: newQty })
    .eq("id", id);
  if (uErr) throw uErr;

  await supabase.from("inventory_movements").insert({
    product_id: id,
    movement_type: qtyChange > 0 ? "restock" : "adjustment",
    qty_change: qtyChange,
    qty_after: newQty,
    notes: notes || null,
  });
}
