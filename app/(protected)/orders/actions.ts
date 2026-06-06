"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createOrder, updateOrderTracking, updateOrderStatus } from "@/lib/data/orders";
import { requireCapability } from "@/lib/auth/shield";
import { env } from "@/env";
import { getJobBoss } from "@/lib/jobs/client";
import { enqueueTelegramNotification } from "@/lib/jobs/enqueue";
import { createTelegramActionToken } from "@/lib/telegram/action-tokens";

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
  if (env.TELEGRAM_DEFAULT_CHAT_ID && env.TELEGRAM_BOT_TOKEN) {
    try {
      const actionToken = await createTelegramActionToken({
        action: "mark_packed",
        entityType: "order",
        entityId: result.orderId,
        targetStage: "packed",
      });
      await enqueueTelegramNotification(await getJobBoss(), {
        chatId: env.TELEGRAM_DEFAULT_CHAT_ID,
        text: `<b>ออเดอร์ใหม่</b>\n${result.orderNumber}`,
        actionToken,
      });
    } catch (error) {
      console.error("[telegram] order notification enqueue failed", error);
    }
  }
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
  if (env.TELEGRAM_DEFAULT_CHAT_ID && env.TELEGRAM_BOT_TOKEN) {
    try {
      await enqueueTelegramNotification(await getJobBoss(), {
        chatId: env.TELEGRAM_DEFAULT_CHAT_ID,
        text: `<b>สถานะออเดอร์เปลี่ยน</b>\n${status}`,
      });
    } catch (error) {
      console.error("[telegram] status notification enqueue failed", error);
    }
  }
  revalidatePath("/orders");
  revalidatePath("/dashboard");
}
