import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Same shape as requireSupabaseAuth, but does not throw when no bearer token is present.
 * context.userId is null for guest sessions, and context.supabase is a publishable-key client
 * (respects RLS as the authenticated user when a token is provided, else as anon).
 */
export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

    const req = getRequest();
    const authHeader = req?.headers.get("authorization") ?? "";
    const token =
      authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    let userId: string | null = null;

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    if (token && token.split(".").length === 3) {
      try {
        const { data, error } = await supabase.auth.getClaims(token);
        if (!error && data?.claims?.sub) {
          userId = data.claims.sub as string;
        }
      } catch {
        userId = null;
      }
    }

    return next({ context: { supabase, userId } });
  },
);
