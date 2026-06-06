import "server-only";
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

export type DeadLetterEvent = {
  id: string;
  platform: string;
  accountName: string | null;
  externalEventId: string;
  eventType: string;
  attempts: number;
  receivedAt: string;
  lastError: string | null;
};

export async function getDeadLetterEvents(): Promise<DeadLetterEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dead_letter_events")
    .select("id,platform,account_name,external_event_id,event_type,attempts,received_at,last_error")
    .order("received_at", { ascending: false })
    .limit(200);
  if (error) throwDatabaseError(error, "getDeadLetterEvents");
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    accountName: row.account_name,
    externalEventId: row.external_event_id,
    eventType: row.event_type,
    attempts: row.attempts,
    receivedAt: row.received_at,
    lastError: row.last_error,
  }));
}
