// Loyalty client-safe server functions.
// Reutiliza inteiramente o Loyalty Domain (customer_loyalty, loyalty_transactions,
// loyalty_levels, loyalty_settings em restaurants, RPCs loyalty_reserve/commit/rollback).
// NÃO duplica lógica: apenas expõe leitura + configurações + reserva para o UI.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------------- Types compartilhados com o UI -------------

export type LoyaltySettings = {
  active: boolean;
  points_per_real: number;
  min_order: number;
  min_redeem: number;
  max_discount_percent: number;
  validity_days: number;
  earn_on: "paid" | "delivered";
};

export type LoyaltyLevelInfo = {
  name: string;
  minimum_points: number;
  active: boolean;
  benefits: unknown;
};

export type LoyaltySummary = {
  active: boolean;
  balance: number;
  lifetime: number;
  level: string | null;
  nextLevel: { name: string; minimum_points: number; remaining: number } | null;
  progress: number; // 0..1 dentro do nível atual → próximo
  settings: LoyaltySettings;
  restaurantId: string;
  restaurantName: string;
};

export type LoyaltyTransaction = {
  id: string;
  createdAt: string;
  type: string; // EARN | REDEEM | ADJUSTMENT | EXPIRE | BONUS
  source: string | null;
  points: number;
  balance_after: number | null;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
};

export type LoyaltyRestaurantStats = {
  participatingCustomers: number;
  pointsIssued: number;
  pointsRedeemed: number;
  pointsExpired: number;
  discountsGiven: number; // R$
  avgTicketWithLoyalty: number;
};

export type LoyaltyExpiringInfo = {
  totalExpiring: number;
  next: { points: number; days: number; expireAt: string } | null;
  buckets: Array<{ days: number; points: number; expireAt: string }>;
};

export type LoyaltyAnalytics = {
  activeCustomers: number;         // clientes com saldo > 0
  neverRedeemed: number;           // clientes com saldo mas sem REDEEM
  expiringSoonCustomers: number;   // com evento PointsExpiring aberto
  expirationRate: number;          // 0..1: expirados / emitidos
  utilizationRate: number;         // 0..1: resgatados / emitidos
};

// ------------- Helpers -------------

function normalizeSettings(raw: unknown): LoyaltySettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    active: Boolean(s.active ?? false),
    points_per_real: Number(s.points_per_real ?? 1) || 1,
    min_order: Number(s.min_order ?? 0) || 0,
    min_redeem: Number(s.min_redeem ?? 100) || 100,
    max_discount_percent: Number(s.max_discount_percent ?? 30) || 30,
    validity_days: Number(s.validity_days ?? 365) || 365,
    earn_on: (s.earn_on === "delivered" ? "delivered" : "paid") as "paid" | "delivered",
  };
}

async function findRestaurantBySlug(slug: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, loyalty_settings")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

async function findCustomerIdByAuth(userId: string, restaurantId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Estratégia: usa customer_profiles → phone → customers(restaurant_id, phone)
  const { data: profile } = await supabaseAdmin
    .from("customer_profiles")
    .select("phone, email")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.phone) return null;
  const digits = profile.phone.replace(/\D/g, "");
  if (!digits) return null;
  const { data: match } = await supabaseAdmin
    .from("customers")
    .select("id, phone")
    .eq("restaurant_id", restaurantId);
  const found = (match ?? []).find((c: any) => (c.phone || "").replace(/\D/g, "") === digits);
  return found?.id ?? null;
}

// ------------- Customer: resumo de fidelidade num restaurante -------------

export const getMyLoyaltyForRestaurant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<LoyaltySummary | null> => {
    const rest = await findRestaurantBySlug(data.slug);
    if (!rest) return null;
    const settings = normalizeSettings(rest.loyalty_settings);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const customerId = await findCustomerIdByAuth(context.userId, rest.id);
    let balance = 0;
    let lifetime = 0;
    if (customerId) {
      const { data: cl } = await supabaseAdmin
        .from("customer_loyalty")
        .select("points_balance, lifetime_points")
        .eq("customer_id", customerId)
        .eq("restaurant_id", rest.id)
        .maybeSingle();
      balance = Number(cl?.points_balance ?? 0);
      lifetime = Number(cl?.lifetime_points ?? 0);
    }

    const { data: levels } = await supabaseAdmin
      .from("loyalty_levels")
      .select("name, minimum_points, active")
      .eq("restaurant_id", rest.id)
      .eq("active", true)
      .order("minimum_points", { ascending: true });

    const list = (levels ?? []) as Array<{ name: string; minimum_points: number }>;
    let currentLvl: { name: string; minimum_points: number } | null = null;
    let nextLvl: { name: string; minimum_points: number } | null = null;
    for (const l of list) {
      if (lifetime >= l.minimum_points) currentLvl = l;
      else { nextLvl = l; break; }
    }
    const base = currentLvl?.minimum_points ?? 0;
    const target = nextLvl?.minimum_points ?? base;
    const progress = target > base ? Math.min(1, (lifetime - base) / (target - base)) : 1;

    return {
      active: settings.active,
      balance,
      lifetime,
      level: currentLvl?.name ?? null,
      nextLevel: nextLvl ? { name: nextLvl.name, minimum_points: nextLvl.minimum_points, remaining: Math.max(0, nextLvl.minimum_points - lifetime) } : null,
      progress,
      settings,
      restaurantId: rest.id,
      restaurantName: rest.name,
    };
  });

