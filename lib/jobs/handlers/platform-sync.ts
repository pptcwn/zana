import type { Job } from "pg-boss";
import type { PlatformSyncJob } from "../queues.js";

export async function handlePlatformSync(jobs: Job<PlatformSyncJob>[]) {
  for (const job of jobs) {
    console.info("[jobs] platform sync placeholder", {
      jobId: job.id,
      platform: job.data.platform,
      externalOrderId: job.data.externalOrderId,
    });
  }
}
