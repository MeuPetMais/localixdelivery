import type { DeliveryProvider, CreateDeliveryResult } from "./DeliveryProvider";
import type { DeliveryContext, ProviderEstimate } from "../types";

export class RestaurantDeliveryProvider implements DeliveryProvider {
  id = "RESTAURANT" as const;

  async createDelivery(_ctx: DeliveryContext): Promise<CreateDeliveryResult> {
    return { accepted: true };
  }
  async assignDriver(_deliveryId: string, _driverId: string) {
    return { ok: true };
  }
  async cancelDelivery(_deliveryId: string) {
    return { ok: true };
  }
  async track(_deliveryId: string) {
    return {};
  }
  async estimate(ctx: DeliveryContext): Promise<ProviderEstimate> {
    const km = ctx.distance_km ?? 0;
    return { eta_minutes: 20 + Math.round(km * 3), fee: 0, available: true };
  }
  async health() {
    return { ok: true, latency_ms: 0 };
  }
}
