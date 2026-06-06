import { z } from "zod";
import type { PlatformAdapter } from "../types";

const schema = z.object({
  object: z.string(),
  entry: z.array(z.record(z.string(), z.unknown())).min(1),
});

export const facebookAdapter: PlatformAdapter = {
  normalize(payload) {
    const event = schema.parse(payload);
    const entry = event.entry[0];
    const externalEventId = `${String(entry.id ?? "unknown")}:${String(entry.time ?? Date.now())}`;
    return {
      platform: "facebook",
      externalEventId,
      eventType: event.object,
      payload: payload as never,
    };
  },
};
