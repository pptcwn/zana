import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";
import {
  createPageResult,
  escapePostgrestSearch,
  normalizePageRequest,
  type PageRequest,
} from "@/lib/data/pagination";

export type CustomerFilters = PageRequest & {
  platform?: string;
};

type CustomerOrderSummary = {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  invoice_date: string;
  platform: string;
  customer_id: string | null;
};

export async function getCustomers(filters: CustomerFilters = {}) {
  const supabase = await createClient();
  const pagination = normalizePageRequest(filters);

  let query = supabase
    .from("customers")
    .select(
      "id, name, phone, address, platform, tags, notes, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (pagination.search) {
    const pattern = `%${escapePostgrestSearch(pagination.search)}%`;
    query = query.or(`name.ilike.${pattern},phone.ilike.${pattern}`);
  }
  if (filters.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }

  const { data, error, count } = await query.range(pagination.from, pagination.to);
  if (error) throwDatabaseError(error, "getCustomers");

  const customerIds = (data ?? []).map((customer) => customer.id);
  const { data: summaries, error: summariesError } = customerIds.length > 0
    ? await supabase.rpc("get_customer_order_summaries", {
        p_customer_ids: customerIds,
      })
    : { data: [], error: null };

  if (summariesError) {
    throwDatabaseError(summariesError, "getCustomerOrderSummaries");
  }

  const summariesByCustomer = new Map(
    (summaries ?? []).map((summary) => [summary.customer_id, summary])
  );

  const customers = (data ?? []).map((customer) => ({
    ...customer,
    order_count: summariesByCustomer.get(customer.id)?.order_count ?? 0,
    total_spend: summariesByCustomer.get(customer.id)?.total_spend ?? 0,
    last_order_date: summariesByCustomer.get(customer.id)?.last_order_date ?? null,
    orders: (
      summariesByCustomer.get(customer.id)?.recent_orders ?? []
    ) as CustomerOrderSummary[],
  }));

  return createPageResult(
    customers,
    count ?? 0,
    pagination.page,
    pagination.limit
  );
}

export type CustomerRow = Awaited<ReturnType<typeof getCustomers>>["data"][number];

export async function updateCustomer(id: string, input: {
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(input).eq("id", id);
  if (error) throwDatabaseError(error, "updateCustomer");
}
