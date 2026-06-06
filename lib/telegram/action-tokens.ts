import { createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export function hashActionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createTelegramActionToken(input: {
  action: string;
  entityType: "order" | "followup";
  entityId: string;
  targetStage: string;
  expiresInMinutes?: number;
}) {
  const token = randomBytes(18).toString("base64url");
  const supabase = createServiceClient();
  const expiresAt = new Date(
    Date.now() + (input.expiresInMinutes ?? 30) * 60_000
  ).toISOString();
  const { error } = await supabase.from("telegram_action_tokens").insert({
    token_hash: hashActionToken(token),
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    target_stage: input.targetStage,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return token;
}
