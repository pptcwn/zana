export const QUEUES = {
  platformSync: "platform-sync",
  followupReminder: "followup-reminder",
} as const;

export type PlatformSyncJob = {
  platform: "tiktok" | "shopee";
  externalOrderId: string;
};

export type FollowupReminderJob = {
  scheduledFor?: string;
};
