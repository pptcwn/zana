"use server";

import { revalidatePath } from "next/cache";
import { createOrder, updateOrderTracking, updateOrderStatus } from "@/lib/data/orders";

export async function createOrderAction(input: Parameters<typeof createOrder>[0]) {
  const result = await createOrder(input);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/crm");
  return result;
}

export async function updateTrackingAction(id: string, tracking: string) {
  await updateOrderTracking(id, tracking);
  revalidatePath("/orders");
}

export async function updateStatusAction(id: string, status: string) {
  await updateOrderStatus(id, status);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
}
