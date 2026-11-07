export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Preserve security violations intact
    if (error.message.startsWith("SECURITY_VIOLATION")) {
      return error.message;
    }

    // Mask Postgres/PostgREST details
    const msg = error.message;
    if (msg.includes("PostgREST") || msg.includes("PGRST") || msg.includes("relation")) {
      return "DATABASE_ERROR: The requested query failed execution or internal constraints.";
    }

    return `EXECUTION_ERROR: ${msg}`;
  }

  return "UNKNOWN_ERROR: An unexpected error occurred during execution.";
}
