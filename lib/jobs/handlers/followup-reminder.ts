import { createClient } from "@supabase/supabase-js";
import type { Job } from "pg-boss";
import { z } from "zod";
import type { Database } from "../../supabase/types.js";
import type { FollowupReminderJob } from "../queues.js";
import { sendTelegramMessage } from "../../notifications/telegram.js";

const workerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),
});

export async function handleFollowupReminder(
  jobs: Job<FollowupReminderJob>[]
) {
  const env = workerEnvSchema.parse(process.env);
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("followups")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("due_date", today);

  if (error) throw error;

  for (const job of jobs) {
    console.info("[jobs] follow-up reminder summary", {
      jobId: job.id,
      scheduledFor: job.data.scheduledFor ?? today,
      dueCount: count ?? 0,
    });
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_DEFAULT_CHAT_ID && (count ?? 0) > 0) {
      await sendTelegramMessage({
        botToken: env.TELEGRAM_BOT_TOKEN,
        chatId: env.TELEGRAM_DEFAULT_CHAT_ID,
        text: `<b>CRM Follow-up</b>\nมีรายการครบกำหนด ${count ?? 0} รายการ`,
      });
    }
  }
}
