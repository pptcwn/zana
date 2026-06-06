import { env } from "@/env";
import { verifyHmac } from "./hmac";

export function verifyShopeeWebhook(rawBody: string, headers: Headers) {
  return verifyHmac(
    rawBody,
    headers.get("x-zana-signature") ?? headers.get("authorization"),
    env.SHOPEE_WEBHOOK_SECRET
  );
}
