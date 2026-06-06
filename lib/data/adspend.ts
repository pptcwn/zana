import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

export async function getAdSpend(days = 30) {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("ad_spend")
    .select("id, spend_date, platform, amount, impressions, clicks, notes")
    .gte("spend_date", since.toISOString().slice(0, 10))
    .order("spend_date", { ascending: false });

  if (error) throwDatabaseError(error, "getAdSpend");
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
}, adminId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_spend")
    .insert({ ...input, created_by: adminId });
  if (error) throwDatabaseError(error, "createAdSpend");
}

export async function deleteAdSpend(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ad_spend").delete().eq("id", id);
  if (error) throwDatabaseError(error, "deleteAdSpend");
}
