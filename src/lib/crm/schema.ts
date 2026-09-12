import { z } from "zod";

export const boardSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(5000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const stageSchema = z.object({ name: z.string().trim().min(1).max(160), position: z.number().int().min(0).max(10000).optional() });

export const dealSchema = z.object({
  board_id: z.number().int().positive(),
  stage_id: z.number().int().positive(),
  contact_id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  amount: z.number().min(0).max(999999999).optional(),
  notes: z.string().max(10000).nullable().optional(),
  position: z.number().int().min(0).max(100000).optional(),
});
