import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type OrderStatus = "pending" | "shipped" | "completed" | "cancelled";

export async function getOrders(filters?: {
  status?: string;
  platform?: string;
  search?: string;
}) {
  const supabase = createServiceClient();

  let query = supabase
    .from("orders")
    .select(`
      id, order_number, platform, status, invoice_date, shipped_date,
      total_amount, total_cost, shipping_fee, discount, net_profit,
      payment_method, tracking_number, notes,
      customers ( id, name, phone, address ),
      admins ( id, name ),
      order_items ( id, product_name, qty, unit_price, unit_cost, subtotal )
    `)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return (data ?? []).filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customers?.name?.toLowerCase().includes(q) ||
        o.customers?.phone?.includes(q) ||
        o.tracking_number?.toLowerCase().includes(q)
    );
  }

  return data ?? [];
}

export type OrderRow = Awaited<ReturnType<typeof getOrders>>[number];

export async function getProducts() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, sell_price, cost_price, stock_qty")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getCustomerByPhone(phone: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, address, platform")
    .eq("phone", phone)
    .maybeSingle();
  return data;
}

export async function createOrder(input: {
  customer: { name: string; phone: string; address: string; platform: string };
  items: { product_id: string; product_name: string; qty: number; unit_price: number; unit_cost: number }[];
  platform: string;
  payment_method: string;
  shipping_fee: number;
  discount: number;
  notes: string;
}) {
  const supabase = createServiceClient();

  // upsert customer
  let customerId: string;
  const existing = await getCustomerByPhone(input.customer.phone);
  if (existing) {
    customerId = existing.id;
    await supabase
      .from("customers")
      .update({ name: input.customer.name, address: input.customer.address })
      .eq("id", customerId);
  } else {
    const { data: newCustomer, error: cErr } = await supabase
      .from("customers")
      .insert({ ...input.customer, tags: [] })
      .select("id")
      .single();
    if (cErr) throw cErr;
    customerId = newCustomer.id;
  }

  // generate order number
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", new Date().toISOString().slice(0, 10));
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  const orderNumber = `ORD-${dateStr}-${seq}`;

  const totalAmount = input.items.reduce((s, i) => s + i.unit_price * i.qty, 0) + input.shipping_fee - input.discount;
  const totalCost = input.items.reduce((s, i) => s + i.unit_cost * i.qty, 0);

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: customerId,
      platform: input.platform,
      status: "pending",
      invoice_date: new Date().toISOString().slice(0, 10),
      total_amount: totalAmount,
      total_cost: totalCost,
      shipping_fee: input.shipping_fee,
      discount: input.discount,
      payment_method: input.payment_method,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (oErr) throw oErr;

  // insert order items
  const itemsToInsert = input.items.map((i) => ({
    order_id: order.id,
    product_id: i.product_id,
    product_name: i.product_name,
    qty: i.qty,
    unit_price: i.unit_price,
    unit_cost: i.unit_cost,
  }));
  const { error: iErr } = await supabase.from("order_items").insert(itemsToInsert);
  if (iErr) throw iErr;

  // create followups
  const followupTypes = ["3day", "7day", "14day", "30day"] as const;
  const days = { "3day": 3, "7day": 7, "14day": 14, "30day": 30 };
  const followups = followupTypes.map((type) => {
    const due = new Date();
    due.setDate(due.getDate() + days[type]);
    return {
      customer_id: customerId,
      order_id: order.id,
      followup_type: type,
      due_date: due.toISOString().slice(0, 10),
      status: "pending",
    };
  });
  const { error: fErr } = await supabase.from("followups").insert(followups);
  if (fErr) throw fErr;

  return { orderId: order.id, orderNumber };
}

export async function updateOrderTracking(id: string, tracking_number: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({ tracking_number, status: "shipped", shipped_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) throw error;
}

export async function updateOrderStatus(id: string, status: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}
