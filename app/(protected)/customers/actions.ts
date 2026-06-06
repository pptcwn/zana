"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { upsertCustomer } from "@/lib/data/customers";
import { requireCapability } from "@/lib/auth/shield";

const platformSchema = z.object({
  platform: z.enum(["tiktok", "facebook", "line", "shopee"]),
  handle: z.string().trim().max(200).nullable(),
  is_primary: z.boolean(),
});

const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50),
  address: z.string().trim().max(2000).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  platforms: z
    .array(platformSchema)
    .min(1)
    .refine((list) => list.filter((p) => p.is_primary).length === 1, {
      message: "ต้องมี platform หลักเพียง 1 รายการ",
    })
    .refine(
      (list) => new Set(list.map((p) => p.platform)).size === list.length,
      { message: "platform ซ้ำกัน" }
    ),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export async function upsertCustomerAction(
  id: string | null,
  input: CustomerInput
) {
  const admin = await requireCapability("customers:write");
  const parsed = customerSchema.parse(input);
  await upsertCustomer(
    id ? z.uuid().parse(id) : null,
    parsed,
    admin.adminId
  );
  revalidatePath("/customers");
}
