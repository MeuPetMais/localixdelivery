import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RULES = [
  ["remote_reference", /mvkfrwxgneqzvoabkaws|dnotmvbhuqujvqdtgzav|[a-z0-9]{20}\.supabase\.co|supabase\.co\/functions/i],
  ["outbound_network", /\b(?:net\.http_(?:post|get|delete)|http\.(?:get|post)|http_request|http_post|http_get|dblink(?:_connect|_exec)?|postgres_fdw|foreign data wrapper)\b/i],
  ["scheduled_action", /\b(?:cron\.schedule|cron\.alter_job|pg_cron|schedule_job|pgmq)\b/i],
  ["network_or_secret_extension", /\b(?:pg_net|pg_http|vault\.|supabase_vault|aws_s3|aws_lambda|pgsodium)\b/i],
  ["webhook_or_url", /\b(?:webhook|https?:\/\/|endpoint_url|api_url)\b/i],
  ["privileged_function", /\bsecurity\s+definer\b/i],
  ["dynamic_execution", /\bexecute\b|\bcopy\b[^;\n]*\bprogram\b/i],
  ["financial_side_effect", /\b(?:insert\s+into|update|delete\s+from|truncate|drop\s+table)\s+(?:(?:public|private)\.)?(?:financial_ledger|payments|order_payment|payment_webhook_events|payment_event_queue|orders)\b/i],
  ["permissions_or_policies", /\b(?:create|alter|drop)\s+policy\b|\b(?:grant|revoke)\b|\b(?:enable|disable|force)\s+row\s+level\s+security\b/i],
  ["trigger", /\b(?:create|drop|alter)\s+trigger\b/i],
];

export function auditMigrations(migrationsDir) {
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  const findings = [];
  for (const file of files) {
    const lines = readFileSync(join(migrationsDir, file), "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      // Deliberate heuristic: omit full SQL from logs to avoid disclosing credentials.
      // Comment matches still appear; a human must confirm each flagged statement.
      for (const [code, pattern] of RULES) {
        if (pattern.test(lines[i])) findings.push({ file, line: i + 1, category: code });
      }
    }
  }
  const categories = Object.fromEntries(
    RULES.map(([code]) => [code, findings.filter((x) => x.category === code).length]),
  );
  const gateBlockers = findings.filter((x) =>
    [
      "remote_reference",
      "outbound_network",
      "scheduled_action",
      "network_or_secret_extension",
      "webhook_or_url",
      "financial_side_effect",
    ].includes(x.category),
  );
  return {
    migrations: files.length,
    findings,
    categories,
    gateBlocked: gateBlockers.length > 0,
    blockers: gateBlockers,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? resolve(process.argv[2]) : ROOT;
  const report = auditMigrations(join(root, "supabase", "migrations"));
  // No arbitrary file contents; only category, line and filename.
  console.log(JSON.stringify(report, null, 2));
  // An audit with findings is a success of the scan, NOT approval to run SQL.
  process.exitCode = report.gateBlocked ? 2 : 0;
}
