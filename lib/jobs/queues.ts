export const QUEUES = {
  platformSync: "platform-sync",
  followupReminder: "followup-reminder",
  webhookDispatch: "webhook-dispatch",
  telegramNotification: "telegram-notification",
} as const;

export type PlatformSyncJob = {
  platform: "tiktok" | "shopee";
  externalOrderId: string;
};

export type FollowupReminderJob = {
  scheduledFor?: string;
};

export type WebhookDispatchJob = { eventId: string };
export type TelegramNotificationJob = {
  chatId: string;
  text: string;
  actionToken?: string;
};
