import { z } from "zod";

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(8).max(32),
  email: z.string().trim().email().max(254).nullable().optional(),
  source: z.string().trim().max(120).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  external_id: z.string().trim().max(191).nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ContactInput = z.infer<typeof contactInputSchema>;
