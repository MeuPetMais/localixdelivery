// Tracking Domain — Realtime helpers.
// Apenas infraestrutura: nomes de canais + subscribe util. Sem GPS/Push.

import { supabase } from "@/integrations/supabase/client";
import type { TrackingRealtimePayload } from "./tracking.contracts";
import { toPublicPayload, toSnapshot } from "./tracking.mapper";

export const trackingChannelNames = {
  restaurant: (restaurantId: string) => `tracking-${restaurantId}`,
  publicOrder: (orderId: string) => `tracking-public-${orderId}`,
  driver: (driverId: string) => `tracking-driver-${driverId}`,
};

export interface SubscribeOptions {
  onUpdate: (payload: TrackingRealtimePayload) => void;
  onError?: (err: unknown) => void;
}

function subscribeSnapshotFilter(channelName: string, filter: string, opts: SubscribeOptions) {
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tracking_snapshots", filter },
      (payload) => {
        try {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (!row) return;
          opts.onUpdate(toPublicPayload(toSnapshot(row)));
        } catch (err) { opts.onError?.(err); }
      },
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeRestaurantTracking(restaurantId: string, opts: SubscribeOptions) {
  return subscribeSnapshotFilter(
    trackingChannelNames.restaurant(restaurantId),
    `restaurant_id=eq.${restaurantId}`,
    opts,
  );
}

export function subscribePublicOrderTracking(orderId: string, opts: SubscribeOptions) {
  return subscribeSnapshotFilter(
    trackingChannelNames.publicOrder(orderId),
    `order_id=eq.${orderId}`,
    opts,
  );
}

export function subscribeDriverTracking(driverId: string, opts: SubscribeOptions) {
  return subscribeSnapshotFilter(
    trackingChannelNames.driver(driverId),
    `driver_id=eq.${driverId}`,
    opts,
  );
}
