"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createOrder, updateOrderTracking, updateOrderStatus } from "@/lib/data/orders";
import { requireCapability } from "@/lib/auth/shield";

const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(1).max(50),
    address: z.string().trim().max(2000),
    platform: z.enum(["tiktok", "facebook", "line", "shopee"]),
  }),
  items: z.array(z.object({
    product_id: z.uuid(),
    qty: z.number().int().positive(),
  })).min(1),
  platform: z.enum(["tiktok", "facebook", "line", "shopee"]),
  payment_method: z.string().trim().min(1).max(100),
  shipping_fee: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  notes: z.string().trim().max(2000),
});

const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);

export async function createOrderAction(input: Parameters<typeof createOrder>[0]) {
  const admin = await requireCapability("orders:write");
  const result = await createOrder(createOrderSchema.parse(input), admin.adminId);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/crm");
  return result;
}

export async function updateTrackingAction(id: string, tracking: string) {
  await requireCapability("orders:write");
  await updateOrderTracking(
    z.uuid().parse(id),
    z.string().trim().min(1).max(200).parse(tracking)
  );
  revalidatePath("/orders");
}

export async function updateStatusAction(id: string, status: string) {
  await requireCapability("orders:write");
  await updateOrderStatus(z.uuid().parse(id), orderStatusSchema.parse(status));
  revalidatePath("/orders");
  revalidatePath("/dashboard");
}
