import "dotenv/config";
import { z } from "zod";
import { resolveCorsOrigins } from "./cors.js";

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

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  APP_PUBLIC_URL: z.string().url().optional(),

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
  SUPABASE_SERVICE_ROLE_KEY: parsed.SUPABASE_SERVICE_ROLE_KEY,
  APP_PUBLIC_URL: parsed.APP_PUBLIC_URL,

  corsOrigins: resolveCorsOrigins({
    configuredOrigins: parsed.CORS_ORIGINS,
    appPublicUrl: parsed.APP_PUBLIC_URL,
    nodeEnv: parsed.NODE_ENV,
  }),
};