// ------------- Customer: cotação de resgate (sem reservar) -------------

export const quoteLoyaltyRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().min(1),
      subtotal: z.number().nonnegative(),
      points: z.number().int().nonnegative().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const rest = await findRestaurantBySlug(data.slug);
    if (!rest) return { points: 0, discount: 0, balance: 0, maxPoints: 0, minRedeem: 100, active: false };
    const s = normalizeSettings(rest.loyalty_settings);
    if (!s.active) return { points: 0, discount: 0, balance: 0, maxPoints: 0, minRedeem: s.min_redeem, active: false };

    const customerId = await findCustomerIdByAuth(context.userId, rest.id);
    if (!customerId) return { points: 0, discount: 0, balance: 0, maxPoints: 0, minRedeem: s.min_redeem, active: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cl } = await supabaseAdmin
      .from("customer_loyalty").select("points_balance")
      .eq("customer_id", customerId).eq("restaurant_id", rest.id).maybeSingle();
    const balance = Number(cl?.points_balance ?? 0);
    const cap = Math.floor(data.subtotal * (s.max_discount_percent / 100) * s.points_per_real);
    const maxPoints = Math.max(0, Math.min(balance, cap));
    const requested = Math.max(0, Math.min(Math.floor(data.points ?? maxPoints), maxPoints));
    const points = requested >= s.min_redeem ? requested : 0;
    const discount = Math.round((points / s.points_per_real) * 100) / 100;
    return { points, discount, balance, maxPoints, minRedeem: s.min_redeem, active: true };
  });

// ------------- Customer: histórico -------------

export const getMyLoyaltyHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().optional(),
      filter: z.enum(["all", "earn", "redeem", "expire", "bonus"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<LoyaltyTransaction[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let restaurantId: string | null = null;
    if (data.slug) {
      const r = await findRestaurantBySlug(data.slug);
      restaurantId = r?.id ?? null;
      if (!restaurantId) return [];
    }
    let customerId: string | null = null;
    if (restaurantId) {
      customerId = await findCustomerIdByAuth(context.userId, restaurantId);
      if (!customerId) return [];
    }

    let q = supabaseAdmin
      .from("loyalty_transactions")
      .select("id, created_at, transaction_type, source, points, balance_after, description, reference_type, reference_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (restaurantId) q = q.eq("restaurant_id", restaurantId);
    if (customerId) q = q.eq("customer_id", customerId);
    if (data.filter && data.filter !== "all") {
      const map: Record<string, string> = { earn: "EARN", redeem: "REDEEM", expire: "EXPIRE", bonus: "BONUS" };
      q = q.eq("transaction_type", map[data.filter]);
    }
    const { data: rows } = await q;
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id, createdAt: r.created_at, type: r.transaction_type, source: r.source,
      points: r.points, balance_after: r.balance_after, description: r.description,
      reference_type: r.reference_type, reference_id: r.reference_id,
    }));
  });

// ------------- Restaurante: configurações -------------

async function ensureOwner(userId: string, restaurantId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("restaurants").select("owner_id").eq("id", restaurantId).maybeSingle();
  if (!data || data.owner_id !== userId) throw new Error("Sem permissão");
}

export const getRestaurantLoyaltySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LoyaltySettings> => {
    await ensureOwner(context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rest } = await supabaseAdmin.from("restaurants").select("loyalty_settings").eq("id", data.restaurantId).maybeSingle();
    return normalizeSettings(rest?.loyalty_settings);
  });

export const saveRestaurantLoyaltySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      restaurantId: z.string().uuid(),
      settings: z.object({
        active: z.boolean(),
        points_per_real: z.number().min(0.01).max(100),
        min_order: z.number().min(0),
        min_redeem: z.number().int().min(1),
        max_discount_percent: z.number().min(1).max(100),
        validity_days: z.number().int().min(30).max(3650),
        earn_on: z.enum(["paid", "delivered"]),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOwner(context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ loyalty_settings: data.settings as any })
      .eq("id", data.restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------- Restaurante: estatísticas -------------

export const getRestaurantLoyaltyStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LoyaltyRestaurantStats> => {
    await ensureOwner(context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cl }, { data: tx }, { data: ord }] = await Promise.all([
      supabaseAdmin.from("customer_loyalty").select("customer_id, points_balance").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("loyalty_transactions").select("transaction_type, points").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("orders").select("total, loyalty_discount").eq("restaurant_id", data.restaurantId).gt("loyalty_discount", 0),
    ]);
    const rows = (tx ?? []) as Array<{ transaction_type: string; points: number }>;
    const pointsIssued = rows.filter((r) => r.transaction_type === "EARN").reduce((s, r) => s + r.points, 0);
    const pointsRedeemed = -rows.filter((r) => r.transaction_type === "REDEEM").reduce((s, r) => s + r.points, 0);
    const pointsExpired = -rows.filter((r) => r.transaction_type === "EXPIRE").reduce((s, r) => s + r.points, 0);
    const orderRows = (ord ?? []) as Array<{ total: number; loyalty_discount: number | null }>;
    const discountsGiven = orderRows.reduce((s, r) => s + Number(r.loyalty_discount ?? 0), 0);
    const avg = orderRows.length ? orderRows.reduce((s, r) => s + Number(r.total ?? 0), 0) / orderRows.length : 0;
    return {
      participatingCustomers: (cl ?? []).filter((c: any) => (c.points_balance ?? 0) > 0).length,
      pointsIssued, pointsRedeemed, pointsExpired,
      discountsGiven: Math.round(discountsGiven * 100) / 100,
      avgTicketWithLoyalty: Math.round(avg * 100) / 100,
    };
  });

// ------------- Aplicar resgate a pedido já criado -------------

export const applyLoyaltyReserveForOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orderId: z.string().uuid(), points: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders").select("id, restaurant_id, customer_phone, loyalty_points_reserved")
      .eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    if ((order.loyalty_points_reserved ?? 0) > 0) return { ok: true, alreadyReserved: true };

    const customerId = await findCustomerIdByAuth(context.userId, order.restaurant_id);
    if (!customerId) throw new Error("Cadastro do cliente incompleto");

    const { data: rpc, error } = await supabaseAdmin.rpc("loyalty_reserve", {
      _order_id: order.id,
      _customer_id: customerId,
      _restaurant_id: order.restaurant_id,
      _points: data.points,
    });
    if (error) throw new Error(error.message);
    return { ok: true, txId: rpc as string | null };
  });

// ------------- Customer: pontos expirando -------------

export const getMyExpiringPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<LoyaltyExpiringInfo> => {
    const empty: LoyaltyExpiringInfo = { totalExpiring: 0, next: null, buckets: [] };
    const rest = await findRestaurantBySlug(data.slug);
    if (!rest) return empty;
    const settings = normalizeSettings(rest.loyalty_settings);
    if (!settings.active) return empty;
    const customerId = await findCustomerIdByAuth(context.userId, rest.id);
    if (!customerId) return empty;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowMs = Date.now();
    const horizonMs = nowMs + 30 * 86400_000;
    const { data: rows } = await supabaseAdmin
      .from("loyalty_transactions")
      .select("points, created_at")
      .eq("customer_id", customerId)
      .eq("restaurant_id", rest.id)
      .eq("transaction_type", "EARN");
    const days = settings.validity_days;
    const buckets = new Map<number, { days: number; points: number; expireAt: string }>();
    for (const r of (rows ?? []) as Array<{ points: number; created_at: string }>) {
      const exp = new Date(r.created_at).getTime() + days * 86400_000;
      if (exp <= nowMs || exp > horizonMs) continue;
      const remaining = Math.max(1, Math.ceil((exp - nowMs) / 86400_000));
      const bucket = remaining <= 1 ? 1 : remaining <= 7 ? 7 : 30;
      const cur = buckets.get(bucket) ?? { days: bucket, points: 0, expireAt: new Date(exp).toISOString() };
      cur.points += r.points;
      if (new Date(cur.expireAt).getTime() > exp) cur.expireAt = new Date(exp).toISOString();
      buckets.set(bucket, cur);
    }
    const list = Array.from(buckets.values()).sort((a, b) => a.days - b.days);
    const totalExpiring = list.reduce((s, b) => s + b.points, 0);
    return { totalExpiring, next: list[0] ?? null, buckets: list };
  });

