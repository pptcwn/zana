"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/shield";
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

const eventIdSchema = z.object({ eventId: z.string().uuid() });

export async function replayEventAction(input: z.infer<typeof eventIdSchema>) {
  const { eventId } = eventIdSchema.parse(input);
  const admin = await requireCapability("integrations:manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("replay_webhook_event", {
    p_event_id: eventId,
    p_admin_id: admin.adminId,
  });
  if (error) throwDatabaseError(error, "replayWebhookEvent");
  const { getJobBoss } = await import("@/lib/jobs/client");
  const { QUEUES } = await import("@/lib/jobs/queues");
  const boss = await getJobBoss();
  await boss.send(QUEUES.webhookDispatch, { eventId }, {
    retryLimit: 8,
    retryBackoff: true,
    singletonKey: `replay-${eventId}`,
  });
  revalidatePath("/admin/dead-letter");
}

export async function dismissEventAction(input: z.infer<typeof eventIdSchema>) {
  const { eventId } = eventIdSchema.parse(input);
  const admin = await requireCapability("integrations:manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_webhook_event", {
    p_event_id: eventId,
    p_admin_id: admin.adminId,
  });
  if (error) throwDatabaseError(error, "dismissWebhookEvent");
  revalidatePath("/admin/dead-letter");
}
