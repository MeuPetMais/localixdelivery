import { isPromoActiveNow } from "@/lib/promotions";

export type BuilderCatalogProduct = {
  id: string;
  restaurant_id: string;
  price: number;
  promo_price?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  recurrence_days?: number[] | null;
  recurrence_start_time?: string | null;
  recurrence_end_time?: string | null;
  is_active?: boolean | null;
  is_available?: boolean | null;
  is_paused?: boolean | null;
};

export type BuilderPricingSelection = {
  group_id: string;
  option_id: string;
  quantity: number;
};

export type BuilderPricingOption = {
  id: string;
  group_id: string;
  price_delta: number;
  max_qty: number;
  menu_item_id?: string | null;
  menu_item?: BuilderCatalogProduct | null;
};

export type BuilderPricingGroup = {
  id: string;
  price_strategy?: "SUM" | "MAX_MENU_ITEM" | null;
  source_type?: "MANUAL" | "MENU_ITEMS" | null;
  builder_options: BuilderPricingOption[];
};

const toCents = (value: number) => Math.round((Number(value) || 0) * 100);
const fromCents = (value: number) => Math.round(value) / 100;

function currentCatalogPrice(product: BuilderCatalogProduct): number {
  if (product.is_active === false || product.is_available === false || product.is_paused === true) {
    throw new Error("builder_catalog_item_unavailable");
  }
  return isPromoActiveNow(product) ? Number(product.promo_price) : Number(product.price);
}

export function calculateBuilderCatalogUnitPrice(input: {
  restaurantId: string;
  basePrice: number;
  groups: BuilderPricingGroup[];
  selections: BuilderPricingSelection[];
}) {
  let totalCents = toCents(input.basePrice);

  for (const group of input.groups) {
    const optionById = new Map(group.builder_options.map((option) => [option.id, option]));
    const selected = input.selections.filter((selection) => selection.group_id === group.id);

    if ((group.price_strategy ?? "SUM") === "MAX_MENU_ITEM") {
      if ((group.source_type ?? "MANUAL") !== "MENU_ITEMS") {
        throw new Error("builder_catalog_group_invalid");
      }

      let highestCatalogPriceCents = 0;
      for (const selection of selected) {
        const option = optionById.get(selection.option_id);
        if (!option?.menu_item_id || !option.menu_item) {
          throw new Error("builder_catalog_item_missing");
        }
        if (option.menu_item.id !== option.menu_item_id) {
          throw new Error("builder_catalog_item_invalid");
        }
        if (option.menu_item.restaurant_id !== input.restaurantId) {
          throw new Error("builder_catalog_item_wrong_restaurant");
        }
        highestCatalogPriceCents = Math.max(
          highestCatalogPriceCents,
          toCents(currentCatalogPrice(option.menu_item)),
        );
      }

      if (highestCatalogPriceCents > 0) {
        totalCents = Math.max(totalCents, highestCatalogPriceCents);
      }
      continue;
    }

    for (const selection of selected) {
      const option = optionById.get(selection.option_id);
      if (!option) throw new Error("builder_option_invalid");
      totalCents += toCents(option.price_delta) * selection.quantity;
    }
  }

  return fromCents(totalCents);
}
