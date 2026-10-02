import { z } from "zod";

/**
 * Server-side environment validation.
 * Importing this module fails fast when a required variable is missing.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_BASE_URL: z.string().min(1).default("http://localhost:3000"),
  /** Required once the chat agent (M4) is implemented. */
  GEMINI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
