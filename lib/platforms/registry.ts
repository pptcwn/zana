import { facebookAdapter } from "./adapters/facebook";
import { shopeeAdapter } from "./adapters/shopee";
import { tiktokAdapter } from "./adapters/tiktok";
import type { Platform, PlatformAdapter } from "./types";

const adapters: Record<Platform, PlatformAdapter> = {
  tiktok: tiktokAdapter,
  shopee: shopeeAdapter,
  facebook: facebookAdapter,
};

export function getPlatformAdapter(platform: Platform) {
  return adapters[platform];
}
