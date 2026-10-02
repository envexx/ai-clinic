import { z } from "zod";

export const documentInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(20000),
  sourceLabel: z.string().trim().max(160).optional(),
});

export const versionInputSchema = z.object({
  content: z.string().trim().min(1).max(20000),
  sourceLabel: z.string().trim().max(160).optional(),
});

export const documentUpdateSchema = z.object({
  active: z.boolean(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export type DocumentInput = z.infer<typeof documentInputSchema>;
export type VersionInput = z.infer<typeof versionInputSchema>;
