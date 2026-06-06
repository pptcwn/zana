import type { Json } from "../supabase/types.js";

export const PLATFORMS = ["tiktok", "shopee", "facebook"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type NormalizedPlatformEvent = {
  platform: Platform;
  externalEventId: string;
  eventType: string;
  externalOrderId?: string;
  externalStatus?: string;
  payload: Json;
};

export interface PlatformAdapter {
  normalize(payload: unknown): NormalizedPlatformEvent;
}
