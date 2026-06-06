"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdSpend, deleteAdSpend } from "@/lib/data/adspend";
import { requireCapability } from "@/lib/auth/shield";

const adSpendSchema = z.object({
  spend_date: z.iso.date(),
  platform: z.enum(["tiktok", "facebook", "line", "shopee"]),
  amount: z.number().nonnegative(),
  impressions: z.number().int().nonnegative().nullable().optional(),
  clicks: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function createAdSpendAction(input: Parameters<typeof createAdSpend>[0]) {
  const admin = await requireCapability("ad-spend:write");
  await createAdSpend(adSpendSchema.parse(input), admin.adminId);
  revalidatePath("/ad-spend");
  revalidatePath("/dashboard");
}

export async function deleteAdSpendAction(id: string) {
  await requireCapability("ad-spend:write");
  await deleteAdSpend(z.uuid().parse(id));
  revalidatePath("/ad-spend");
  revalidatePath("/dashboard");
}
