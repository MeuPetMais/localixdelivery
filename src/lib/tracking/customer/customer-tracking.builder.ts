// Customer Tracking — Builder puro (view a partir dos inputs).

import { CustomerTrackingMessageService } from "./customer-tracking.messages";
import type { CustomerTrackingInput, CustomerTrackingView } from "./customer-tracking.types";

export const CUSTOMER_STEPS = [
  { key: "pedido_recebido", label: "Pedido recebido" },
  { key: "em_preparo", label: "Em preparo" },
  { key: "pronto", label: "Pronto" },
  { key: "saiu_para_entrega", label: "Saiu para entrega" },
  { key: "entregue", label: "Entregue" },
] as const;

// ETA window (customer-safe): 0.85–1.20 do valor central.
export function etaWindowMinutes(etaSeconds: number | null): { min: number | null; max: number | null } {
  if (etaSeconds == null || etaSeconds <= 0) return { min: null, max: null };
  const mins = etaSeconds / 60;
  return { min: mins * 0.85, max: mins * 1.2 };
}

export function buildCustomerView(orderId: string, input: CustomerTrackingInput): CustomerTrackingView {
  const step = CustomerTrackingMessageService.stepFrom(input.order_status, input.tracking_status);
  const { min, max } = etaWindowMinutes(input.eta_seconds);
  const isCancelled = step === "cancelado";
  const isDelivered = step === "entregue";
  const showEta = !isCancelled && !isDelivered;

  return {
    order_id: orderId,
    order_status: input.order_status,
    step,
    driver_name: input.driver_name,
    eta_min_minutes: showEta ? min : null,
    eta_max_minutes: showEta ? max : null,
    eta_label: showEta ? CustomerTrackingMessageService.etaLabel(min, max) : null,
    message: CustomerTrackingMessageService.messageFor(step, { driver_name: input.driver_name }),
    updated_at: input.updated_at ?? new Date().toISOString(),
    has_tracking: input.tracking_status !== null,
  };
}
