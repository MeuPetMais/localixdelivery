import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260918204500_harden_public_table_truncate_privileges.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Gate D TRUNCATE hardening migration", () => {
  it("revokes TRUNCATE from anon and authenticated on existing public tables", () => {
    expect(migration).toContain(
      "REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;",
    );
  });

  it("removes TRUNCATE from future-table defaults for the postgres-owned app schema", () => {
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public");
    expect(migration).toContain("REVOKE TRUNCATE ON TABLES FROM anon, authenticated;");
  });

  it("does not alter application data", () => {
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bUPDATE\s+/i);
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\s+TABLE\b/i);
  });
});
