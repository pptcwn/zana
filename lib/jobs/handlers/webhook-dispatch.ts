import { createClient } from "@supabase/supabase-js";
import type { Job } from "pg-boss";
import { z } from "zod";
import type { Database } from "../../supabase/types.js";
import type { Platform } from "../../platforms/types.js";
import type { WebhookDispatchJob } from "../queues.js";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export async function handleWebhookDispatch(
  jobs: Job<WebhookDispatchJob>[]
) {
  const env = schema.parse(process.env);
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  for (const job of jobs) {
    const { data: event, error } = await supabase
      .from("platform_webhook_events")
      .select("*")
      .eq("id", job.data.eventId)
      .single();
    if (error) throw error;
    if (event.processing_status === "processed") continue;

    await supabase
      .from("platform_webhook_events")
      .update({
        processing_status: "processing",
        attempts: event.attempts + 1,
        last_error: null,
      })
      .eq("id", event.id);

    try {
      const payload = event.payload as Record<string, unknown>;
      const platform = event.platform as Platform;
      const externalOrderId = String(
        payload.order_id ?? payload.ordersn ??
        (payload.data as Record<string, unknown> | undefined)?.order_id ?? ""
      ) || undefined;
      const externalStatus = String(
        payload.status ??
        (payload.data as Record<string, unknown> | undefined)?.status ?? ""
      ) || undefined;
      if (externalOrderId) {
        const { error: mappingError } = await supabase
          .from("platform_external_orders")
          .upsert(
            {
              platform,
              platform_account_id: event.platform_account_id,
              external_order_id: externalOrderId,
              external_status: externalStatus ?? null,
              last_payload: event.payload,
              last_synced_at: new Date().toISOString(),
            },
            {
              onConflict: "platform,platform_account_id,external_order_id",
            }
          );
        if (mappingError) throw mappingError;
      }
      const { error: doneError } = await supabase
        .from("platform_webhook_events")
        .update({
          processing_status: "processed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      if (doneError) throw doneError;
    } catch (processingError) {
      await supabase
        .from("platform_webhook_events")
        .update({
          processing_status: "failed",
          last_error: processingError instanceof Error
            ? processingError.message.slice(0, 2000)
            : "UNKNOWN_WEBHOOK_ERROR",
        })
        .eq("id", event.id);
      throw processingError;
    }
  }
}
