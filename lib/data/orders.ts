import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";
import {
  createPageResult,
  escapePostgrestSearch,
  normalizePageRequest,
  type PageRequest,
} from "@/lib/data/pagination";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

const ORDER_KANBAN_STAGE: Record<OrderStatus, OrderStatus> = {
  pending: "pending",
  confirmed: "confirmed",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

export type OrderFilters = PageRequest & {
  status?: string;
  platform?: string;
};

async function getMatchingCustomerIds(search: string) {
  const supabase = await createClient();
  const pattern = `%${search}%`;
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .or(`name.ilike.${pattern},phone.ilike.${pattern}`)
    .limit(500);

  if (error) throwDatabaseError(error, "getMatchingCustomerIds");
  return (data ?? []).map((customer) => customer.id);
}

function orderSearchFilter(search: string, customerIds: string[]) {
  const pattern = `%${escapePostgrestSearch(search)}%`;
  const filters = [
    `order_number.ilike.${pattern}`,
    `tracking_number.ilike.${pattern}`,
  ];

  if (customerIds.length > 0) {
    filters.push(`customer_id.in.(${customerIds.join(",")})`);
  }

  return filters.join(",");
}

export async function getOrders(filters: OrderFilters = {}) {
  const supabase = await createClient();
  const pagination = normalizePageRequest(filters);
  const customerIds = pagination.search
    ? await getMatchingCustomerIds(escapePostgrestSearch(pagination.search))
    : [];

  let query = supabase
    .from("orders")
    .select(`
      id, order_number, platform, status, invoice_date, shipped_date,
      total_amount, total_cost, shipping_fee, discount, net_profit,
      payment_method, tracking_number, notes,
      customers ( id, name, phone, address ),
      admins ( id, name ),
      order_items ( id, product_name, qty, unit_price, unit_cost, subtotal )
    `, { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }
  if (pagination.search) {
    query = query.or(orderSearchFilter(pagination.search, customerIds));
  }

  const { data, error, count } = await query.range(pagination.from, pagination.to);
  if (error) throwDatabaseError(error, "getOrders");

  return createPageResult(
    data ?? [],
    count ?? 0,
    pagination.page,
    pagination.limit
  );
}

export type OrderRow = Awaited<ReturnType<typeof getOrders>>["data"][number];

export async function getOrderStatusCounts(
  filters: Pick<OrderFilters, "platform" | "search"> = {}
) {
  const supabase = await createClient();
  const search = filters.search?.trim();
  const customerIds = search
    ? await getMatchingCustomerIds(escapePostgrestSearch(search))
    : [];

  async function countStatus(status: OrderStatus) {
    let query = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", status);

    if (filters.platform && filters.platform !== "all") {
      query = query.eq("platform", filters.platform);
    }
    if (search) {
      query = query.or(orderSearchFilter(search, customerIds));
    }

    const { count, error } = await query;
    if (error) throwDatabaseError(error, `getOrderStatusCount:${status}`);
    return count ?? 0;
  }

  const [pending, shipped, delivered] = await Promise.all([
    countStatus("pending"),
    countStatus("shipped"),
    countStatus("delivered"),
  ]);

  return { pending, shipped, delivered };
}

export async function getProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, sell_price, cost_price, stock_qty")
    .eq("is_active", true)
    .order("name");
  if (error) throwDatabaseError(error, "getOrderProducts");
  return data ?? [];
}

export type CreateOrderInput = {
  customer: { name: string; phone: string; address: string; platform: string };
  items: { product_id: string; qty: number }[];
  platform: string;
  payment_method: string;
  shipping_fee: number;
  discount: number;
  notes: string;
};

export async function createOrder(input: CreateOrderInput, adminId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order_transaction", {
    p_admin_id: adminId,
    p_customer: input.customer,
    p_items: input.items,
    p_platform: input.platform,
    p_payment_method: input.payment_method,
    p_shipping_fee: input.shipping_fee,
    p_discount: input.discount,
    p_notes: input.notes,
  });

  if (error) throwDatabaseError(error, "createOrderTransaction");

  const order = data?.[0];
  if (!order) throw new Error("ORDER_CREATION_RETURNED_NO_RESULT");

  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
  };
}

export async function updateOrderTracking(id: string, tracking_number: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      tracking_number,
      status: "shipped",
      kanban_stage: "shipped",
      shipped_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);
  if (error) throwDatabaseError(error, "updateOrderTracking");
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status, kanban_stage: ORDER_KANBAN_STAGE[status] })
    .eq("id", id);
  if (error) throwDatabaseError(error, "updateOrderStatus");
}
