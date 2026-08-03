// Customer Tracking public server function.
// Returns customer-safe tracking data. Coordinates are approximate and only
// included while the linked order has an active delivery.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildCustomerView } from "./customer-tracking.builder";
import type { CustomerTrackingView } from "./customer-tracking.types";

const Input = z.object({ orderId: z.string().uuid() });
const CUSTOMER_LOCATION_STATES = ["ATRIBUIDO", "COLETANDO", "EM_ROTA", "PROXIMO_AO_DESTINO"];

export const getCustomerTracking = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
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
      .select("status, eta_seconds, driver_id, updated_at, last_lat, last_lng, last_accuracy, last_seen_at")
      .eq("order_id", data.orderId)
      .maybeSingle();

    let driverName: string | null = null;
    if (snap?.driver_id) {
      const { data: driver } = await supabaseAdmin
        .from("delivery_drivers")
        .select("name, full_name")
        .eq("id", snap.driver_id)
        .maybeSingle();
      const raw =
        (driver as { name?: string | null; full_name?: string | null } | null)?.full_name ??
        (driver as { name?: string | null } | null)?.name ??
        null;
      driverName = raw ? String(raw).trim().split(/\s+/)[0] : null;
    }

    const activeForCustomer = CUSTOMER_LOCATION_STATES.includes(String(snap?.status ?? ""));
    const driverLocation =
      activeForCustomer && snap?.last_lat != null && snap?.last_lng != null
        ? {
            lat: Number(Number(snap.last_lat).toFixed(3)),
            lng: Number(Number(snap.last_lng).toFixed(3)),
            accuracy_m: snap.last_accuracy == null ? null : Math.round(Number(snap.last_accuracy)),
            updated_at: (snap.last_seen_at as string | null) ?? (snap.updated_at as string),
          }
        : null;

    return buildCustomerView(data.orderId, {
      order_status: String(order.status),
      tracking_status: (snap?.status as any) ?? null,
      eta_seconds: snap?.eta_seconds == null ? null : Number(snap.eta_seconds),
      driver_name: driverName,
      driver_location: driverLocation,
      updated_at: (snap?.updated_at as string | null) ?? (order.updated_at as string | null),
    });
  });
