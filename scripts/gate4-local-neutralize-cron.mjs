import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// This allowlist is intentionally narrow. Never edit repository migrations.
// The exact SQL tails were inspected in PR #100 and must match byte-for-byte.
const CRON_TAILS = [
  {
    file: "20260704162552_ebcdc1d4-907d-4762-8180-1ac3bb7a3bdd.sql",
    marker: "-- Cron diário: expira + gera eventos de pré-aviso",
    job: "loyalty-daily-lifecycle",
  },
  {
    file: "20260712153054_60234e8e-9ffc-4196-a8dc-97f3373b3053.sql",
    marker: "-- Desagenda job antigo (se existir) antes de reagendar (idempotente)",
    job: "expire-pending-payment-orders",
  },
  {
    file: "20260805160000_support_knowledge_category_scope_and_sla_cron.sql",
    marker:
      "DO $\\nBEGIN\\n  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'support-sla-notifications-every-5-minutes')",
    job: "support-sla-notifications-every-5-minutes",
  },
];

const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const cronCall = /\bcron\s*\.\s*schedule\s*\(/gi;

export function neutralizeLocalCronJobs(sourceDirectory, targetDirectory) {
  if (sourceDirectory === targetDirectory) throw Error("source_equals_destination");
  const changes = [];
  // Preflight everything BEFORE writing: no partially sanitized migrations.
  for (const { file, marker, job } of CRON_TAILS) {
    const originalPath = join(sourceDirectory, file);
    const localPath = join(targetDirectory, file);
    if (!existsSync(originalPath) || !existsSync(localPath))
      throw Error("expected_migration_missing:" + file);
    const original = readFileSync(originalPath, "utf8");
    const copied = readFileSync(localPath, "utf8");
    if (copied !== original) throw Error("migration_copy_mismatch:" + file);
    const first = original.indexOf(marker);
    if (first < 0 || first !== original.lastIndexOf(marker))
      throw Error("cron_anchor_missing_or_duplicated:" + file);
    const prefix = original.slice(0, first);
    const tail = original.slice(first);
    if (!tail.includes(job) || !/\bcron\s*\.\s*schedule\s*\(/i.test(tail))
      throw Error("cron_job_signature_changed:" + file);
    if ((tail.match(cronCall) ?? []).length !== 1)
      throw Error("unexpected_cron_schedule_count:" + file);
    const remaining = prefix + "-- LOCALIX GATE4: cron job disabled only in this disposable local copy.\n";
    if (cronCall.test(remaining)) throw Error("remaining_cron_schedule:" + file);
    cronCall.lastIndex = 0;
    changes.push({
      file,
      job,
      originalSha256: sha256(original),
      localSha256: sha256(remaining),
      remaining,
    });
  }
  // Refuse any other scheduled action, including new migration files.
  const allowed = new Set(CRON_TAILS.map((item) => item.file));
  for (const file of readdirSync(sourceDirectory).filter((name) => name.endsWith(".sql"))) {
    if (allowed.has(file)) continue;
    const sql = readFileSync(join(sourceDirectory, file), "utf8");
    if (/\bcron\s*\.\s*schedule\s*\(/i.test(sql))
      throw Error("unreviewed_cron_schedule:" + file);
  }
  for (const { file, remaining } of changes) writeFileSync(join(targetDirectory, file), remaining);
  return changes.map(({ file, job, originalSha256, localSha256 }) => ({
    file,
    job,
    originalSha256,
    localSha256,
    jobDisabledInLocalCopy: true,
  }));
}
