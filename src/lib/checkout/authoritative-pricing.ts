import { isPromoActiveNow } from "@/lib/promotions";
import { ConfigurationRuleEngine } from "@/lib/product/configuration/ConfigurationRuleEngine";
import { PriceCalculationStrategy } from "@/lib/product/configuration/PriceCalculationStrategy";
import type {
  ProductOption,
  ProductOptionGroup,
  SelectedOption,
} from "@/lib/product/configuration/types";

export type CheckoutSelectionInput = {
  groupId?: string;
  group_id?: string;
  optionId?: string;
  option_id?: string;
  qty?: number;
  quantity?: number;
};

export type CheckoutItemInput = {
  id: string;
  name?: string;
  price?: number;
  qty: number;
  kind?: "product" | "builder";
  builderId?: string | null;
  builder_id?: string | null;
  selections?: CheckoutSelectionInput[];
  selectedOptions?: CheckoutSelectionInput[];
  notes?: string;
};

export type ProductRecord = {
  id: string;
  restaurant_id: string;
  name: string;
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

export type BuilderOptionRecord = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  max_qty: number;
};

export type BuilderGroupRecord = {
  id: string;
  builder_id: string;
  name: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  builder_options: BuilderOptionRecord[];
};

export type BuilderRecord = {
  id: string;
  restaurant_id: string;
  name: string;
  base_price: number;
  is_active: boolean;
  builder_groups: BuilderGroupRecord[];
};

export type CouponRecord = {
  id?: string;
  code: string;
  discount_percent: number;
  valid_until: string | null;
  is_active: boolean;
};

export type AuthoritativePricingRepository = {
  getProducts(ids: string[], restaurantId: string): Promise<ProductRecord[]>;
  getBuilders(ids: string[], restaurantId: string): Promise<BuilderRecord[]>;
  getProductOptionConfig?(
    productIds: string[],
    restaurantId: string,
  ): Promise<{ groups: ProductOptionGroup[]; options: ProductOption[] }>;
  getCoupon?(code: string, restaurantId: string): Promise<CouponRecord | null>;
};

export type AuthoritativeCartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  total: number;
  kind: "product" | "builder";
  productId?: string;
  builderId?: string;
  selections?: SelectedOption[];
  notes?: string;
};

export type AuthoritativeCheckoutPricing = {
  items: AuthoritativeCartItem[];
  subtotal: number;
  couponDiscount: number;
  couponCode?: string;
  couponId?: string;
};

export class CheckoutValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CheckoutValidationError";
    this.code = code;
    this.details = details;
  }
}

const toCents = (value: number) => Math.round((Number(value) || 0) * 100);
const fromCents = (value: number) => Math.round(value) / 100;

function normalizeSelections(input: CheckoutSelectionInput[] | undefined): SelectedOption[] {
  return (input ?? []).map((s) => {
    const group_id = s.group_id ?? s.groupId;
    const option_id = s.option_id ?? s.optionId;
    const quantity = s.quantity ?? s.qty ?? 1;
    if (!group_id || !option_id || !Number.isInteger(quantity) || quantity <= 0) {
      throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
    }
    return { group_id, option_id, quantity };
  });
}

function parseBuilderId(item: CheckoutItemInput): string | null {
  if (item.builderId) return item.builderId;
  if (item.builder_id) return item.builder_id;
  if (item.id.startsWith("builder:")) {
    const [, builderId] = item.id.split(":");
    return builderId || null;
  }
  return null;
}

function assertQty(qty: number) {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new CheckoutValidationError("checkout_item_invalid", "Quantidade invalida");
  }
}

function assertSameFrontendPrice(item: CheckoutItemInput, authoritativeUnitPrice: number) {
  if (item.price == null) return;
  if (!Number.isFinite(item.price) || item.price < 0) {
    throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
  }
  if (toCents(item.price) !== toCents(authoritativeUnitPrice)) {
    throw new CheckoutValidationError("checkout_price_changed", "Preco do item mudou", {
      itemId: item.id,
      currentPrice: authoritativeUnitPrice,
    });
  }
}

function activeProductPrice(product: ProductRecord): number {
  return isPromoActiveNow(product) ? Number(product.promo_price) : Number(product.price);
}

function validateProduct(product: ProductRecord | undefined, restaurantId: string): ProductRecord {
  if (!product || product.restaurant_id !== restaurantId) {
    throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
  }
  if (product.is_active === false || product.is_available === false || product.is_paused === true) {
    throw new CheckoutValidationError("checkout_item_invalid", "Item indisponivel");
  }
  return product;
}

function validateBuilder(builder: BuilderRecord | undefined, restaurantId: string): BuilderRecord {
  if (!builder || builder.restaurant_id !== restaurantId || !builder.is_active) {
    throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
  }
  return builder;
}

function calculateBuilderPrice(builder: BuilderRecord, selections: SelectedOption[]) {
  const groups = builder.builder_groups ?? [];
  const options = groups.flatMap((g) => g.builder_options ?? []);
  const optionsById = new Map(options.map((o) => [o.id, o]));
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  for (const s of selections) {
    const group = groupsById.get(s.group_id);
    const option = optionsById.get(s.option_id);
    if (!group || !option || option.group_id !== group.id) {
      throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
    }
    if (s.quantity > option.max_qty) {
      throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
    }
  }

  for (const group of groups) {
    const selectedTotal = selections
      .filter((s) => s.group_id === group.id)
      .reduce((sum, s) => sum + s.quantity, 0);
    const minimum = Math.max(group.is_required ? 1 : 0, Number(group.min_select) || 0);
    if (selectedTotal < minimum) {
      throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
    }
    if (group.max_select > 0 && selectedTotal > group.max_select) {
      throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
    }
  }

  const totalCents =
    toCents(builder.base_price) +
    selections.reduce((sum, s) => {
      const option = optionsById.get(s.option_id)!;
      return sum + toCents(option.price_delta) * s.quantity;
    }, 0);
  return fromCents(totalCents);
}

