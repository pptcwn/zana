import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { performTelegramAction } from "@/lib/telegram/actions";
import { verifyTelegramWebhook } from "@/lib/telegram/verify-webhook";
import { answerTelegramCallback } from "@/lib/notifications/telegram";

const updateSchema = z.object({
  callback_query: z.object({
    id: z.string(),
    from: z.object({ id: z.number().int() }),
    data: z.string(),
  }).optional(),
});

export async function POST(request: Request) {
  if (!verifyTelegramWebhook(
    request.headers.get("x-telegram-bot-api-secret-token"),
    env.TELEGRAM_WEBHOOK_SECRET
  )) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.callback_query) {
    return NextResponse.json({ accepted: true });
  }
  const callback = parsed.data.callback_query;
  const token = callback.data.startsWith("zana:")
    ? callback.data.slice(5)
    : "";
  if (!token || !env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "invalid callback" }, { status: 400 });
  }

  let actionError = false;
  try {
    await performTelegramAction({
      token,
      telegramUserId: callback.from.id,
    });
  } catch {
    actionError = true;
  }
  await answerTelegramCallback({
    botToken: env.TELEGRAM_BOT_TOKEN,
    callbackQueryId: callback.id,
    text: actionError ? "ไม่สามารถดำเนินการได้" : "อัปเดต ZANA แล้ว",
  });
  return NextResponse.json({ accepted: true });
}
