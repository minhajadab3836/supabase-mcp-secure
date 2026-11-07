import { z } from "zod";
import {
  GetCustomerMetricsSchema,
  handleGetCustomerMetrics,
} from "./analytics.js";
import {
  UpdateCustomerStatusSchema,
  handleUpdateCustomerStatus,
} from "./management.js";

export const toolsCatalog = [
  {
    name: "get_customer_metrics",
    description: "Retrieves aggregated customer metrics. Read-only execution.",
    inputSchema: z.toJSONSchema(GetCustomerMetricsSchema, { io: "input" }),
  },
  {
    name: "update_customer_status",
    description: "Updates account status for a customer UUID. Mutation (Requires Admin Scope).",
    inputSchema: z.toJSONSchema(UpdateCustomerStatusSchema, { io: "input" }),
  },
];

export async function executeTool(name: string, args: unknown) {
  switch (name) {
    case "get_customer_metrics": {
      const validated = GetCustomerMetricsSchema.parse(args);
      return await handleGetCustomerMetrics(validated);
    }
    case "update_customer_status": {
      const validated = UpdateCustomerStatusSchema.parse(args);
      return await handleUpdateCustomerStatus(validated);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
