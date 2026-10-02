import { z } from "zod";

export const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  clientMessageId: z.string().min(8).max(200),
});

export type ChatInput = z.infer<typeof chatInputSchema>;
