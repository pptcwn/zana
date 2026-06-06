import { PgBoss } from "pg-boss";
import { z } from "zod";
import { handleFollowupReminder } from "./handlers/followup-reminder.js";
import { handlePlatformSync } from "./handlers/platform-sync.js";
import { handleWebhookDispatch } from "./handlers/webhook-dispatch.js";
import { handleTelegramNotification } from "./handlers/telegram-notification.js";
import {
  QUEUES,
  type FollowupReminderJob,
  type PlatformSyncJob,
  type TelegramNotificationJob,
  type WebhookDispatchJob,
} from "./queues.js";

const envSchema = z.object({
  PGBOSS_DATABASE_URL: z.string().url(),
});

async function startWorker() {
  const env = envSchema.parse(process.env);
  const boss = new PgBoss(env.PGBOSS_DATABASE_URL);
  let stopping = false;

  boss.on("error", (error) => {
    console.error("[jobs] pg-boss error", error);
  });

  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    console.info("[jobs] shutting down", { signal });
    await boss.stop({ graceful: true, close: true, timeout: 30_000 });
    console.info("[jobs] stopped");
  }

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM").then(() => process.exit(0));
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT").then(() => process.exit(0));
  });

  await boss.start();
  await Promise.all([
    boss.createQueue(QUEUES.platformSync, {
      retryLimit: 5,
      retryBackoff: true,
    }),
    boss.createQueue(QUEUES.followupReminder, {
      retryLimit: 3,
      retryBackoff: true,
    }),
    boss.createQueue(QUEUES.webhookDispatch, {
      retryLimit: 8,
      retryBackoff: true,
    }),
    boss.createQueue(QUEUES.telegramNotification, {
      retryLimit: 5,
      retryBackoff: true,
    }),
  ]);

  await boss.schedule(
    QUEUES.followupReminder,
    "0 9 * * *",
    {},
    { tz: "Asia/Bangkok", key: "daily-followup-reminder" }
  );

  await Promise.all([
    boss.work<PlatformSyncJob>(QUEUES.platformSync, handlePlatformSync),
    boss.work<FollowupReminderJob>(
      QUEUES.followupReminder,
      handleFollowupReminder
    ),
    boss.work<WebhookDispatchJob>(
      QUEUES.webhookDispatch,
      handleWebhookDispatch
    ),
    boss.work<TelegramNotificationJob>(
      QUEUES.telegramNotification,
      handleTelegramNotification
    ),
  ]);

  console.info("[jobs] worker started", {
    queues: Object.values(QUEUES),
  });
}

startWorker().catch((error) => {
  console.error("[jobs] worker failed to start", error);
  process.exit(1);
});
