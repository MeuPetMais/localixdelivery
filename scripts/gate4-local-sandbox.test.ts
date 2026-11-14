import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareLocalSandbox, validateLocalSandboxConfig } from "./gate4-local-sandbox.mjs";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "localix-gate4-"));
  roots.push(root);
  const quote = "$".repeat(2);
  mkdirSync(join(root, "supabase", "functions"), { recursive: true });
  mkdirSync(join(root, "supabase", "migrations"), { recursive: true });
  writeFileSync(
    join(root, "supabase", "config.toml"),
    'project_id = "mvkfrwxgneqzvoabkaws"\n[functions.mp-webhook]\nverify_jwt = false\n',
  );
  writeFileSync(join(root, "supabase", "migrations", "00001_test.sql"), "select 1;\n");
  writeFileSync(
    join(root, "supabase", "migrations", "20260704162552_ebcdc1d4-907d-4762-8180-1ac3bb7a3bdd.sql"),
    [
      `CREATE FUNCTION loyalty_expire_points() RETURNS void AS ${quote} BEGIN END ${quote} LANGUAGE plpgsql;`,
      "-- Cron diário: expira + gera eventos de pré-aviso",
      `DO ${quote} BEGIN PERFORM cron.schedule('loyalty-daily-lifecycle', '0 3 * * *', ${quote}SELECT 1${quote}); END ${quote};`,
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "supabase", "migrations", "20260712153054_60234e8e-9ffc-4196-a8dc-97f3373b3053.sql"),
    [
      `CREATE FUNCTION expire_pending_payment_orders() RETURNS void AS ${quote} BEGIN END ${quote} LANGUAGE plpgsql;`,
      "-- Desagenda job antigo (se existir) antes de reagendar (idempotente)",
      `SELECT cron.schedule('expire-pending-payment-orders', '*/5 * * * *', ${quote}SELECT 1${quote});`,
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(
      root,
      "supabase",
      "migrations",
      "20260805160000_support_knowledge_category_scope_and_sla_cron.sql",
    ),
    [
      `CREATE FUNCTION run_support_sla_notifications_job() RETURNS void AS ${quote} BEGIN END ${quote} LANGUAGE plpgsql;`,
      `DO ${quote}`,
      "BEGIN",
      "  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'support-sla-notifications-every-5-minutes') THEN",
      `    PERFORM cron.schedule('support-sla-notifications-every-5-minutes', '*/5 * * * *', ${quote}SELECT 1${quote});`,
      "  END IF;",
      `END ${quote};`,
      "",
    ].join("\n"),
  );
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
    const report = JSON.parse(
      readFileSync(
        join(root, ".localix-financial-sandbox", "LOCAL_CRON_NEUTRALIZATION.json"),
        "utf8",
      ),
    );
    expect(report).toHaveLength(3);
    expect(
      report.every((item: { jobDisabledInLocalCopy: boolean }) => item.jobDisabledInLocalCopy),
    ).toBe(true);
    expect(report[0].originalSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report[0].localSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result).toMatchObject({
      prepared: true,
      migrationsExecuted: false,
      remoteAccessAttempted: false,
      databasePort: 55422,
      localCronJobsDisabled: 3,
    });

    const originalCron = readFileSync(
      join(
        root,
        "supabase",
        "migrations",
        "20260712153054_60234e8e-9ffc-4196-a8dc-97f3373b3053.sql",
      ),
      "utf8",
    );
    const localCron = readFileSync(
      join(
        root,
        ".localix-financial-sandbox",
        "supabase",
        "migrations",
        "20260712153054_60234e8e-9ffc-4196-a8dc-97f3373b3053.sql",
      ),
      "utf8",
    );
    expect(originalCron).toContain("cron.schedule");
    expect(localCron).not.toContain("cron.schedule");
    expect(localCron).toContain("CREATE FUNCTION expire_pending_payment_orders()");
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

  it("refuses a new unreviewed cron job without applying changes to the remote schema", () => {
    const root = fixture();
    writeFileSync(
      join(root, "supabase", "migrations", "99999999_surprise.sql"),
      "SELECT cron.schedule('unexpected', '* * * * *', 'SELECT 1');",
    );
    expect(() => prepareLocalSandbox(root)).toThrow("unreviewed_cron_schedule");
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
