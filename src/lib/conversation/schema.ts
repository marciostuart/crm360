import { z } from "zod";

export const messageInputSchema = z.object({ content: z.string().trim().min(1).max(10000) });
