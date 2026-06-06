import { createServiceClient } from "@/lib/supabase/server";

export async function getCustomers(search?: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("customers")
    .select(`
      id, name, phone, address, platform, tags, notes, created_at,
      orders ( id, order_number, total_amount, status, invoice_date, platform )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (search) {
    const q = search.toLowerCase();
    return (data ?? []).filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q)
    );
  }

  return data ?? [];
}

export type CustomerRow = Awaited<ReturnType<typeof getCustomers>>[number];

export async function updateCustomer(id: string, input: {
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("customers").update(input).eq("id", id);
  if (error) throw error;
}
