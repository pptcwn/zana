"use server";

import { revalidatePath } from "next/cache";
import { updateCustomer } from "@/lib/data/customers";

export async function updateCustomerAction(id: string, input: Parameters<typeof updateCustomer>[1]) {
  await updateCustomer(id, input);
  revalidatePath("/customers");
}
