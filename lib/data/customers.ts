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

export type CustomerPlatform = {
  platform: string;
  handle: string | null;
  is_primary: boolean;
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

  const { data: platformRows, error: platformsError } = customerIds.length > 0
    ? await supabase
        .from("customer_platforms")
        .select("customer_id, platform, handle, is_primary")
        .in("customer_id", customerIds)
    : { data: [], error: null };

  if (platformsError) throwDatabaseError(platformsError, "getCustomerPlatforms");

  const platformsByCustomer = new Map<string, CustomerPlatform[]>();
  for (const row of platformRows ?? []) {
    const list = platformsByCustomer.get(row.customer_id) ?? [];
    list.push({ platform: row.platform, handle: row.handle, is_primary: row.is_primary });
    platformsByCustomer.set(row.customer_id, list);
  }

  const customers = (data ?? []).map((customer) => ({
    ...customer,
    order_count: summariesByCustomer.get(customer.id)?.order_count ?? 0,
    total_spend: summariesByCustomer.get(customer.id)?.total_spend ?? 0,
    last_order_date: summariesByCustomer.get(customer.id)?.last_order_date ?? null,
    orders: (
      summariesByCustomer.get(customer.id)?.recent_orders ?? []
    ) as CustomerOrderSummary[],
    platforms: (platformsByCustomer.get(customer.id) ?? [
      { platform: customer.platform, handle: null, is_primary: true },
    ]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
  }));

  return createPageResult(
    customers,
    count ?? 0,
    pagination.page,
    pagination.limit
  );
}

export type CustomerRow = Awaited<ReturnType<typeof getCustomers>>["data"][number];

export async function upsertCustomer(
  id: string | null,
  input: {
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
    platforms: CustomerPlatform[];
  },
  adminId: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_customer_with_platforms", {
    p_customer_id: id,
    p_name: input.name,
    p_phone: input.phone,
    p_address: input.address,
    p_notes: input.notes,
    p_platforms: input.platforms,
    p_admin_id: adminId,
  });
  if (error) throwDatabaseError(error, "upsertCustomer");
}
