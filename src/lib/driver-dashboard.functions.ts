// RC5.2.c — Driver Wallet Experience
// Server functions expostas ao próprio motoboy autenticado.
// Consolidam presença, posição na fila, entrega atual, ganhos e ranking.
// NUNCA aceitam driverId externo: derivam sempre de owner_id = context.userId.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DELIVERY_FEE_BRL = 8; // ganho por entrega (provisório — RC5.3 lê da política)
const DELIVERY_KM_BONUS = 1.5;

function startOfLocalDayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // segunda como início
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function computeEarnings(rows: Array<{ distance_km: number | null }>): number {
  return rows.reduce(
    (sum, r) => sum + DELIVERY_FEE_BRL + DELIVERY_KM_BONUS * (r.distance_km ?? 0),
    0,
  );
}

export const getDriverDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: driver } = await supabase
      .from("delivery_drivers")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!driver) return null;

    const startDay = startOfLocalDayISO();
    const startWeek = startOfWeekISO();

    // Entrega ativa (não terminal)
    const { data: activeRows } = await supabase
      .from("delivery_assignments")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["PENDENTE", "ATRIBUIDO", "COLETANDO", "EM_ROTA"])
      .order("created_at", { ascending: false })
      .limit(1);
    const active = activeRows?.[0] ?? null;

    let activeOrder: any = null;
    if (active) {
      const { data: ord } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, delivery_address, total, subtotal")
        .eq("id", active.order_id)
        .maybeSingle();
      activeOrder = ord ?? null;
    }

    // Entregas do dia
    const { data: today } = await supabase
      .from("delivery_assignments")
      .select("id, distance_km, delivered_at")
      .eq("driver_id", driver.id)
      .eq("status", "ENTREGUE")
      .gte("delivered_at", startDay);

    // Entregas da semana
    const { data: week } = await supabase
      .from("delivery_assignments")
      .select("id, distance_km, delivered_at")
      .eq("driver_id", driver.id)
      .eq("status", "ENTREGUE")
      .gte("delivered_at", startWeek);

    // Histórico recente
    const { data: history } = await supabase
      .from("delivery_assignments")
      .select("id, status, delivered_at, distance_km, order_id, created_at")
      .eq("driver_id", driver.id)
      .in("status", ["ENTREGUE", "CANCELADO"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Fila
    const { data: queueRows } = await supabase
      .from("delivery_queue")
      .select("driver_id, position, status")
      .eq("restaurant_id", driver.restaurant_id)
      .eq("status", "AGUARDANDO")
      .order("position", { ascending: true });

    const myEntry = queueRows?.find((q) => q.driver_id === driver.id);
    const queueLength = queueRows?.length ?? 0;
    const myPosition = myEntry?.position ?? null;

    // Ranking simples: contagem de entregues no dia por motoboy do restaurante
    const { data: rankingRows } = await supabase
      .from("delivery_assignments")
      .select("driver_id")
      .eq("restaurant_id", driver.restaurant_id)
      .eq("status", "ENTREGUE")
      .gte("delivered_at", startDay);

    const counts = new Map<string, number>();
    for (const r of rankingRows ?? []) {
      counts.set(r.driver_id!, (counts.get(r.driver_id!) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const myRankIndex = sorted.findIndex(([id]) => id === driver.id);
    const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

    const todayCount = today?.length ?? 0;
    const weekCount = week?.length ?? 0;
    const dailyGoal = 15;

    return {
      driver,
      queue: {
        position: myPosition,
        length: queueLength,
        inQueue: !!myEntry,
      },
      active: active ? { assignment: active, order: activeOrder } : null,
      earnings: {
        today: computeEarnings(today ?? []),
        week: computeEarnings(week ?? []),
        todayCount,
        weekCount,
        dailyGoal,
      },
      history: history ?? [],
      ranking: {
        position: myRank,
        total: sorted.length,
      },
    };
  });

export const enterQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: driver } = await context.supabase
      .from("delivery_drivers")
      .select("id, restaurant_id, status")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Motoboy não encontrado");
    if (driver.status !== "ativo") throw new Error("Cadastro não está ativo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("queue_enqueue", {
      _restaurant_id: driver.restaurant_id, _driver_id: driver.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: driver } = await context.supabase
      .from("delivery_drivers")
      .select("id, restaurant_id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Motoboy não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("queue_remove", {
      _restaurant_id: driver.restaurant_id, _driver_id: driver.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Validação apenas para consistência com o padrão do domínio
export const _driverDashboardSchema = z.object({});
