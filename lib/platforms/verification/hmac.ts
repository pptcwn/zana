import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyHmac(
  rawBody: string,
  suppliedSignature: string | null,
  secret: string | undefined,
  prefix = ""
) {
  if (!secret || !suppliedSignature) return false;
  const expected = `${prefix}${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const supplied = Buffer.from(suppliedSignature);
  const calculated = Buffer.from(expected);
  return supplied.length === calculated.length &&
    timingSafeEqual(supplied, calculated);
}
