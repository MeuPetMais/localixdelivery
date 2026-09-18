type SupabaseLike = {
  // The deployed Supabase client has several distinct fluent query return types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type ResolveTokenOptions = {
  restaurantId: string | null;
  webhookUserId: unknown;
  decryptToken: (encrypted: string) => Promise<string | null>;
  fallbackAccessToken?: string | null;
};

type TokenResolution =
  | {
      ok: true;
      token: string;
      restaurantId: string | null;
      source: "restaurant_id" | "mp_user_id" | "fallback";
    }
  | { ok: false; token: null; restaurantId: string | null; reason: string };

export function normalizeMpUserId(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

async function decryptAccountToken(
  encrypted: string | null | undefined,
  decryptToken: (encrypted: string) => Promise<string | null>,
): Promise<string | null> {
  if (!encrypted) return null;
  try {
    return await decryptToken(encrypted);
  } catch {
    return null;
  }
}

export async function resolveMercadoPagoWebhookToken(
  sb: SupabaseLike,
  opts: ResolveTokenOptions,
): Promise<TokenResolution> {
  if (opts.restaurantId) {
    const { data } = await sb
      .from("mercado_pago_accounts")
      .select("access_token, connected")
      .eq("restaurant_id", opts.restaurantId)
      .maybeSingle();

    if (data?.connected && data.access_token) {
      const token = await decryptAccountToken(data.access_token, opts.decryptToken);
      if (token) {
        return { ok: true, token, restaurantId: opts.restaurantId, source: "restaurant_id" };
      }
    }

    if (opts.fallbackAccessToken) {
      return {
        ok: true,
        token: opts.fallbackAccessToken,
        restaurantId: opts.restaurantId,
        source: "fallback",
      };
    }

    return { ok: false, token: null, restaurantId: opts.restaurantId, reason: "no_access_token" };
  }

  const mpUserId = normalizeMpUserId(opts.webhookUserId);
  if (!mpUserId) {
    return { ok: false, token: null, restaurantId: null, reason: "missing_mp_user_id" };
  }

  const { data, error } = await sb
    .from("mercado_pago_accounts")
    .select("restaurant_id, access_token, connected")
    .eq("mp_user_id", mpUserId)
    .eq("connected", true)
    .not("access_token", "is", null)
    .limit(2);

  if (error) {
    return {
      ok: false,
      token: null,
      restaurantId: null,
      reason: `mp_user_lookup:${error.message}`,
    };
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== 1) {
    return {
      ok: false,
      token: null,
      restaurantId: null,
      reason: rows.length === 0 ? "mp_user_account_not_found" : "mp_user_account_ambiguous",
    };
  }

  const row = rows[0];
  const token = await decryptAccountToken(row.access_token, opts.decryptToken);
  if (!token) {
    return {
      ok: false,
      token: null,
      restaurantId: row.restaurant_id ?? null,
      reason: "no_access_token",
    };
  }

  return { ok: true, token, restaurantId: row.restaurant_id ?? null, source: "mp_user_id" };
}
