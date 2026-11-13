import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareLocalSandbox, validateLocalSandboxConfig } from "./gate4-local-sandbox.mjs";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "localix-gate4-"));
  roots.push(root);
  mkdirSync(join(root, "supabase", "functions"), { recursive: true });
  mkdirSync(join(root, "supabase", "migrations"), { recursive: true });
  writeFileSync(
    join(root, "supabase", "config.toml"),
    'project_id = "mvkfrwxgneqzvoabkaws"\n[functions.mp-webhook]\nverify_jwt = false\n',
  );
  writeFileSync(join(root, "supabase", "migrations", "00001_test.sql"), "select 1;\n");
  writeFileSync(join(root, "supabase", "functions", "index.ts"), "// synthetic\n");
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Gate 4 — sandbox financeiro estritamente local", () => {
  it("prepares only copied files and replaces the production project ID", () => {
    const root = fixture();
    const result = prepareLocalSandbox(root);
    const isolated = readFileSync(
      join(root, ".localix-financial-sandbox", "supabase", "config.toml"),
      "utf8",
    );
    expect(result).toMatchObject({
      prepared: true,
      migrationsExecuted: false,
      remoteAccessAttempted: false,
      databasePort: 55422,
    });
    expect(isolated).toContain('project_id = "localix-financial-sandbox"');
    expect(isolated).not.toContain("mvkfrwxgneqzvoabkaws");
    expect(isolated).toContain("port = 55422");
    expect(readFileSync(join(root, "supabase", "config.toml"), "utf8")).toContain(
      "mvkfrwxgneqzvoabkaws",
    );
    expect(
      readFileSync(
        join(root, ".localix-financial-sandbox", "supabase", "migrations", "00001_test.sql"),
        "utf8",
      ),
    ).toBe("select 1;\n");
  });

  it("refuses any target outside the dedicated sandbox directory", () => {
    const root = fixture();
    expect(() => prepareLocalSandbox(root, join(root, "supabase"))).toThrow(
      "sandbox_target_forbidden",
    );
  });

  it("refuses to overwrite an unowned directory", () => {
    const root = fixture();
    mkdirSync(join(root, ".localix-financial-sandbox"));
    expect(() => prepareLocalSandbox(root)).toThrow("sandbox_directory_not_owned");
  });

  it("rejects network/production keys and non-local targets", () => {
    const env = {
      SUPABASE_URL: "http://127.0.0.1:55421",
      VITE_SUPABASE_URL: "http://127.0.0.1:55421",
      SUPABASE_PROJECT_ID: "localix-financial-sandbox",
      VITE_SUPABASE_PROJECT_ID: "localix-financial-sandbox",
      MP_ENVIRONMENT: "mock",
    };
    expect(validateLocalSandboxConfig(env)).toEqual({ ok: true, errors: [] });
    const unsafe = validateLocalSandboxConfig({
      ...env,
      VITE_SUPABASE_URL: "https://mvkfrwxgneqzvoabkaws.supabase.co",
      MP_ACCESS_TOKEN_TEST: "TEST-not-allowed-before-mock-gate",
      PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL: "https://example.invalid",
      MP_RETRY_AUTOMATION_ENABLED: "true",
    });
    expect(unsafe.errors).toContain("not_local_supabase");
    expect(unsafe.errors).toContain("remote_supabase_forbidden");
    expect(unsafe.errors).toContain("forbidden_variable:MP_ACCESS_TOKEN_TEST");
    expect(unsafe.errors).toContain("worker_schedule_forbidden");
  });
});
