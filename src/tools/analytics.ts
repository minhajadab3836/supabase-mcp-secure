import { z } from "zod";
import { supabase } from "../db/supabase.js";
import { assertScope } from "../middleware/scopeCheck.js";
import { logAction } from "../middleware/auditLogger.js";
import { sanitizeError } from "../middleware/errorHandler.js";

export const GetCustomerMetricsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export async function handleGetCustomerMetrics(rawArgs: unknown) {
  const startTime = Date.now();

  try {
    // Enforce Zod validation inside the handler
    const args = GetCustomerMetricsSchema.parse(rawArgs);

    assertScope(false);

    const { data, error } = await supabase.rpc("get_customer_metrics", {
      start_date: args.startDate,
      limit_val: args.limit,
    });

    if (error) throw error;

    await logAction({
      toolName: "get_customer_metrics",
      callerRole: "read_only",
      parameters: args,
      startTime,
      status: "SUCCESS",
    });

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    // If Zod validation fails, throw directly so caller receives ZodError
    if (err instanceof z.ZodError) {
      throw err;
    }

    const sanitizedMsg = sanitizeError(err);
    const isViolation = err instanceof Error && err.message.startsWith("SECURITY_VIOLATION");

    await logAction({
      toolName: "get_customer_metrics",
      callerRole: "read_only",
      parameters: typeof rawArgs === "object" && rawArgs !== null ? (rawArgs as Record<string, unknown>) : {},
      startTime,
      status: isViolation ? "BLOCKED" : "ERROR",
      errorMessage: sanitizedMsg,
    });

    return { isError: true, content: [{ type: "text", text: sanitizedMsg }] };
  }
}
