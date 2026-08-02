import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type SanitizedError = {
  name: string | null;
  message: string | null;
  code: string | null;
  details: string | null;
  hint: string | null;
  status: number | null;
} | null;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type DiagnosticResult = {
  ok: boolean;
  status: number | null;
  body: JsonValue;
  error: SanitizedError;
};

async function readLimitedBody(response: Response) {
  const body = await response.text();
  return body.slice(0, 300);
}

function sanitizeError(error: any): SanitizedError {
  if (!error) return null;
  return {
    name: error.name ?? null,
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    status: error.status ?? null,
  };
}

function diagnosticError(message: string, status: number | null = null): NonNullable<SanitizedError> {
  return {
    name: null,
    message,
    code: null,
    details: null,
    hint: null,
    status,
  };
}

async function runTest(test: () => Promise<DiagnosticResult>): Promise<DiagnosticResult> {
  try {
    return await test();
  } catch (error) {
    return { ok: false, status: null, body: null, error: sanitizeError(error) };
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
    return {
      ok: false,
      status: 0,
      body: "Missing Supabase admin env",
      error: diagnosticError("Missing Supabase admin env", 0),
    };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    body: {
      contentType: response.headers.get("content-type"),
      cfRay: response.headers.get("cf-ray"),
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      text: await readLimitedBody(response),
    },
    error: response.ok ? null : diagnosticError(response.statusText, response.status),
  };
}

async function runRawRpc(SUPABASE_URL: string | undefined, SUPABASE_SERVICE_ROLE_KEY: string | undefined, userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      status: 0,
      body: "Missing Supabase admin env",
      error: diagnosticError("Missing Supabase admin env", 0),
    };
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
    ok: response.ok,
    status: response.status,
    body: {
      contentType: response.headers.get("content-type"),
      cfRay: response.headers.get("cf-ray"),
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      text: await readLimitedBody(response),
    },
    error: response.ok ? null : diagnosticError(response.statusText, response.status),
  };
}

async function runStandardClient(SUPABASE_URL: string | undefined, SUPABASE_SERVICE_ROLE_KEY: string | undefined, userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: diagnosticError("Missing Supabase admin env", 0),
    };
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
  const sanitizedError = sanitizeError(error);

  return {
    ok: !error,
    status: sanitizedError?.status ?? (error ? null : 200),
    body: data,
    error: sanitizedError,
  };
}

async function runCurrentAdminClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  const sanitizedError = sanitizeError(error);

  return {
    ok: !error,
    status: sanitizedError?.status ?? (error ? null : 200),
    body: data,
    error: sanitizedError,
  };
}

function skippedTest(message: string): DiagnosticResult {
  return { ok: false, status: 0, body: null, error: diagnosticError(message, 0) };
}

export const diagnoseSupabaseAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminCheck = await runTest(async () => {
      const { data: isAdmin, error: adminErr } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });

      const sanitizedAdminErr = sanitizeError(adminErr);
      return {
        ok: Boolean(isAdmin) && !adminErr,
        status: sanitizedAdminErr?.status ?? (adminErr ? null : 200),
        body: { isAdmin: Boolean(isAdmin) },
        error: adminErr
          ? sanitizedAdminErr
          : isAdmin
            ? null
            : diagnosticError("Sem permissão para executar diagnóstico", 0),
      };
    });

    const isAuthorized = adminCheck.ok;
    const rawRest = isAuthorized
      ? await runTest(() => runRawRest(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY))
      : skippedTest("Diagnóstico não executado: usuário autenticado não possui role admin");
    const rawRpc = isAuthorized
      ? await runTest(() => runRawRpc(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, context.userId))
      : skippedTest("Diagnóstico não executado: usuário autenticado não possui role admin");
    const standardClient = isAuthorized
      ? await runTest(() => runStandardClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, context.userId))
      : skippedTest("Diagnóstico não executado: usuário autenticado não possui role admin");
    const currentAdminClient = isAuthorized
      ? await runTest(() => runCurrentAdminClient(context.userId))
      : skippedTest("Diagnóstico não executado: usuário autenticado não possui role admin");

    const result = {
      env: maskedEnv(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
      adminCheck,
      rawRest,
      rawRpc,
      standardClient,
      currentAdminClient,
    };

    console.log("[Supabase Admin Diagnostic]", result);
    return result;
  });
