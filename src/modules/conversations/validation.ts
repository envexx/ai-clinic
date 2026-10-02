import { z } from "zod";

export const claimSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const resolveSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const replySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const noteSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});
