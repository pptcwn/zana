"use server";

import { revalidatePath } from "next/cache";
import { createAdSpend, deleteAdSpend } from "@/lib/data/adspend";

export async function createAdSpendAction(input: Parameters<typeof createAdSpend>[0]) {
  await createAdSpend(input);
  revalidatePath("/ad-spend");
  revalidatePath("/dashboard");
}

export async function deleteAdSpendAction(id: string) {
  await deleteAdSpend(id);
  revalidatePath("/ad-spend");
  revalidatePath("/dashboard");
}
