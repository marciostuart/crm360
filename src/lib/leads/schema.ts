import { z } from "zod";

export const leadPayloadSchema = z.object({
  external_id: z.string().trim().min(1).max(191).optional(),
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(8).max(32),
  email: z.string().trim().email().max(254).optional(),
  source: z.string().trim().min(1).max(120).optional(),
  notes: z.string().max(10000).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export type LeadPayload = z.infer<typeof leadPayloadSchema>;

/** Stores phones as digits-only DDI + DDD + subscriber number. */
export function normalizePhone(phone: string): string {
  let digits = phone.trim().replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Brazilian local numbers with a DDD receive the default country code.
  if (/^[1-9]\d{9,10}$/.test(digits) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export function isValidNormalizedPhone(phone: string): boolean {
  if (!/^\d{10,15}$/.test(phone) || phone.startsWith("0")) return false;
  if (phone.startsWith("55")) return /^55[1-9]\d\d{8,9}$/.test(phone);
  return true;
}
