export type ConfigGroup =
  | "payment"
  | "delivery"
  | "business"
  | "branding"
  | "notifications"
  | "features";

export interface PaymentSettings {
  accept_pix: boolean;
  accept_credit: boolean;
  accept_cash: boolean;
  accept_voucher: boolean;
  minimum_order: number;
  maximum_order: number | null;
  payment_timeout_minutes: number;
  default_gateway: string;
  delivery_fee: number;
  free_delivery_enabled: boolean;
  free_delivery_minimum: number | null;
}

export interface DeliverySettings {
  delivery_mode: "AUTO" | "RESTAURANT" | "LOCALIX" | "EXTERNAL" | "HYBRID";
  delivery_radius_km: number;
  estimated_preparation_time: number;
  estimated_delivery_time: number;
  accept_scheduled_orders: boolean;
  maximum_simultaneous_orders: number;
  driver_assignment_mode: "AUTO" | "MANUAL";
}

export interface BusinessSettings {
  business_status: "OPEN" | "CLOSED" | "PAUSED";
  accept_orders: boolean;
  automatic_order_acceptance: boolean;
  allow_cancellations: boolean;
  cancellation_time_limit: number;
  working_hours_json: Record<string, { open: string; close: string } | null>;
  holidays_json: string[];
  vacation_mode: boolean;
}

export interface BrandingSettings {
  logo: string | null;
  primary_color: string;
  secondary_color: string;
  banner: string | null;
  favicon: string | null;
  social_links_json: Record<string, string>;
}

export interface NotificationSettings {
  notify_new_order: boolean;
  notify_cancelled_order: boolean;
  notify_payment: boolean;
  notify_delivery: boolean;
  notify_marketing: boolean;
  preferred_channels_json: string[];
}

export interface FeatureFlags {
  cashback_enabled: boolean;
  loyalty_enabled: boolean;
  coupons_enabled: boolean;
  ai_enabled: boolean;
  analytics_enabled: boolean;
  marketing_enabled: boolean;
  subscriptions_enabled: boolean;
}

export interface TenantConfiguration {
  restaurant_id: string;
  configuration_version: number;
  status: "ACTIVE" | "SUSPENDED";
  payment: PaymentSettings;
  delivery: DeliverySettings;
  business: BusinessSettings;
  branding: BrandingSettings;
  notifications: NotificationSettings;
  features: FeatureFlags;
}

export type GroupPayload<G extends ConfigGroup> = G extends "payment"
  ? PaymentSettings
  : G extends "delivery"
    ? DeliverySettings
    : G extends "business"
      ? BusinessSettings
      : G extends "branding"
        ? BrandingSettings
        : G extends "notifications"
          ? NotificationSettings
          : FeatureFlags;

export const DEFAULT_CONFIG: Omit<TenantConfiguration, "restaurant_id"> = {
  configuration_version: 1,
  status: "ACTIVE",
  payment: {
    accept_pix: true, accept_credit: true, accept_cash: true, accept_voucher: false,
    minimum_order: 0, maximum_order: null, payment_timeout_minutes: 15,
    default_gateway: "mercado_pago", delivery_fee: 0,
    free_delivery_enabled: false, free_delivery_minimum: null,
  },
  delivery: {
    delivery_mode: "AUTO", delivery_radius_km: 5,
    estimated_preparation_time: 20, estimated_delivery_time: 35,
    accept_scheduled_orders: false, maximum_simultaneous_orders: 50,
    driver_assignment_mode: "AUTO",
  },
  business: {
    business_status: "OPEN", accept_orders: true,
    automatic_order_acceptance: false, allow_cancellations: true,
    cancellation_time_limit: 5, working_hours_json: {}, holidays_json: [],
    vacation_mode: false,
  },
  branding: {
    logo: null, primary_color: "#f97316", secondary_color: "#0f172a",
    banner: null, favicon: null, social_links_json: {},
  },
  notifications: {
    notify_new_order: true, notify_cancelled_order: true, notify_payment: true,
    notify_delivery: true, notify_marketing: false,
    preferred_channels_json: ["IN_APP"],
  },
  features: {
    cashback_enabled: false, loyalty_enabled: false, coupons_enabled: true,
    ai_enabled: true, analytics_enabled: true, marketing_enabled: false,
    subscriptions_enabled: false,
  },
};
