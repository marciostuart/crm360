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

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
