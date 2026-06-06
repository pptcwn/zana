"use server";

import { revalidatePath } from "next/cache";
import { markFollowupDone, skipFollowup } from "@/lib/data/crm";

export async function markDoneAction(id: string, outcome: string) {
  await markFollowupDone(id, outcome);
  revalidatePath("/crm");
}

export async function skipAction(id: string) {
  await skipFollowup(id);
  revalidatePath("/crm");
}
