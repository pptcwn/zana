import { env } from "@/env";
import { verifyHmac } from "./hmac";

export function verifyFacebookWebhook(rawBody: string, headers: Headers) {
  return verifyHmac(
    rawBody,
    headers.get("x-hub-signature-256"),
    env.FACEBOOK_WEBHOOK_SECRET,
    "sha256="
  );
}
