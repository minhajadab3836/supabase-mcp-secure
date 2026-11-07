import { env } from "../config/env.js";

export function assertScope(isMutation: boolean, providedToken?: string): void {
  if (!isMutation) return; // Read-only ops allowed

  const isAdminMode = env.MCP_MODE === "ADMIN";
  const hasValidToken = Boolean(providedToken && providedToken === env.ADMIN_TOKEN);

  if (!isAdminMode && !hasValidToken) {
    throw new Error(
      "SECURITY_VIOLATION: Destructive/mutation operation blocked. Server must run in ADMIN mode or receive a valid Admin Token."
    );
  }
}
