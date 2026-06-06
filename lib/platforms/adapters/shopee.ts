import { z } from "zod";
import type { PlatformAdapter } from "../types";

const schema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  timestamp: z.union([z.string(), z.number()]).transform(String),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const shopeeAdapter: PlatformAdapter = {
  normalize(payload) {
    const event = schema.parse(payload);
    return {
      platform: "shopee",
      externalEventId: `${event.code}:${event.timestamp}:${String(event.data.ordersn ?? "")}`,
      eventType: event.code,
      externalOrderId: String(event.data.ordersn ?? "") || undefined,
      externalStatus: String(event.data.status ?? "") || undefined,
      payload: payload as never,
    };
  },
};