function validCoupon(coupon: CouponRecord | null): coupon is CouponRecord {
  if (!coupon || !coupon.is_active) return false;
  if (!coupon.valid_until) return true;
  return new Date(coupon.valid_until) >= new Date(new Date().toDateString());
}

export async function resolveAuthoritativeCheckoutPricing(input: {
  restaurantId: string;
  items: CheckoutItemInput[];
  couponCode?: string | null;
  repository: AuthoritativePricingRepository;
}): Promise<AuthoritativeCheckoutPricing> {
  const productInputs: CheckoutItemInput[] = [];
  const builderInputs: Array<CheckoutItemInput & { resolvedBuilderId: string }> = [];

  for (const item of input.items) {
    assertQty(item.qty);
    const builderId = parseBuilderId(item);
    if (item.kind === "builder" || builderId) {
      if (!builderId) throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
      builderInputs.push({ ...item, resolvedBuilderId: builderId });
    } else {
      productInputs.push(item);
    }
  }

  const productIds = Array.from(new Set(productInputs.map((i) => i.id)));
  const builderIds = Array.from(new Set(builderInputs.map((i) => i.resolvedBuilderId)));
  const [products, builders, optionConfig] = await Promise.all([
    productIds.length
      ? input.repository.getProducts(productIds, input.restaurantId)
      : Promise.resolve([]),
    builderIds.length
      ? input.repository.getBuilders(builderIds, input.restaurantId)
      : Promise.resolve([]),
    productIds.length && input.repository.getProductOptionConfig
      ? input.repository.getProductOptionConfig(productIds, input.restaurantId)
      : Promise.resolve({ groups: [], options: [] }),
  ]);

  const productsById = new Map(products.map((p) => [p.id, p]));
  const buildersById = new Map(builders.map((b) => [b.id, b]));
  const groupsByProduct = new Map<string, ProductOptionGroup[]>();
  for (const group of optionConfig.groups) {
    const list = groupsByProduct.get(group.product_id) ?? [];
    list.push(group);
    groupsByProduct.set(group.product_id, list);
  }
  const optionsByGroup = new Map<string, ProductOption[]>();
  for (const option of optionConfig.options) {
    const list = optionsByGroup.get(option.group_id) ?? [];
    list.push(option);
    optionsByGroup.set(option.group_id, list);
  }

  const resolvedItems: AuthoritativeCartItem[] = [];
  let subtotalCents = 0;

  for (const item of productInputs) {
    const product = validateProduct(productsById.get(item.id), input.restaurantId);
    const selections = normalizeSelections(item.selectedOptions ?? item.selections);
    const groups = groupsByProduct.get(product.id) ?? [];
    const options = groups.flatMap((g) => optionsByGroup.get(g.id) ?? []);
    const groupIds = new Set(groups.map((g) => g.id));
    if (selections.some((s) => !groupIds.has(s.group_id))) {
      throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
    }
    const validation = ConfigurationRuleEngine.validate(groups, options, selections);
    if (!validation.valid) {
      throw new CheckoutValidationError("checkout_item_invalid", "Item invalido");
    }

    const unitPrice = groups.length
      ? PriceCalculationStrategy.calculate(activeProductPrice(product), groups, options, selections)
      : activeProductPrice(product);
    assertSameFrontendPrice(item, unitPrice);
    const lineCents = toCents(unitPrice) * item.qty;
    subtotalCents += lineCents;
    resolvedItems.push({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: fromCents(toCents(unitPrice)),
      qty: item.qty,
      total: fromCents(lineCents),
      kind: "product",
      selections,
      notes: item.notes,
    });
  }

  for (const item of builderInputs) {
    const builder = validateBuilder(buildersById.get(item.resolvedBuilderId), input.restaurantId);
    const selections = normalizeSelections(item.selections ?? item.selectedOptions);
    const unitPrice = calculateBuilderPrice(builder, selections);
    assertSameFrontendPrice(item, unitPrice);
    const lineCents = toCents(unitPrice) * item.qty;
    subtotalCents += lineCents;
    resolvedItems.push({
      id: item.id,
      builderId: builder.id,
      name: item.name?.trim() || builder.name,
      price: unitPrice,
      qty: item.qty,
      total: fromCents(lineCents),
      kind: "builder",
      selections,
      notes: item.notes,
    });
  }

  const subtotal = fromCents(subtotalCents);
  let couponDiscount = 0;
  let couponCode: string | undefined;
  let couponId: string | undefined;
  const requestedCoupon = input.couponCode?.trim();
  if (requestedCoupon && input.repository.getCoupon) {
    const coupon = await input.repository.getCoupon(requestedCoupon, input.restaurantId);
    if (validCoupon(coupon)) {
      couponDiscount = fromCents(
        Math.round((subtotalCents * Number(coupon.discount_percent)) / 100),
      );
      couponCode = coupon.code;
      couponId = coupon.id;
    }
  }

  return { items: resolvedItems, subtotal, couponDiscount, couponCode, couponId };
}
