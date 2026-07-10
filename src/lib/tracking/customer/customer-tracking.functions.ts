// Customer Tracking — Server function pública (sem auth).
// Retorna apenas dados seguros para o cliente: nunca lat/lng/wallet/fila.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildCustomerView } from "./customer-tracking.builder";
import type { CustomerTrackingView } from "./customer-tracking.types";

const Input = z.object({ orderId: z.string().uuid() });

export const getCustomerTracking = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<CustomerTrackingView | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, updated_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return null;

    const { data: snap } = await supabaseAdmin
      .from("tracking_snapshots")
      .select("status, eta_seconds, driver_id, updated_at")
      .eq("order_id", data.orderId)
      .maybeSingle();

    let driverName: string | null = null;
    if (snap?.driver_id) {
      const { data: driver } = await supabaseAdmin
        .from("delivery_drivers")
        .select("full_name")
        .eq("id", snap.driver_id)
        .maybeSingle();
      const raw = (driver as { full_name?: string | null } | null)?.full_name ?? null;
      // Só primeiro nome — privacidade.
      driverName = raw ? String(raw).trim().split(/\s+/)[0] : null;
    }

    return buildCustomerView(data.orderId, {
      order_status: String(order.status),
      tracking_status: (snap?.status as any) ?? null,
      eta_seconds: snap?.eta_seconds == null ? null : Number(snap.eta_seconds),
      driver_name: driverName,
      updated_at: (snap?.updated_at as string | null) ?? (order.updated_at as string | null),
    });
  });
