"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateCustomer } from "@/lib/data/customers";
import { requireCapability } from "@/lib/auth/shield";

const customerUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(50),
  address: z.string().trim().max(2000).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export async function updateCustomerAction(id: string, input: Parameters<typeof updateCustomer>[1]) {
  await requireCapability("customers:write");
  await updateCustomer(
    z.uuid().parse(id),
    customerUpdateSchema.parse(input)
  );
  revalidatePath("/customers");
}
