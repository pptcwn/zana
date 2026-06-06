import { createServiceClient } from "@/lib/supabase/server";
import type { NormalizedPlatformEvent } from "./types";

export async function storeWebhookEvent(
  event: NormalizedPlatformEvent,
  headers: Headers
) {
  const supabase = createServiceClient();
  const safeHeaders = Object.fromEntries(
    ["content-type", "user-agent"].map((name) => [name, headers.get(name)])
  );
  const { data, error } = await supabase
    .from("platform_webhook_events")
    .upsert(
      {
        platform: event.platform,
        external_event_id: event.externalEventId,
        event_type: event.eventType,
        payload: event.payload,
        headers: safeHeaders,
      },
      { onConflict: "platform,external_event_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
