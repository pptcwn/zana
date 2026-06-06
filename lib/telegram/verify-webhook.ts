import { timingSafeEqual } from "node:crypto";

export function verifyTelegramWebhook(
  supplied: string | null,
  expected: string | undefined
) {
  if (!supplied || !expected) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