// ------------- Restaurante: analytics avançadas -------------

export const getRestaurantLoyaltyAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LoyaltyAnalytics> => {
    await ensureOwner(context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cl }, { data: tx }, { data: ev }] = await Promise.all([
      supabaseAdmin.from("customer_loyalty").select("customer_id, points_balance").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("loyalty_transactions").select("customer_id, transaction_type, points").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("loyalty_events").select("customer_id, event_type").eq("restaurant_id", data.restaurantId).eq("event_type", "PointsExpiring"),
    ]);
    const balances = (cl ?? []) as Array<{ customer_id: string; points_balance: number }>;
    const activeCustomers = balances.filter((c) => (c.points_balance ?? 0) > 0).length;
    const txs = (tx ?? []) as Array<{ customer_id: string; transaction_type: string; points: number }>;
    const redeemersSet = new Set(txs.filter((t) => t.transaction_type === "REDEEM").map((t) => t.customer_id));
    const neverRedeemed = balances.filter((c) => (c.points_balance ?? 0) > 0 && !redeemersSet.has(c.customer_id)).length;
    const issued = txs.filter((t) => t.transaction_type === "EARN").reduce((s, t) => s + t.points, 0);
    const redeemed = -txs.filter((t) => t.transaction_type === "REDEEM").reduce((s, t) => s + t.points, 0);
    const expired = -txs.filter((t) => t.transaction_type === "EXPIRE").reduce((s, t) => s + t.points, 0);
    const expiringSoonCustomers = new Set(((ev ?? []) as Array<{ customer_id: string }>).map((e) => e.customer_id)).size;
    return {
      activeCustomers,
      neverRedeemed,
      expiringSoonCustomers,
      expirationRate: issued > 0 ? Math.round((expired / issued) * 1000) / 1000 : 0,
      utilizationRate: issued > 0 ? Math.round((redeemed / issued) * 1000) / 1000 : 0,
    };
  });

// ------------- Customer: recompensas por nível -------------

export type RestaurantRewardLevel = {
  name: string;
  minimum_points: number;
  benefits: string[];
  reached: boolean;
};

export const getRestaurantRewards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<RestaurantRewardLevel[]> => {
    const rest = await findRestaurantBySlug(data.slug);
    if (!rest) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const customerId = await findCustomerIdByAuth(context.userId, rest.id);
    let lifetime = 0;
    if (customerId) {
      const { data: cl } = await supabaseAdmin
        .from("customer_loyalty").select("lifetime_points")
        .eq("customer_id", customerId).eq("restaurant_id", rest.id).maybeSingle();
      lifetime = Number(cl?.lifetime_points ?? 0);
    }
    const { data: levels } = await supabaseAdmin
      .from("loyalty_levels")
      .select("name, minimum_points, benefits, active")
      .eq("restaurant_id", rest.id)
      .eq("active", true)
      .order("minimum_points", { ascending: true });
    return ((levels ?? []) as any[]).map((l) => {
      const b = l.benefits;
      const list: string[] = Array.isArray(b)
        ? b.map((x) => String(x))
        : typeof b === "string"
          ? [b]
          : b && typeof b === "object"
            ? Object.values(b as Record<string, unknown>).map((x) => String(x))
            : [];
      return {
        name: String(l.name),
        minimum_points: Number(l.minimum_points ?? 0),
        benefits: list,
        reached: lifetime >= Number(l.minimum_points ?? 0),
      };
    });
  });

// ------------- Customer: cupons ativos do restaurante -------------

export type RestaurantCouponInfo = {
  id: string;
  code: string;
  discount_percent: number;
  valid_until: string | null;
};

export const getRestaurantCoupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<RestaurantCouponInfo[]> => {
    const rest = await findRestaurantBySlug(data.slug);
    if (!rest) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("coupons")
      .select("id, code, discount_percent, valid_until, is_active")
      .eq("restaurant_id", rest.id)
      .eq("is_active", true)
      .order("valid_until", { ascending: true });
    return ((rows ?? []) as any[])
      .filter((c) => !c.valid_until || String(c.valid_until).slice(0, 10) >= today)
      .map((c) => ({
        id: c.id,
        code: c.code,
        discount_percent: Number(c.discount_percent ?? 0),
        valid_until: c.valid_until ?? null,
      }));
  });

// ------------- Customer: benefícios em andamento (loyalty_rules) -------------

