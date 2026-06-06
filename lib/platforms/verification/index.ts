import type { Platform } from "../types";
import { verifyFacebookWebhook } from "./facebook";
import { verifyShopeeWebhook } from "./shopee";
import { verifyTikTokWebhook } from "./tiktok";

export function verifyPlatformWebhook(
  platform: Platform,
  rawBody: string,
  headers: Headers
) {
  if (platform === "facebook") return verifyFacebookWebhook(rawBody, headers);
  if (platform === "tiktok") return verifyTikTokWebhook(rawBody, headers);
  return verifyShopeeWebhook(rawBody, headers);
}
