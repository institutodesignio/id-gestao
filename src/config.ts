import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),

  SUPABASE_URL: z
    .string()
    .url(),

  SUPABASE_ANON_KEY: z
    .string()
    .min(1),

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173"),
});

const parsed = schema.parse(process.env);

export const config = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  SUPABASE_URL: parsed.SUPABASE_URL,
  SUPABASE_ANON_KEY: parsed.SUPABASE_ANON_KEY,

  corsOrigins: parsed.CORS_ORIGINS
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};