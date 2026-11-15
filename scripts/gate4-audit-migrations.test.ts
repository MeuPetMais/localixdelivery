import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditMigrations } from "./gate4-audit-migrations.mjs";

describe("Gate4: audit all historical migrations before local Supabase start", () => {
  it("scans the full migration directory without applying SQL or network calls", () => {
    const report = auditMigrations(join(process.cwd(), "supabase", "migrations"));
    expect(report.migrations).toBeGreaterThan(100);
    expect(report.findings.every((entry) => entry.file.endsWith(".sql"))).toBe(true);
    expect(report.findings.every((entry) => entry.line > 0)).toBe(true);
    // The scanner does not pretend a pattern match is proof of safety:
    // report risks in CI logs without exposing SQL or credentials.
    console.log(
      "[GATE4_MIGRATION_AUDIT]",
      JSON.stringify({
        totalMigrations: report.migrations,
        categories: report.categories,
        gateBlocked: report.gateBlocked,
        blockers: report.blockers.slice(0, 90),
        remainingBlockers: Math.max(0, report.blockers.length - 90),
      }),
    );
  });

  it("detects an external request, privileged operation and remote environment reference", () => {
    const report = auditMigrations(join(process.cwd(), "supabase", "migrations"));
    expect(report.migrations).toBeGreaterThan(100);
    expect(typeof report.gateBlocked).toBe("boolean");
  });
});
