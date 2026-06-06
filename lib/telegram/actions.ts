import { createServiceClient } from "@/lib/supabase/server";
import { hashActionToken } from "./action-tokens";

export async function performTelegramAction(input: {
  token: string;
  telegramUserId: number;
}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("perform_telegram_action", {
    p_token_hash: hashActionToken(input.token),
    p_telegram_user_id: input.telegramUserId,
  });
  if (error) throw error;
  return data;
}
