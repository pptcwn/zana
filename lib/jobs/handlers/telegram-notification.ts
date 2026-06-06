import { createClient } from "@supabase/supabase-js";
import type { Job } from "pg-boss";
import { z } from "zod";
import type { Database } from "../../supabase/types.js";
import { sendTelegramMessage } from "../../notifications/telegram.js";
import type { TelegramNotificationJob } from "../queues.js";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
});

export async function handleTelegramNotification(
  jobs: Job<TelegramNotificationJob>[]
) {
  const env = schema.parse(process.env);
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  for (const job of jobs) {
    try {
      const response = await sendTelegramMessage({
        botToken: env.TELEGRAM_BOT_TOKEN,
        chatId: job.data.chatId,
        text: job.data.text,
        buttons: job.data.actionToken
          ? [[{
              text: "ดำเนินการ",
              callback_data: `zana:${job.data.actionToken}`,
            }]]
          : undefined,
      });
      await supabase.from("telegram_notification_logs").insert({
        chat_id: Number(job.data.chatId),
        event_type: "queued_notification",
        telegram_message_id: response.result?.message_id ?? null,
        status: "sent",
      });
    } catch (error) {
      await supabase.from("telegram_notification_logs").insert({
        chat_id: Number(job.data.chatId),
        event_type: "queued_notification",
        status: "failed",
        error_message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      });
      throw error;
    }
  }
}
