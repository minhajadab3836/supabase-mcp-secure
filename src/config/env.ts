// src/config/env.ts
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MCP_MODE: z.enum(["READ_ONLY", "ADMIN"]).default("READ_ONLY"),
  ADMIN_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
