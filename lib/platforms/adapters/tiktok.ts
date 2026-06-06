import { z } from "zod";
import type { PlatformAdapter } from "../types";

const schema = z.object({
  event_id: z.union([z.string(), z.number()]).transform(String),
  type: z.string().default("unknown"),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const tiktokAdapter: PlatformAdapter = {
  normalize(payload) {
    const event = schema.parse(payload);
    return {
      platform: "tiktok",
      externalEventId: event.event_id,
      eventType: event.type,
      externalOrderId: String(event.data.order_id ?? "") || undefined,
      externalStatus: String(event.data.status ?? "") || undefined,
      payload: payload as never,
    };
  },
};
