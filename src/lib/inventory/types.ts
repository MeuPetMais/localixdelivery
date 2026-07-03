export type MovementType =
  | "ENTRY"
  | "EXIT"
  | "RESERVE"
  | "RELEASE"
  | "LOSS"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "PRODUCTION"
  | "SALE";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "ORDERED"
  | "RECEIVED"
  | "CANCELLED";

export interface Ingredient {
  id: string;
  restaurant_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  stock: number;
  reserved_stock: number;
  min_stock: number;
  unit_cost: number;
  supplier_id?: string | null;
  active: boolean;
}

export interface InventoryLocation {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string | null;
  default_location: boolean;
}

export interface StockMovement {
  id: string;
  ingredient_id: string;
  location_id?: string | null;
  movement_type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  performed_by?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Supplier {
  id: string;
  restaurant_id?: string | null;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  address?: string | null;
  status: string;
  active: boolean;
}

export interface PurchaseOrder {
  id: string;
  restaurant_id?: string | null;
  supplier_id: string;
  status: PurchaseOrderStatus;
  expected_date?: string | null;
  total_cost: number;
  notes?: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  ingredient_id?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface MovementInput {
  ingredientId: string;
  quantity: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  performedBy?: string;
  locationId?: string;
  metadata?: Record<string, unknown>;
}
