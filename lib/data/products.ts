import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";
import {
  createPageResult,
  escapePostgrestSearch,
  normalizePageRequest,
  type PageRequest,
} from "@/lib/data/pagination";

export type ProductFilters = PageRequest & {
  active?: "all" | "active" | "inactive";
};

export async function getProducts(filters: ProductFilters = {}) {
  const supabase = await createClient();
  const pagination = normalizePageRequest(filters);
  let query = supabase
    .from("products")
    .select(
      "id, name, sku, category, cost_price, sell_price, stock_qty, low_stock_threshold, is_active, updated_at",
      { count: "exact" }
    )
    .order("name");

  if (pagination.search) {
    const pattern = `%${escapePostgrestSearch(pagination.search)}%`;
    query = query.or(`name.ilike.${pattern},sku.ilike.${pattern}`);
  }
  if (filters.active === "active") query = query.eq("is_active", true);
  if (filters.active === "inactive") query = query.eq("is_active", false);

  const [{ data, error, count }, lowStockResult] = await Promise.all([
    query.range(pagination.from, pagination.to),
    supabase.rpc("get_low_stock_products"),
  ]);

  if (error) throwDatabaseError(error, "getProducts");
  if (lowStockResult.error) {
    throwDatabaseError(lowStockResult.error, "getLowStockProducts");
  }

  return {
    ...createPageResult(
      data ?? [],
      count ?? 0,
      pagination.page,
      pagination.limit
    ),
    lowStock: lowStockResult.data ?? [],
  };
}

export type ProductRow = Awaited<ReturnType<typeof getProducts>>["data"][number];

export async function updateProduct(id: string, input: {
  name?: string;
  sell_price?: number;
  cost_price?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(input).eq("id", id);
  if (error) throwDatabaseError(error, "updateProduct");
}

export async function adjustStock(
  id: string,
  qtyChange: number,
  notes: string,
  adminId: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock_transaction", {
    p_product_id: id,
    p_qty_change: qtyChange,
    p_notes: notes,
    p_admin_id: adminId,
  });
  if (error) throwDatabaseError(error, "adjustStockTransaction");
}
