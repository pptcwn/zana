import { createServiceClient } from "@/lib/supabase/server";

export async function getFollowups() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("followups")
    .select(`
      id,
      followup_type,
      due_date,
      status,
      outcome,
      contacted_at,
      created_at,
      customers ( id, name, phone, platform ),
      orders ( id, order_number, total_amount ),
      admins ( id, name )
    `)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export type FollowupRow = Awaited<ReturnType<typeof getFollowups>>[number];

export async function markFollowupDone(id: string, outcome: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("followups")
    .update({ status: "done", outcome, contacted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function skipFollowup(id: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("followups")
    .update({ status: "skipped" })
    .eq("id", id);
  if (error) throw error;
}
