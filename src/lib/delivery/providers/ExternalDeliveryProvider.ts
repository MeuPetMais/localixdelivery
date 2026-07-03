import type { DeliveryProvider, CreateDeliveryResult } from "./DeliveryProvider";
import type { DeliveryContext, ProviderEstimate } from "../types";

/**
 * Stub para integrações futuras (Loggi, Lalamove, Uber Direct, Correios).
 */
export class ExternalDeliveryProvider implements DeliveryProvider {
  id = "EXTERNAL" as const;
  constructor(public readonly partner: string = "generic") {}

  async createDelivery(_ctx: DeliveryContext): Promise<CreateDeliveryResult> {
    return { accepted: false, reason: `Partner ${this.partner} not yet integrated` };
  }
  async assignDriver() {
    return { ok: false, reason: "not implemented" };
  }
  async cancelDelivery() {
    return { ok: true };
  }
  async track() {
    return {};
  }
  async estimate(_ctx: DeliveryContext): Promise<ProviderEstimate> {
    return { eta_minutes: 0, fee: 0, available: false, reason: "External partner not integrated" };
  }
  async health() {
    return { ok: false };
  }
}
