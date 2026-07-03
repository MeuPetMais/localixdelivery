// Product Domain — shared types
export type ProductLifecycleStatus =
  | "DRAFT"
  | "REVIEW"
  | "PUBLISHED"
  | "SCHEDULED"
  | "PAUSED"
  | "ARCHIVED"
  | "DISCONTINUED";

export type ProductMediaType = "image" | "video" | "model_3d";

export interface ProductRecord {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  image_url: string | null;
  position: number;
  is_available: boolean;
  is_active: boolean;
  is_paused: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  available_delivery: boolean;
  available_pickup: boolean;
  recurrence_days: number[] | null;
  recurrence_start_time: string | null;
  recurrence_end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  restaurant_id: string;
  version: number;
  status: ProductLifecycleStatus;
  changes_json: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  restaurant_id: string;
  type: ProductMediaType;
  url: string;
  storage_path: string | null;
  display_order: number;
  alt_text: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductAuditEntry {
  id: string;
  product_id: string;
  restaurant_id: string;
  actor_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ProductAvailabilityContext {
  now?: Date;
  stockAvailable?: boolean;
  channel?: "delivery" | "pickup" | "dine_in" | "any";
}

export interface ProductAvailabilityResult {
  available: boolean;
  reasons: string[];
}

export interface ProductValidationIssue {
  field: string;
  message: string;
}

export interface ProductValidationResult {
  ok: boolean;
  issues: ProductValidationIssue[];
}
