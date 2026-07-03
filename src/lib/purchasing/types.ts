export type PurchaseRequestStatus = "OPEN" | "APPROVED" | "REJECTED" | "ORDERED";

export interface Supplier {
  id: string;
  restaurant_id?: string | null;
  name: string;
  category?: string | null;
  active: boolean;
  lead_time?: number | null;
  minimum_order_value?: number | null;
  payment_terms?: string | null;
  delivery_days?: string[] | null;
  rating?: number | null;
  preferred_supplier?: boolean;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  ingredient_id?: string | null;
  name: string;
  supplier_sku?: string | null;
  price: number;
  minimum_quantity?: number | null;
  lead_time?: number | null;
  last_purchase?: string | null;
  status: string;
}

export interface PurchaseRequestItem {
  ingredient_id: string;
  quantity: number;
  notes?: string;
}

export interface PurchaseRequest {
  id: string;
  restaurant_id: string;
  status: PurchaseRequestStatus;
  reason?: string | null;
  requested_by?: string | null;
  approved_by?: string | null;
  items: PurchaseRequestItem[];
  notes?: string | null;
  created_at: string;
}

export interface SupplierQuote {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  ingredient_id: string;
  price: number;
  delivery_time?: number | null;
  minimum_quantity?: number | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface ReceivingLine {
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  batch_code?: string;
  expires_at?: string;
  supplier_id?: string;
  purchase_order_id?: string;
}

export interface PurchasingRepository {
  // suppliers
  listSuppliers(restaurantId: string): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | null>;
  upsertSupplier(s: Partial<Supplier> & { name: string; restaurant_id?: string | null }): Promise<Supplier>;

  // supplier products
  listSupplierProducts(filter: { supplier_id?: string; ingredient_id?: string }): Promise<SupplierProduct[]>;

  // purchase requests
  createRequest(input: Omit<PurchaseRequest, "id" | "created_at" | "status"> & { status?: PurchaseRequestStatus }): Promise<PurchaseRequest>;
  updateRequestStatus(id: string, status: PurchaseRequestStatus, actor?: string): Promise<PurchaseRequest>;
  listRequests(restaurantId: string): Promise<PurchaseRequest[]>;

  // quotes
  createQuote(q: Omit<SupplierQuote, "id">): Promise<SupplierQuote>;
  listQuotes(filter: { restaurant_id: string; ingredient_id?: string }): Promise<SupplierQuote[]>;
}
