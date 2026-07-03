export type DeliveryProviderId = "RESTAURANT" | "LOCALIX" | "EXTERNAL";

export type DispatchStrategy = "AUTO" | "RESTAURANT" | "LOCALIX" | "EXTERNAL" | "HYBRID";

export type DeliveryState =
  | "WAITING_ASSIGNMENT"
  | "ASSIGNED"
  | "GOING_TO_RESTAURANT"
  | "WAITING_PICKUP"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface DeliveryOrder {
  id: string;
  order_id: string;
  restaurant_id: string;
  provider: DeliveryProviderId;
  delivery_mode: DispatchStrategy;
  driver_id: string | null;
  status: DeliveryState;
  estimated_pickup: string | null;
  estimated_delivery: string | null;
  started_at: string | null;
  finished_at: string | null;
  metadata: Record<string, unknown>;
}

export interface Driver {
  id: string;
  user_id: string | null;
  provider: DeliveryProviderId;
  vehicle_type: string | null;
  license_plate: string | null;
  phone: string | null;
  status: "OFFLINE" | "AVAILABLE" | "BUSY" | "PAUSED";
  rating: number;
  current_latitude: number | null;
  current_longitude: number | null;
}

export interface DeliveryContext {
  restaurant_id: string;
  order_id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  weight_kg?: number;
  distance_km?: number;
}

export interface ProviderEstimate {
  eta_minutes: number;
  fee: number;
  available: boolean;
  reason?: string;
}
