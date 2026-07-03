export type OptionGroupType = "SINGLE" | "MULTIPLE" | "QUANTITY" | "BOOLEAN";
export type PriceStrategy = "SUM" | "AVERAGE" | "MAX" | "FIXED" | "CUSTOM";

export interface ProductOptionGroup {
  id: string;
  product_id: string;
  name: string;
  description?: string | null;
  type: OptionGroupType;
  min_selection: number;
  max_selection: number;
  required: boolean;
  price_strategy: PriceStrategy;
  display_order: number;
  depends_on_group_id?: string | null;
  depends_on_option_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProductOption {
  id: string;
  group_id: string;
  name: string;
  description?: string | null;
  price_adjustment: number;
  max_quantity: number;
  image_url?: string | null;
  inventory_reference?: string | null;
  recipe_reference?: string | null;
  display_order: number;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface SelectedOption {
  group_id: string;
  option_id: string;
  quantity: number;
}

export interface ConfigurationSelection {
  base_price: number;
  fixed_price?: number;
  selections: SelectedOption[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
