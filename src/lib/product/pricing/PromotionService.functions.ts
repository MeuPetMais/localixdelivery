// Server functions para CRUD de promoções.
// RLS já garante isolamento por restaurant_id (owner_id).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Promotion, PromotionStatus } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export const listPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { restaurant_id: string; status?: PromotionStatus }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("promotions" as any)
      .select("*, rules:promotion_rules(*), targets:promotion_targets(*)")
      .eq("restaurant_id", data.restaurant_id)
      .order("priority", { ascending: true });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as Promotion[];
  });

export const createPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<Promotion> & { restaurant_id: string; name: string; discount_type: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("promotions" as any)
      .insert({
        restaurant_id: data.restaurant_id,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? "DRAFT",
        priority: data.priority ?? 100,
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        discount_type: data.discount_type,
        discount_value: data.discount_value ?? 0,
        stackable: data.stackable ?? false,
        code: data.code ?? null,
        channel: data.channel ?? null,
        max_uses: data.max_uses ?? null,
        max_uses_per_customer: data.max_uses_per_customer ?? null,
        config: data.config ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updatePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Partial<Promotion> }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("promotions" as any)
      .update(data.patch as any)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const transitionPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: PromotionStatus }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("promotions" as any)
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("promotions" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertPromotionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; promotion_id: string; rule_type: string; operator?: string; value: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const payload = {
      promotion_id: data.promotion_id,
      rule_type: data.rule_type,
      operator: data.operator ?? "eq",
      value: data.value,
    };
    const q = data.id
      ? context.supabase.from("promotion_rules" as any).update(payload).eq("id", data.id)
      : context.supabase.from("promotion_rules" as any).insert(payload);
    const { data: row, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertPromotionTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; promotion_id: string; target_type: string; target_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const payload = {
      promotion_id: data.promotion_id,
      target_type: data.target_type,
      target_id: data.target_id ?? null,
    };
    const q = data.id
      ? context.supabase.from("promotion_targets" as any).update(payload).eq("id", data.id)
      : context.supabase.from("promotion_targets" as any).insert(payload);
    const { data: row, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const recordPromotionUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { promotion_id: string; restaurant_id: string; discount_amount: number; customer_id?: string | null; order_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("promotion_usage" as any)
      .insert({
        promotion_id: data.promotion_id,
        restaurant_id: data.restaurant_id,
        customer_id: data.customer_id ?? null,
        order_id: data.order_id ?? null,
        discount_amount: data.discount_amount,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
