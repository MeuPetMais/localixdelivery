// Server functions de leitura para o painel administrativo de webhooks.
// Somente admins podem consultar (RLS já limita; middleware garante caller).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WebhookEventRow {
  id: string;
  provider: string;
  event_id: string | null;
  event_type: string | null;
  action: string | null;
  resource_id: string | null;
  external_reference: string | null;
  processed: boolean;
  processed_at: string | null;
  processing_attempts: number;
  error_message: string | null;
  created_at: string;
}

export interface WebhookStats {
  total: number;
  processed: number;
  pending: number;
  errored: number;
  last24h: number;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("payment_webhook_events")
      .select("id, provider, event_id, event_type, action, resource_id, external_reference, processed, processed_at, processing_attempts, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as WebhookEventRow[];
  });

export const getWebhookStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WebhookStats> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: total }, { count: processed }, { count: pending }, { count: errored }, { count: last24h }] =
      await Promise.all([
        sb.from("payment_webhook_events").select("*", { count: "exact", head: true }),
        sb.from("payment_webhook_events").select("*", { count: "exact", head: true }).eq("processed", true),
        sb.from("payment_webhook_events").select("*", { count: "exact", head: true }).eq("processed", false).is("error_message", null),
        sb.from("payment_webhook_events").select("*", { count: "exact", head: true }).eq("processed", false).not("error_message", "is", null),
        sb.from("payment_webhook_events").select("*", { count: "exact", head: true }).gte("created_at", since),
      ]);
    return {
      total: total ?? 0,
      processed: processed ?? 0,
      pending: pending ?? 0,
      errored: errored ?? 0,
      last24h: last24h ?? 0,
    };
  });
