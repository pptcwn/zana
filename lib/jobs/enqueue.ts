import type { PgBoss } from "pg-boss";
import { QUEUES, type PlatformSyncJob } from "./queues.js";

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
