import type { DeliveryContext, DeliveryProviderId, ProviderEstimate } from "../types";

export interface CreateDeliveryResult {
  external_id?: string;
  accepted: boolean;
  reason?: string;
}

export interface DeliveryProvider {
  id: DeliveryProviderId;
  createDelivery(ctx: DeliveryContext): Promise<CreateDeliveryResult>;
  assignDriver(deliveryId: string, driverId: string): Promise<{ ok: boolean; reason?: string }>;
  cancelDelivery(deliveryId: string, reason?: string): Promise<{ ok: boolean }>;
  track(deliveryId: string): Promise<{ latitude?: number; longitude?: number; status?: string }>;
  estimate(ctx: DeliveryContext): Promise<ProviderEstimate>;
  health(): Promise<{ ok: boolean; latency_ms?: number }>;
}
