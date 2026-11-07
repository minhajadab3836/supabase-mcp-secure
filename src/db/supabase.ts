import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

// Ensure global WebSocket is defined for Supabase client initialization in Node < 22
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = class StubWebSocket {};
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
