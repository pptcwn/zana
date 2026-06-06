import { env } from "@/env";
import { verifyHmac } from "./hmac";

export function verifyTikTokWebhook(rawBody: string, headers: Headers) {
  return verifyHmac(
    rawBody,
    headers.get("x-zana-signature") ?? headers.get("authorization"),
    env.TIKTOK_WEBHOOK_SECRET
  );
}
