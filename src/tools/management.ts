import { z } from "zod";
import { supabase } from "../db/supabase.js";
import { assertScope } from "../middleware/scopeCheck.js";
import { logAction } from "../middleware/auditLogger.js";
import { sanitizeError } from "../middleware/errorHandler.js";

export const UpdateCustomerStatusSchema = z.object({
  customerId: z.string().uuid("Must be a valid UUID"),
  status: z.enum(["active", "suspended", "archived"]),
  adminToken: z.string().optional(),
});

export type UpdateCustomerStatusInput = z.infer<typeof UpdateCustomerStatusSchema>;

export async function handleUpdateCustomerStatus(args: UpdateCustomerStatusInput) {
  const startTime = Date.now();

  try {
    assertScope(true, args.adminToken); // Enforce admin scope guard

    const { data, error } = await supabase.rpc("update_customer_status", {
      target_customer_id: args.customerId,
      new_status: args.status,
    });

    if (error) throw error;

    await logAction({
      toolName: "update_customer_status",
      callerRole: "admin",
      parameters: { customerId: args.customerId, status: args.status },
      startTime,
      status: "SUCCESS",
    });

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  } catch (err) {
    const sanitizedMsg = sanitizeError(err);
    const isViolation = err instanceof Error && err.message.startsWith("SECURITY_VIOLATION");

    await logAction({
      toolName: "update_customer_status",
      callerRole: "admin",
      parameters: args,
      startTime,
      status: isViolation ? "BLOCKED" : "ERROR",
      errorMessage: sanitizedMsg,
    });

    return {
      isError: true,
      content: [{ type: "text", text: sanitizedMsg }],
    };
  }
}
