import { supabase } from "../db/supabase.js";

export interface AuditEntry {
  toolName: string;
  callerRole: "read_only" | "admin";
  parameters: Record<string, unknown>;
  startTime: number;
  status: "SUCCESS" | "BLOCKED" | "ERROR";
  errorMessage?: string;
}

export async function logAction(entry: AuditEntry): Promise<void> {
  const durationMs = Date.now() - entry.startTime;

  // Log to stderr so stdio JSON-RPC protocol stream stays clean
  console.error(
    `[AUDIT] ${new Date().toISOString()} | Tool: ${entry.toolName} | Status: ${entry.status} | Duration: ${durationMs}ms`
  );

  try {
    const { error } = await supabase.from("mcp_audit_logs").insert({
      tool_name: entry.toolName,
      caller_role: entry.callerRole,
      parameters: entry.parameters,
      execution_time_ms: durationMs,
      status: entry.status,
    });

    if (error) {
      console.error("[AUDIT LOG DB ERROR]:", error.message);
    }
  } catch (err) {
    console.error("[AUDIT LOG UNEXPECTED ERROR]:", err);
  }
}
