/**
 * Gate 4/H1: fail-closed, OFFLINE sandbox isolation preflight.
 *
 * Only checks environment variable presence/shape and known blocked projects.
 * It NEVER connects to Supabase, Vercel or Mercado Pago, and never logs secrets.
 * This cannot prove that TEST credentials belong to the chosen app/seller or
 * that payment OAuth, split and webhooks are correctly configured.
 */
const KNOWN_LOCALIX_NON_SANDBOX_PROJECTS = new Set([
  "mvkfrwxgneqzvoabkaws", // Localix Production
  "dnotmvbhuqujvqdtgzav", // Localix shared Staging with historical queue
]);

export function validateFinancialSandboxEnvironment(env) {
  const errors = [];
  const projectId = String(env.SUPABASE_PROJECT_ID ?? "").trim();
  const supabaseUrl = String(env.SUPABASE_URL ?? "").trim();
  const frontendUrl = String(env.VITE_SUPABASE_URL ?? "").trim();
  const frontendProject = String(env.VITE_SUPABASE_PROJECT_ID ?? "").trim();
  const mpMode = String(env.MP_ENVIRONMENT ?? "")
    .trim()
    .toLowerCase();
  const publicKey = String(env.MP_PUBLIC_KEY_TEST ?? "").trim();
  const accessToken = String(env.MP_ACCESS_TOKEN_TEST ?? "").trim();
  const cutover = String(env.MP_WEBHOOK_RETRY_CUTOVER ?? "").trim();

  if (!projectId) errors.push("missing_sandbox_supabase_project");
  if (KNOWN_LOCALIX_NON_SANDBOX_PROJECTS.has(projectId))
    errors.push("blocked_existing_localix_project");
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(supabaseUrl);
  if (!match) errors.push("invalid_supabase_url");
  else if (projectId && match[1] !== projectId) errors.push("backend_project_mismatch");
  if (match && KNOWN_LOCALIX_NON_SANDBOX_PROJECTS.has(match[1]))
    errors.push("blocked_existing_localix_url");

  if (!frontendUrl || !frontendProject) {
    errors.push("frontend_supabase_binding_missing");
  } else if (frontendUrl !== supabaseUrl || frontendProject !== projectId) {
    errors.push("frontend_backend_project_mismatch");
  }

  if (mpMode !== "sandbox" && mpMode !== "test") errors.push("mp_test_mode_missing");
  if (!publicKey.startsWith("TEST-")) errors.push("mp_public_key_not_test");
  if (!accessToken.startsWith("TEST-")) errors.push("mp_access_token_not_test");

  // Explicitly do not accept a webhook replay cutover on older shared data:
  // cutover has to be set and manually reviewed for a new sandbox.
  if (!cutover || !Number.isFinite(Date.parse(cutover))) errors.push("retry_cutover_unconfigured");

  if (env.MP_RETRY_AUTOMATION_ENABLED === "true") errors.push("scheduler_must_remain_off");
  if (env.PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL)
    errors.push("production_functions_fallback_present");

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = validateFinancialSandboxEnvironment(process.env);
  console.log(
    result.ok ? "H1_PREFLIGHT_PASS (config only; NO financial E2E)" : "H1_PREFLIGHT_BLOCKED",
  );
  for (const code of result.errors) console.log(code);
  process.exitCode = result.ok ? 0 : 1;
}
