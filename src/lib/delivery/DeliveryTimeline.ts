import type { DeliveryEventType } from "./DeliveryEventBus";

export interface TimelineEntry {
  event: DeliveryEventType | string;
  from_status?: string | null;
  to_status?: string | null;
  actor?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface TimelineRow {
  event: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function toTimeline(rows: TimelineRow[]): TimelineEntry[] {
  return rows
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({
      event: r.event,
      from_status: r.from_status,
      to_status: r.to_status,
      actor: r.actor,
      metadata: r.metadata,
      created_at: r.created_at,
    }));
}

export const HUMAN_LABELS: Record<string, string> = {
  DriverAssigned: "Motorista atribuído",
  DriverArrived: "Motorista chegou ao restaurante",
  OrderPickedUp: "Pedido retirado",
  DeliveryStarted: "Saiu para entrega",
  DriverNearCustomer: "Motorista próximo",
  OrderDelivered: "Pedido entregue",
  DeliveryCancelled: "Entrega cancelada",
  DeliveryFailed: "Falha na entrega",
};
