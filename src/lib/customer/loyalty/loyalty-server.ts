// Loyalty server helpers — thin wrappers around DB RPCs.
// Reservation/commit/rollback flow for redemption during checkout.
// Not client-safe: importado apenas por server functions / server routes.

type SupabaseAdmin = Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")["supabaseAdmin"] extends infer T ? never : never>> extends never ? any : any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export interface RedemptionQuote {
  points: number;
  discount: number;      // R$
  pointsPerReal: number; // 1 / rate → cada quantos pontos = 1 real
  maxByCap: number;      // limite pelo teto (max_discount_percent)
  maxByBalance: number;  // limite pelo saldo
}

/** Cotação de resgate. Retorna quantos pontos podem ser aplicados e o desconto. */
export async function quoteRedemption(params: {
  customerId: string;
  restaurantId: string;
  subtotal: number;
  requestedPoints?: number;
}): Promise<RedemptionQuote> {
  const sb = await admin();
  const [{ data: rest }, { data: bal }] = await Promise.all([
    sb.from("restaurants").select("loyalty_settings").eq("id", params.restaurantId).maybeSingle(),
    sb.from("customer_loyalty")
      .select("points_balance")
      .eq("customer_id", params.customerId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle(),
  ]);
  const s = (rest?.loyalty_settings ?? {}) as Record<string, unknown>;
  const active = Boolean(s.active);
  const pointsPerReal = Number(s.points_per_real ?? 1) || 1;
  const minRedeem = Number(s.min_redeem ?? 100) || 100;
  const maxPct = Number(s.max_discount_percent ?? 30) / 100;
  const balance = Number(bal?.points_balance ?? 0) || 0;

  if (!active) return { points: 0, discount: 0, pointsPerReal, maxByCap: 0, maxByBalance: balance };
  const maxByCap = Math.floor(params.subtotal * maxPct * pointsPerReal);
  const requested = Math.max(0, Math.floor(params.requestedPoints ?? Math.min(balance, maxByCap)));
  const points = Math.min(requested, balance, maxByCap);
  if (points < minRedeem) return { points: 0, discount: 0, pointsPerReal, maxByCap, maxByBalance: balance };
  const discount = Math.round((points / pointsPerReal) * 100) / 100;
  return { points, discount, pointsPerReal, maxByCap, maxByBalance: balance };
}

/** Reserva pontos para o pedido. Idempotente por (order_id, source='reserve'). */
export async function reserveForOrder(params: {
  orderId: string;
  customerId: string;
  restaurantId: string;
  points: number;
}): Promise<{ ok: true; txId: string | null } | { ok: false; error: string }> {
  if (params.points <= 0) return { ok: true, txId: null };
  const sb = await admin();
  const { data, error } = await sb.rpc("loyalty_reserve", {
    _order_id: params.orderId,
    _customer_id: params.customerId,
    _restaurant_id: params.restaurantId,
    _points: params.points,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, txId: (data as string) ?? null };
}

/** Confirma a reserva ao aprovar pagamento. */
export async function commitReserve(orderId: string) {
  const sb = await admin();
  const { error } = await sb.rpc("loyalty_commit_reserve", { _order_id: orderId });
  if (error) throw new Error(error.message);
}

/** Devolve os pontos reservados ao saldo (cancelamento / falha). */
export async function rollbackReserve(orderId: string) {
  const sb = await admin();
  const { error } = await sb.rpc("loyalty_rollback_reserve", { _order_id: orderId });
  if (error) throw new Error(error.message);
}
