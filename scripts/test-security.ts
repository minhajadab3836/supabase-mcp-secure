import { handleGetCustomerMetrics } from "../src/tools/analytics.js";
import { handleUpdateCustomerStatus } from "../src/tools/management.js";
import { sanitizeError } from "../src/middleware/errorHandler.js";
import { assertScope } from "../src/middleware/scopeCheck.js";
import { env } from "../src/config/env.js";

async function runSecurityTests() {
  console.log("🔒 Starting Secure MCP Security Test Suite...\n");
  let failures = 0;

  // TEST 1: SQL Injection Prevention via Zod Regex
  console.log("Test 1: SQL Injection in date parameter");
  try {
    const maliciousPayload = {
      startDate: "2024-01-01'; DROP TABLE orders; --",
      limit: 10,
    };
    await handleGetCustomerMetrics(maliciousPayload as any);
    console.error("❌ FAILED: Injection payload was executed!");
    failures++;
  } catch {
    console.log("✅ PASSED: SQL Injection attempt caught by Zod schema validation.");
  }

  // TEST 2: Scope Bypass (Mutation in READ_ONLY mode)
  console.log("\nTest 2: Unauthorized mutation execution in READ_ONLY mode");
  try {
    const result = await handleUpdateCustomerStatus({
      customerId: "123e4567-e89b-12d3-a456-426614174000",
      status: "suspended",
    });
    
    if (result.isError && result.content[0].text.includes("SECURITY_VIOLATION")) {
      console.log("✅ PASSED: Scope Control guard blocked unauthorized mutation.");
    } else {
      console.error("❌ FAILED: Mutation was allowed without admin token!");
      failures++;
    }
  } catch (err: any) {
    if (err?.message?.includes("SECURITY_VIOLATION")) {
      console.log("✅ PASSED: Scope Control guard blocked unauthorized mutation.");
    } else {
      console.error("❌ FAILED: Unexpected error in scope test:", err);
      failures++;
    }
  }

  // TEST 3: Parameter Out-of-Bounds (Limit > 50)
  console.log("\nTest 3: Parameter overflow constraint check");
  try {
    await handleGetCustomerMetrics({
      startDate: "2026-01-01",
      limit: 99999,
    });
    console.error("❌ FAILED: Oversized limit passed through!");
    failures++;
  } catch {
    console.log("✅ PASSED: Parameter bound correctly enforced by Zod max limit.");
  }

  // TEST 4: Postgres / PostgREST Trace Sanitization
  console.log("\nTest 4: Error trace sanitization");
  const rawPostgresError = new Error('PGRST200: Could not find relation "customer_private_keys" in schema');
  const sanitized = sanitizeError(rawPostgresError);
  if (
    sanitized.includes("DATABASE_ERROR") &&
    !sanitized.includes("customer_private_keys") &&
    !sanitized.includes("PGRST200")
  ) {
    console.log("✅ PASSED: Sensitive database details stripped from error output.");
  } else {
    console.error("❌ FAILED: Error sanitizer leaked internal trace:", sanitized);
    failures++;
  }

  // TEST 5: Scope Authorization Check (Valid Admin Token)
  console.log("\nTest 5: Scope authorization verification");
  try {
    // Read-only operation should pass assertion
    assertScope(false);
    
    // Mutation with correct admin token (if configured) should pass
    if (env.ADMIN_TOKEN) {
      assertScope(true, env.ADMIN_TOKEN);
    }
    
    // Mutation with invalid token must throw
    let blocked = false;
    try {
      assertScope(true, "invalid-token-xyz");
    } catch {
      blocked = true;
    }

    if (blocked) {
      console.log("✅ PASSED: Scope guard correctly validates admin credentials.");
    } else {
      console.error("❌ FAILED: Invalid admin token bypassed scope guard!");
      failures++;
    }
  } catch (err) {
    console.error("❌ FAILED: Scope assertion logic error:", err);
    failures++;
  }

  if (failures > 0) {
    console.error(`\n💥 Security suite completed with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("\n🎉 Security suite complete. All 5 defense boundaries verified.");
}

runSecurityTests().catch((err) => {
  console.error("Fatal test suite runner error:", err);
  process.exit(1);
});
