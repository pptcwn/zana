import { createServiceClient } from "@/lib/supabase/server";

export async function getAdSpend(days = 30) {
  const supabase = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("ad_spend")
    .select("id, spend_date, platform, amount, impressions, clicks, notes")
    .gte("spend_date", since.toISOString().slice(0, 10))
    .order("spend_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type AdSpendRow = Awaited<ReturnType<typeof getAdSpend>>[number];

export async function createAdSpend(input: {
  spend_date: string;
  platform: string;
  amount: number;
  impressions?: number | null;
  clicks?: number | null;
  notes?: string | null;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("ad_spend").insert(input);
  if (error) throw error;
}

export async function deleteAdSpend(id: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("ad_spend").delete().eq("id", id);
  if (error) throw error;
}
