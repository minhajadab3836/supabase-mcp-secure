import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolsCatalog, executeTool } from "./tools/index.js";
import { env } from "./config/env.js";

// 1. Initialize MCP Server instance
const server = new Server(
  {
    name: "supabase-mcp-secure",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 2. Register Tool Discovery Handler (ListTools)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolsCatalog,
  };
});

// 3. Register Tool Execution Handler (CallTool)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await executeTool(name, args ?? {});
});

// 4. Start Server with STDIO Transport
async function main() {
  const transport = new StdioServerTransport();
  
  // Clean shutdown handlers
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  
  // Log server start to stderr to keep stdout clear for JSON-RPC messages
  console.error(
    `[INFO] Secure Supabase MCP Server operational in ${env.MCP_MODE} mode.`
  );
}

main().catch((error) => {
  console.error("[FATAL] MCP Server failed to start:", error);
  process.exit(1);
});
