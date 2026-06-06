import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdapter } from "@/lib/platforms/registry";
import { verifyPlatformWebhook } from "@/lib/platforms/verification";
import { storeWebhookEvent } from "@/lib/platforms/webhook-inbox";
import { getJobBoss } from "@/lib/jobs/client";
import { QUEUES } from "@/lib/jobs/queues";

const platformSchema = z.enum(["tiktok", "shopee", "facebook"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ platform: string }> }
) {
  const parsedPlatform = platformSchema.safeParse((await context.params).platform);
  if (!parsedPlatform.success) {
    return NextResponse.json({ error: "unsupported platform" }, { status: 404 });
  }
  const rawBody = await request.text();
  if (!verifyPlatformWebhook(parsedPlatform.data, rawBody, request.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const event = getPlatformAdapter(parsedPlatform.data).normalize(payload);
    const eventId = await storeWebhookEvent(event, request.headers);
    if (eventId) {
      const boss = await getJobBoss();
      await boss.send(QUEUES.webhookDispatch, { eventId }, {
        retryLimit: 8,
        retryBackoff: true,
        singletonKey: eventId,
      });
    }
    return NextResponse.json({ accepted: true });
  } catch (error) {
    console.error("[webhook] rejected payload", error);
    return NextResponse.json({ error: "unsupported payload" }, { status: 400 });
  }
}
