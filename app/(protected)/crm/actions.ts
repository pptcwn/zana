"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { markFollowupDone, skipFollowup } from "@/lib/data/crm";
import { requireCapability } from "@/lib/auth/shield";

export async function markDoneAction(id: string, outcome: string) {
  await requireCapability("crm:write");
  await markFollowupDone(
    z.uuid().parse(id),
    z.string().trim().min(1).max(2000).parse(outcome)
  );
  revalidatePath("/crm");
}

export async function skipAction(id: string) {
  await requireCapability("crm:write");
  await skipFollowup(z.uuid().parse(id));
  revalidatePath("/crm");
}
