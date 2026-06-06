// env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    PGBOSS_DATABASE_URL: z.string().url(),
    TIKTOK_WEBHOOK_SECRET: z.string().min(16).optional(),
    SHOPEE_WEBHOOK_SECRET: z.string().min(16).optional(),
    FACEBOOK_WEBHOOK_SECRET: z.string().min(16).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
    TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),
    PLATFORM_CREDENTIALS_ENCRYPTION_KEY: z.string().min(32).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PGBOSS_DATABASE_URL: process.env.PGBOSS_DATABASE_URL,
    TIKTOK_WEBHOOK_SECRET: process.env.TIKTOK_WEBHOOK_SECRET,
    SHOPEE_WEBHOOK_SECRET: process.env.SHOPEE_WEBHOOK_SECRET,
    FACEBOOK_WEBHOOK_SECRET: process.env.FACEBOOK_WEBHOOK_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID,
    PLATFORM_CREDENTIALS_ENCRYPTION_KEY:
      process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
});