export type InProgressBenefit = {
  id: string;
  name: string;
  ui_kind: string | null;
  trigger_kind: "POINTS" | "ORDERS" | "PRODUCTS" | "SPENT" | string;
  trigger_qty: number;
  trigger_product_name: string | null;
  reward_label: string;
  progress: number;
  target: number;
  unit: "pts" | "pedidos" | "produtos" | "R$";
  remaining: number;
  ratio: number;
  unlocked: boolean;
};

function describeRewardFromConfig(cfg: any): string {
  const r = cfg?.reward ?? {};
  const k = cfg?.ui_kind;
  if (k === "FREE_PRODUCT") return `Ganhe 1 ${r.product_name || "produto"}`;
  if (k === "DISCOUNT") return `${r.discount_percent ?? 0}% de desconto`;
  if (k === "FREE_DELIVERY") return "Frete grátis";
  if (k === "CASHBACK") return `R$ ${Number(r.cashback_amount || 0).toFixed(2)} de cashback`;
  if (k === "COUPON") return `Cupom ${r.coupon_code || ""}`.trim();
  if (k === "GIFT") return `Brinde: ${r.gift_note || "cortesia"}`;
  return "Recompensa";
}

export const getMyInProgressBenefits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<InProgressBenefit[]> => {
    const rest = await findRestaurantBySlug(data.slug);
    if (!rest) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: rules }, customerId] = await Promise.all([
      supabaseAdmin
        .from("loyalty_rules")
        .select("id, name, config, active")
        .eq("restaurant_id", rest.id)
        .eq("active", true),
      findCustomerIdByAuth(context.userId, rest.id),
    ]);
    const activeRules = (rules ?? []) as Array<{ id: string; name: string; config: any }>;
    if (activeRules.length === 0) return [];

    let lifetime = 0;
    let orderCount = 0;
    let totalSpent = 0;
    const productCounts = new Map<string, number>();

    if (customerId) {
      const [{ data: cl }, { data: orders }] = await Promise.all([
        supabaseAdmin
          .from("customer_loyalty")
          .select("lifetime_points")
          .eq("customer_id", customerId).eq("restaurant_id", rest.id).maybeSingle(),
        supabaseAdmin
          .from("orders")
          .select("total, items, status")
          .eq("restaurant_id", rest.id)
          .eq("customer_id", customerId)
          .not("status", "eq", "cancelado"),
      ]);
      lifetime = Number(cl?.lifetime_points ?? 0);
      const os = (orders ?? []) as Array<{ total: number; items: any; status: string }>;
      orderCount = os.length;
      for (const o of os) {
        totalSpent += Number(o.total ?? 0);
        const items = Array.isArray(o.items) ? o.items : [];
        for (const it of items) {
          const name = String(it?.name ?? "").toLowerCase().trim();
          if (!name) continue;
          const qty = Number(it?.qty ?? it?.quantity ?? 1);
          productCounts.set(name, (productCounts.get(name) ?? 0) + qty);
        }
      }
    }

    return activeRules
      .map((r): InProgressBenefit | null => {
        const cfg = r.config ?? {};
        const trig = cfg.trigger ?? {};
        const kind = String(trig.kind ?? "").toUpperCase();
        const target = Number(trig.qty ?? 0);
        if (!kind || target <= 0) return null;

        let progress = 0;
        let unit: InProgressBenefit["unit"] = "pts";
        let productName: string | null = null;

        if (kind === "POINTS") { progress = lifetime; unit = "pts"; }
        else if (kind === "ORDERS") { progress = orderCount; unit = "pedidos"; }
        else if (kind === "SPENT") { progress = totalSpent; unit = "R$"; }
        else if (kind === "PRODUCTS") {
          productName = String(trig.product_name ?? "").trim() || null;
          if (productName) {
            const key = productName.toLowerCase();
            let sum = 0;
            for (const [n, q] of productCounts) if (n.includes(key)) sum += q;
            progress = sum;
          } else {
            let sum = 0;
            for (const q of productCounts.values()) sum += q;
            progress = sum;
          }
          unit = "produtos";
        } else {
          return null;
        }

        return {
          id: r.id,
          name: r.name,
          ui_kind: cfg.ui_kind ?? null,
          trigger_kind: kind as any,
          trigger_qty: target,
          trigger_product_name: productName,
          reward_label: describeRewardFromConfig(cfg),
          progress: Math.min(progress, target),
          target,
          unit,
          remaining: Math.max(0, target - progress),
          ratio: target > 0 ? Math.min(1, progress / target) : 0,
          unlocked: progress >= target,
        };
      })
      .filter((x): x is InProgressBenefit => !!x)
      .sort((a, b) => b.ratio - a.ratio);
  });
