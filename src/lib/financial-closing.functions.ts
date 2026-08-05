// RC8.0 — Financeiro: server function que agrega ganhos por entregador em um período.
// Read-only. Não altera Orders/Payments/Delivery/Tracking/Queue/Wallet.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  aggregateByDriver,
  periodBounds,
  totals,
  type DeliveredRow,
  type DriverEarnings,
  type Period,
} from "./financial-closing";

async function assertOwner(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!data || data.owner_id !== userId) {
    throw new Error("Sem permissão para este restaurante");
  }
}

const Input = z.object({
  restaurantId: z.string().uuid(),
  period: z.enum(["today", "week", "month", "custom"]),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type FinancialClosingResult = {
  period: Period;
  from: string;
  to: string;
  drivers: DriverEarnings[];
  totals: { deliveries: number; distance_km: number; earnings: number };
};

export const getFinancialClosing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<FinancialClosingResult> => {
    await assertOwner(context.supabase, context.userId, data.restaurantId);
    const sb = context.supabase;
    const { from, to } = periodBounds(data.period, { from: data.from, to: data.to });

    const [{ data: rows }, { data: driversList }] = await Promise.all([
      sb.from("delivery_assignments")
        .select("driver_id, delivered_at, distance_km, driver_distance_km, driver_earning_amount, driver_earning_calculated_at, driver_base_fee, driver_per_km_fee, metadata")
        .eq("restaurant_id", data.restaurantId)
        .eq("status", "ENTREGUE")
        .gte("delivered_at", from.toISOString())
        .lt("delivered_at", to.toISOString()),
      sb.from("delivery_drivers")
        .select("id, name, photo_url")
        .eq("restaurant_id", data.restaurantId),
    ]);

    const drivers = aggregateByDriver(
      (rows ?? []) as DeliveredRow[],
      (driversList ?? []) as any[],
    );

    return {
      period: data.period,
      from: from.toISOString(),
      to: to.toISOString(),
      drivers,
      totals: totals(drivers),
    };
  });
