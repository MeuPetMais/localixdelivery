export type ProductionStatus = "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
export type ProductionBatchStatus = "ACTIVE" | "CONSUMED" | "EXPIRED" | "DISCARDED";

export interface ProductionOrder {
  id: string;
  restaurant_id: string;
  recipe_id: string;
  batch_number: string | null;
  planned_quantity: number;
  produced_quantity: number;
  status: ProductionStatus;
  planned_start: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  expiration_date: string | null;
  notes: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ProductionConsumption {
  id: string;
  production_order_id: string;
  ingredient_id: string;
  planned_quantity: number;
  consumed_quantity: number;
  loss_quantity: number;
  created_at?: string;
}

export interface ProductionOutput {
  id: string;
  production_order_id: string;
  product_id: string | null;
  produced_quantity: number;
  approved_quantity: number;
  rejected_quantity: number;
  created_at?: string;
}

export interface ProductionLoss {
  id: string;
  production_order_id: string;
  ingredient_id: string | null;
  quantity: number;
  reason: string | null;
  cost: number;
  created_at?: string;
}

export interface ProductionBatch {
  id: string;
  production_order_id: string;
  batch_code: string;
  manufacturing_date: string;
  expiration_date: string | null;
  status: ProductionBatchStatus;
  quantity: number;
  created_at?: string;
}

export interface PlanProductionInput {
  restaurant_id: string;
  recipe_id: string;
  planned_quantity: number;
  planned_start?: string | null;
  expiration_date?: string | null;
  batch_number?: string | null;
  notes?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CompleteProductionInput {
  producedQuantity: number;
  approvedQuantity?: number;
  rejectedQuantity?: number;
  losses?: { ingredientId: string | null; quantity: number; reason?: string; cost?: number }[];
  batchCode?: string;
  expirationDate?: string | null;
  performedBy?: string;
}

export type ProductionEventName =
  | "ProductionPlanned"
  | "ProductionStarted"
  | "ProductionPaused"
  | "ProductionResumed"
  | "ProductionCompleted"
  | "ProductionCancelled"
  | "ProductionFailed"
  | "BatchCreated"
  | "BatchExpired"
  | "LossRegistered";

export interface ProductionEvent {
  name: ProductionEventName;
  productionId: string;
  at: string;
  data?: Record<string, unknown>;
}
