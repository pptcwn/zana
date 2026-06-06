import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

export async function getFollowups() {
  const supabase = await createClient();

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

  if (error) throwDatabaseError(error, "getFollowups");
  return data ?? [];
}

export type FollowupRow = Awaited<ReturnType<typeof getFollowups>>[number];

export async function markFollowupDone(id: string, outcome: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("followups")
    .update({
      status: "done",
      kanban_stage: "done",
      outcome,
      contacted_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throwDatabaseError(error, "markFollowupDone");
}

export async function skipFollowup(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("followups")
    .update({ status: "skipped", kanban_stage: "cancelled" })
    .eq("id", id);
  if (error) throwDatabaseError(error, "skipFollowup");
}
