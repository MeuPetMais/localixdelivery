import type { DeliveryProvider, CreateDeliveryResult } from "./DeliveryProvider";
import type { DeliveryContext, ProviderEstimate } from "../types";

/**
 * Frota própria do Localix.
 * Ainda não implementa app do entregador — apenas a arquitetura.
 */
export class LocalixDeliveryProvider implements DeliveryProvider {
  id = "LOCALIX" as const;

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
    return {
      eta_minutes: 15 + Math.round(km * 2.5),
      fee: 4.5 + km * 1.2,
      available: true,
    };
  }
  async health() {
    return { ok: true, latency_ms: 0 };
  }
}
