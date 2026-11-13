import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SANDBOX_DIR_NAME = ".localix-financial-sandbox";
const SANDBOX_MARKER = "LOCALIX_GATE4_LOCAL_SANDBOX_V1";
export const LOCAL_API = "http://127.0.0.1:55421";
export const LOCAL_DB_PORT = 55422;
const BLOCKED = ["mvkfrwxgneqzvoabkaws", "dnotmvbhuqujvqdtgzav"];
const REMOTE_URL = /https?:\/\/(?:[a-z0-9-]+\.)?supabase\.co/i;

export function validateLocalSandboxConfig(env) {
  const errors = [];
  const backend = String(env.SUPABASE_URL ?? "");
  const frontend = String(env.VITE_SUPABASE_URL ?? "");
  const serverProject = String(env.SUPABASE_PROJECT_ID ?? "");
  const frontendProject = String(env.VITE_SUPABASE_PROJECT_ID ?? "");
  const mode = String(env.MP_ENVIRONMENT ?? "");
  if (backend !== LOCAL_API || frontend !== LOCAL_API) errors.push("not_local_supabase");
  if (serverProject !== "localix-financial-sandbox" || frontendProject !== serverProject)
    errors.push("local_project_mismatch");
  if (REMOTE_URL.test(backend) || REMOTE_URL.test(frontend))
    errors.push("remote_supabase_forbidden");
  if (BLOCKED.includes(serverProject) || BLOCKED.includes(frontendProject))
    errors.push("shared_or_production_project_forbidden");
  if (mode !== "mock") errors.push("gateway_must_remain_mock");
  for (const key of [
    "MP_ACCESS_TOKEN",
    "MP_ACCESS_TOKEN_TEST",
    "MP_CLIENT_SECRET",
    "MP_WEBHOOK_RETRY_WORKER_SECRET",
    "MP_WEBHOOK_REPLAY_SECRET",
    "PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
    "DATABASE_URL",
  ]) {
    if (String(env[key] ?? "").trim()) errors.push("forbidden_variable:" + key);
  }
  if (env.MP_RETRY_AUTOMATION_ENABLED === "true") errors.push("worker_schedule_forbidden");
  return { ok: errors.length === 0, errors };
}

export function prepareLocalSandbox(repoRoot = ROOT, targetRoot = join(repoRoot, SANDBOX_DIR_NAME)) {
  const target = resolve(targetRoot);
  const root = resolve(repoRoot);
  // The helper must never overwrite files outside the dedicated local directory.
  if (target !== join(root, SANDBOX_DIR_NAME)) throw Error("sandbox_target_forbidden");
  const sourceConfig = join(root, "supabase", "config.toml");
  const sourceMigrations = join(root, "supabase", "migrations");
  const sourceFunctions = join(root, "supabase", "functions");
  if (!existsSync(sourceConfig) || !existsSync(sourceMigrations) || !existsSync(sourceFunctions))
    throw Error("repository_supabase_files_missing");

  const marker = join(target, ".localix-sandbox");
  if (existsSync(target) && (!existsSync(marker) || readFileSync(marker, "utf8") !== SANDBOX_MARKER))
    throw Error("sandbox_directory_not_owned");
  mkdirSync(join(target, "supabase"), { recursive: true });

  const original = readFileSync(sourceConfig, "utf8");
  if (!/^project_id\s*=\s*"[^"]+"/m.test(original))
    throw Error("source_project_id_missing");
  // NEVER reuse the repository's production project_id.
  let isolated = original.replace(/^project_id\s*=\s*"[^"]+"/m, 'project_id = "localix-financial-sandbox"');
  isolated += `
# Gate 4 local-only ports (kept separate from default Supabase CLI local stack).
[api]
port = 55421
[db]
port = 55422
shadow_port = 55420
[studio]
port = 55423
[inbucket]
port = 55424
`;
  if (BLOCKED.some((id) => isolated.includes(id))) throw Error("remote_project_in_config");
  writeFileSync(join(target, "supabase", "config.toml"), isolated);
  writeFileSync(marker, SANDBOX_MARKER);

  // These are copies only; no SQL is run and no remote database is touched.
  // A migration audit is REQUIRED before any local Supabase CLI start/db reset.
  cpSync(sourceMigrations, join(target, "supabase", "migrations"), { recursive: true, force: true });
  cpSync(sourceFunctions, join(target, "supabase", "functions"), { recursive: true, force: true });

  writeFileSync(
    join(target, "LOCAL_GATE4_README.txt"),
    [
      "Localix Gate 4 — sandbox prepared, NOT RUNNING.",
      "All files are copies. No migrations or Edge Functions executed.",
      "Do NOT use supabase link, db push, migration repair or db reset.",
      "Review all copied migrations before starting the local stack.",
      "The app/gateway must remain in mock-only mode until an authorized sandbox deployment.",
      "This directory is excluded from Git and must never receive real production secrets.",
      "",
    ].join("\n"),
  );
  return {
    prepared: true,
    target: SANDBOX_DIR_NAME,
    projectId: "localix-financial-sandbox",
    api: LOCAL_API,
    databasePort: LOCAL_DB_PORT,
    migrationsExecuted: false,
    remoteAccessAttempted: false,
  };
}

function main() {
  const command = process.argv[2] ?? "check";
  if (command === "check") {
    const result = validateLocalSandboxConfig(process.env);
    console.log(result.ok ? "LOCAL_H1_CONFIG_PASS" : "LOCAL_H1_CONFIG_BLOCKED");
    for (const code of result.errors) console.log(code);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }
  if (command === "prepare") {
    // Do not use npm scripts or shells to apply migrations implicitly.
    const result = prepareLocalSandbox();
    console.log(JSON.stringify(result));
    return;
  }
  console.error("Unsupported command. Allowed: prepare, check. No remote operations.");
  process.exitCode = 2;
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) main();
