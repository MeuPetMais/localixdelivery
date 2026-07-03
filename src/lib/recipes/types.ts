export type RecipeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface Recipe {
  id: string;
  restaurant_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  yield_quantity: number;
  yield_unit: string;
  preparation_time: number | null;
  status: RecipeStatus;
  version: number;
  variation_key: string | null;
  metadata: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  loss_percentage: number;
  optional: boolean;
  substitute_of: string | null;
  display_order: number;
  created_at?: string;
}

export interface RecipeItemInput {
  ingredient_id: string;
  quantity: number;
  unit?: string;
  loss_percentage?: number;
  optional?: boolean;
  substitute_of?: string | null;
  display_order?: number;
}

export interface RecipeInput {
  restaurant_id: string;
  product_id?: string | null;
  name: string;
  description?: string | null;
  yield_quantity?: number;
  yield_unit?: string;
  preparation_time?: number | null;
  variation_key?: string | null;
  metadata?: Record<string, unknown>;
  items: RecipeItemInput[];
}

export interface RecipeVersionSnapshot {
  id: string;
  recipe_id: string;
  version: number;
  snapshot: { recipe: Recipe; items: RecipeItem[] };
  changed_by: string | null;
  change_reason: string | null;
  created_at?: string;
}

export type RecipeEventName =
  | "RecipeCreated"
  | "RecipeUpdated"
  | "RecipeActivated"
  | "RecipeArchived"
  | "RecipeCostChanged";

export interface RecipeEvent {
  name: RecipeEventName;
  recipeId: string;
  at: string;
  data?: Record<string, unknown>;
}
