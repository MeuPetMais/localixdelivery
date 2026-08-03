// Customer Tracking — Types.
// Visão consumida pelo cliente final. Nunca expõe GPS bruto, wallet, fila.

import type { TrackingStatus } from "../tracking.types";

export type CustomerTrackingStep =
  | "pedido_recebido"
  | "em_preparo"
  | "pronto"
  | "saiu_para_entrega"
  | "proximo_do_destino"
  | "entregue"
  | "cancelado";

export interface CustomerTrackingView {
  order_id: string;
  order_status: string; // status do Orders (novo/em_preparo/saiu_para_entrega/entregue/cancelado)
  step: CustomerTrackingStep;
  driver_name: string | null;
  eta_min_minutes: number | null;
  eta_max_minutes: number | null;
  eta_label: string | null; // "Chega entre 7 e 9 minutos."
  message: string; // Mensagem humanizada
  updated_at: string; // ISO
  has_tracking: boolean;
  driver_location: {
    lat: number;
    lng: number;
    accuracy_m: number | null;
    updated_at: string;
  } | null;
}

export interface CustomerTrackingInput {
  order_status: string;
  tracking_status: TrackingStatus | null;
  eta_seconds: number | null;
  driver_name: string | null;
  driver_location?: CustomerTrackingView["driver_location"];
  updated_at: string | null;
}
