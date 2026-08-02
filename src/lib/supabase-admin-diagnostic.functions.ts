import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type SanitizedError = {
  name?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
} | null;

type DiagnosticFailure = {
  data?: null;
  error: SanitizedError;
};

async function readLimitedBody(response: Response) {
  const body = await response.text();
  return body.slice(0, 300);
}

function sanitizeError(error: any): SanitizedError {
  if (!error) return null;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    status: error.status,
  };
}

async function runSafely<T>(test: () => Promise<T>): Promise<T | DiagnosticFailure> {
  try {
    return await test();
  } catch (error) {
    return { data: null, error: sanitizeError(error) };
  }
}

function maskedEnv(SUPABASE_URL?: string, SUPABASE_SERVICE_ROLE_KEY?: string) {
  return {
    url: SUPABASE_URL ?? null,
    serviceRoleExists: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    serviceRoleLength: SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    serviceRoleFirst8: SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8) ?? null,
    serviceRoleLast8: SUPABASE_SERVICE_ROLE_KEY?.slice(-8) ?? null,
  };
}

async function runRawRest(SUPABASE_URL?: string, SUPABASE_SERVICE_ROLE_KEY?: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 0, ok: false, contentType: null, cfRay: null, requestId: null, body: "Missing Supabase admin env" };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  return {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    cfRay: response.headers.get("cf-ray"),
    requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
    body: await readLimitedBody(response),
  };
}

async function runRawRpc(SUPABASE_URL: string | undefined, SUPABASE_SERVICE_ROLE_KEY: string | undefined, userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 0, ok: false, contentType: null, cfRay: null, requestId: null, body: "Missing Supabase admin env" };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      _user_id: userId,
      _role: "admin",
    }),
  });

  return {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    cfRay: response.headers.get("cf-ray"),
    requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
    body: await readLimitedBody(response),
  };
}

async function runStandardClient(SUPABASE_URL: string | undefined, SUPABASE_SERVICE_ROLE_KEY: string | undefined, userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { data: null, error: { message: "Missing Supabase admin env" } };
  }

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  return { data, error: sanitizeError(error) };
}

async function runCurrentAdminClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  return { data, error: sanitizeError(error) };
}

export const diagnoseSupabaseAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: adminErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) throw new Error("Sem permissão para executar diagnóstico");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const rawRest = await runSafely(() => runRawRest(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY));
    const rawRpc = await runSafely(() => runRawRpc(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, context.userId));
    const standardClient = await runSafely(() => runStandardClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, context.userId));
    const currentAdminClient = await runSafely(() => runCurrentAdminClient(context.userId));

    const result = {
      env: maskedEnv(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
      rawRest,
      rawRpc,
      standardClient,
      currentAdminClient,
    };

    console.log("[Supabase Admin Diagnostic]", result);
    return result;
  });
