type RecoveryAuthClient = {
  verifyOtp: (params: { token_hash: string; type: "recovery" }) => Promise<{
    data?: { session?: unknown | null } | null;
    error?: { message?: string; code?: string; status?: number } | null;
  }>;
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{
    error?: { message?: string; code?: string; status?: number } | null;
  }>;
  getSession: () => Promise<{
    data?: { session?: unknown | null } | null;
    error?: { message?: string; code?: string; status?: number } | null;
  }>;
};

export type DriverRecoveryValidationResult =
  | { ok: true; mode: "token_hash" | "legacy_tokens" }
  | { ok: false; reason: "invalid_or_expired"; code?: string; message?: string };

export function readDriverRecoveryParams(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;
  const get = (name: string) => query.get(name) ?? hash.get(name);

  return {
    tokenHash: get("token_hash"),
    type: get("type"),
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    error: get("error"),
    errorCode: get("error_code"),
    errorDescription: get("error_description"),
  };
}

export function hasDriverRecoveryParams(href: string) {
  const params = readDriverRecoveryParams(href);
  return Boolean(
    params.tokenHash ||
    params.accessToken ||
    params.refreshToken ||
    params.error ||
    params.errorCode ||
    params.errorDescription,
  );
}

export async function validateDriverRecoveryLink(
  auth: RecoveryAuthClient,
  href: string,
): Promise<DriverRecoveryValidationResult> {
  const params = readDriverRecoveryParams(href);

  if (params.error || params.errorCode || params.errorDescription) {
    return {
      ok: false,
      reason: "invalid_or_expired",
      code: params.errorCode ?? params.error ?? undefined,
      message: params.errorDescription ?? undefined,
    };
  }

  if (params.tokenHash) {
    if (params.type !== "recovery") return { ok: false, reason: "invalid_or_expired" };
    const { error } = await auth.verifyOtp({ token_hash: params.tokenHash, type: "recovery" });
    if (error) {
      return {
        ok: false,
        reason: "invalid_or_expired",
        code: error.code,
        message: error.message,
      };
    }
    return { ok: true, mode: "token_hash" };
  }

  if (params.accessToken && params.refreshToken) {
    const { error: sessionError } = await auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (sessionError) {
      return {
        ok: false,
        reason: "invalid_or_expired",
        code: sessionError.code,
        message: sessionError.message,
      };
    }

    const { data, error } = await auth.getSession();
    if (error || !data?.session) {
      return {
        ok: false,
        reason: "invalid_or_expired",
        code: error?.code,
        message: error?.message,
      };
    }
    return { ok: true, mode: "legacy_tokens" };
  }

  return { ok: false, reason: "invalid_or_expired" };
}
