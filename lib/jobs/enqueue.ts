import type { PgBoss } from "pg-boss";
import {
  QUEUES,
  type PlatformSyncJob,
  type TelegramNotificationJob,
} from "./queues";

export async function enqueuePlatformSync(
  boss: PgBoss,
  data: PlatformSyncJob
) {
  return boss.send(QUEUES.platformSync, data, {
    retryLimit: 5,
    retryBackoff: true,
    singletonKey: `${data.platform}:${data.externalOrderId}`,
  });
}

export async function enqueueTelegramNotification(
  boss: PgBoss,
  data: TelegramNotificationJob
) {
  return boss.send(QUEUES.telegramNotification, data, {
    retryLimit: 5,
    retryBackoff: true,
  });
}
