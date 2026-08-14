import { createServerFn } from "@tanstack/react-start";
import {
  buildCustomerSignupMetadata,
  customerSignupSchema,
  isDuplicateAuthUserError,
  type CustomerSignupData,
} from "./customer-signup";

const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

type SupabaseAdminLike = {
  auth: {
    admin: {
      createUser: (
        args: unknown,
      ) => Promise<{ data: { user?: { id: string } } | null; error: AuthErrorLike | null }>;
      deleteUser: (userId: string) => Promise<{ error?: AuthErrorLike | null } | void>;
    };
  };
  from: (table: string) => {
    select: (columns?: string) => unknown;
    upsert?: (values: unknown, options?: unknown) => Promise<{ error: AuthErrorLike | null }>;
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: AuthErrorLike | null }>;
};

type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

type QueryLike<T = unknown> = {
  eq: (column: string, value: unknown) => QueryLike<T>;
  single: () => Promise<{ data: T | null; error: AuthErrorLike | null }>;
};

type ListQueryLike<T = unknown> = {
  eq: (
    column: string,
    value: unknown,
  ) => Promise<{ data: T[] | null; error: AuthErrorLike | null }>;
};

type RoleRow = { role: string };
type CustomerProfileRow = { id: string; email: string | null; full_name: string | null };

function getRequestIpFromHeaders(
  req: { headers: { get: (name: string) => string | null } } | undefined,
) {
  const forwarded = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req?.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

export async function hashRateLimitValue(value: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

function safeErrorDetails(error: unknown) {
  const e = (error ?? {}) as AuthErrorLike;
  return {
    code: e.code,
    status: e.status,
    message: e.message?.slice(0, 160),
  };
}

function logCriticalSignupFailure(
  stage: string,
  userId: string,
  error: unknown,
  rollbackOk?: boolean,
) {
  console.error("[customer-signup] critical failure", {
    stage,
    userId,
    rollbackOk,
    error: safeErrorDetails(error),
  });
}

export async function assertCustomerSignupRateLimit(
  supabaseAdmin: SupabaseAdminLike,
  email: string,
  ip: string,
) {
  const { data, error } = await supabaseAdmin.rpc("check_customer_signup_rate_limit", {
    ip_hash: await hashRateLimitValue(ip),
    email_hash: await hashRateLimitValue(email),
    max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
    window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (error) {
    throw new Error("Não foi possível validar a tentativa de cadastro. Tente novamente.");
  }

  if (data !== true) {
    throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
}

async function rollbackCreatedUser(
  supabaseAdmin: SupabaseAdminLike,
  userId: string,
  stage: string,
  error: unknown,
) {
  const rollback = await supabaseAdmin.auth.admin.deleteUser(userId);
  const rollbackError = rollback && "error" in rollback ? rollback.error : null;
  logCriticalSignupFailure(stage, userId, error, !rollbackError);

  if (rollbackError) {
    logCriticalSignupFailure("rollback_failed", userId, rollbackError, false);
  }
}

async function requireCustomerProfile(supabaseAdmin: SupabaseAdminLike, userId: string) {
  const query = supabaseAdmin
    .from("customer_profiles")
    .select("id,email,full_name") as QueryLike<CustomerProfileRow>;
  const { data, error } = await query.eq("id", userId).single();

  if (error || !data) {
    throw error ?? new Error("customer_profile_missing");
  }

  return data;
}

async function requireOnlyCustomerRole(supabaseAdmin: SupabaseAdminLike, userId: string) {
  const userRoles = supabaseAdmin.from("user_roles");
  if (!userRoles.upsert) throw new Error("user_roles_upsert_unavailable");

  const { error: roleError } = await userRoles.upsert(
    { user_id: userId, role: "customer" },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  const query = supabaseAdmin.from("user_roles").select("role") as ListQueryLike<RoleRow>;
  const { data, error } = await query.eq("user_id", userId);

  if (error) throw error;

  const roles = data?.map((row) => row.role) ?? [];
  if (roles.length !== 1 || roles[0] !== "customer") {
    throw new Error("customer_role_not_exclusive");
  }
}

async function verifyCreatedCustomer(supabaseAdmin: SupabaseAdminLike, userId: string) {
  await requireCustomerProfile(supabaseAdmin, userId);
  await requireOnlyCustomerRole(supabaseAdmin, userId);
}

export async function createConfirmedCustomerUser(
  supabaseAdmin: SupabaseAdminLike,
  data: CustomerSignupData,
  ip = "unknown",
) {
  await assertCustomerSignupRateLimit(supabaseAdmin, data.email, ip);

  const metadata = buildCustomerSignupMetadata(data);
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    ...metadata,
  });

  if (error || !created?.user) {
    if (isDuplicateAuthUserError(error)) {
      throw new Error("Já existe uma conta cadastrada com este e-mail.");
    }
    throw new Error(error?.message ?? "Não foi possível criar sua conta. Tente novamente.");
  }

  const userId = created.user.id;
  try {
    await verifyCreatedCustomer(supabaseAdmin, userId);
  } catch (verificationError) {
    await rollbackCreatedUser(supabaseAdmin, userId, "verify_customer_signup", verificationError);
    throw new Error("Não foi possível concluir seu cadastro. Tente novamente.");
  }

  return { userId };
}

export const createCustomerAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => customerSignupSchema.parse(d))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return createConfirmedCustomerUser(
      supabaseAdmin as unknown as SupabaseAdminLike,
      data,
      getRequestIpFromHeaders(getRequest()),
    );
  });
