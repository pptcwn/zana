import "server-only";
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

export type PlatformAccount = {
  id: string;
  platform: string;
  displayName: string;
  externalAccountId: string;
  isActive: boolean;
  isWebhookEnabled: boolean;
};

export async function getPlatformAccounts(): Promise<PlatformAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_accounts")
    .select("id,platform,display_name,external_account_id,is_active,is_webhook_enabled")
    .order("platform")
    .order("display_name");
  if (error) throwDatabaseError(error, "getPlatformAccounts");
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    displayName: row.display_name,
    externalAccountId: row.external_account_id,
    isActive: row.is_active,
    isWebhookEnabled: row.is_webhook_enabled,
  }));
}
