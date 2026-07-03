// Catalog Engine — shared types
export type CatalogChannel =
  | "delivery"
  | "pickup"
  | "dine_in"
  | "qr"
  | "totem"
  | "marketplace"
  | "api";

export type CatalogMenuStatus = "draft" | "published" | "archived" | "scheduled";

export interface CatalogMenu {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  channel: CatalogChannel;
  status: CatalogMenuStatus;
  display_order: number;
  is_default: boolean;
  available_days: number[] | null;
  available_start_time: string | null;
  available_end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogMenuCategory {
  id: string;
  menu_id: string;
  category_id: string;
  restaurant_id: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogMenuProduct {
  id: string;
  menu_id: string;
  product_id: string;
  restaurant_id: string;
  display_order: number;
  is_featured: boolean;
  is_visible: boolean;
  channel_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogAvailabilityContext {
  now?: Date;
  channel?: CatalogChannel;
  stockAvailable?: boolean;
}

export interface CatalogAvailabilityResult {
  available: boolean;
  reasons: string[];
}

export type OrderingStrategy =
  | "manual"
  | "best_sellers"
  | "most_profitable"
  | "recent"
  | "ai";

export interface CatalogSearchDoc {
  productId: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  tags?: string[];
  sku?: string | null;
  ingredients?: string[];
}

export interface CatalogSearchQuery {
  text?: string;
  categoryId?: string;
  tag?: string;
  ingredient?: string;
  sku?: string;
}
