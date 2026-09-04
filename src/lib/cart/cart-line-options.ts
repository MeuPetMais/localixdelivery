import type { CartItem } from "./cart-lines";
import {
  getTurbineCandidates,
  normalizeCartSelections,
  selectedGroupQuantity,
  selectedOptionQuantity,
} from "./turbine-candidates";
import { PriceCalculationStrategy } from "@/lib/product/configuration/PriceCalculationStrategy";
import type {
  ProductOption,
  ProductOptionGroup,
  SelectedOption,
} from "@/lib/product/configuration/types";

type CartLineOptionInput = {
  line: CartItem;
  group: ProductOptionGroup;
  option: ProductOption;
  groups: ProductOptionGroup[];
  options: ProductOption[];
  basePrice: number;
};

export type CartLineOptionResult = {
  line: CartItem;
  changed: boolean;
};

function productGroups(groups: ProductOptionGroup[], productId: string) {
  return groups.filter((group) => group.product_id === productId);
}

function productOptions(groups: ProductOptionGroup[], options: ProductOption[]) {
  const groupIds = new Set(groups.map((group) => group.id));
  return options.filter((option) => groupIds.has(option.group_id));
}

function toCartSelections(selections: SelectedOption[]) {
  return selections.map((selection) => ({
    group_id: selection.group_id,
    option_id: selection.option_id,
    quantity: selection.quantity,
  }));
}

function recalculateLinePrice(
  line: CartItem,
  groups: ProductOptionGroup[],
  options: ProductOption[],
  selections: SelectedOption[],
  basePrice: number,
): CartItem {
  return {
    ...line,
    price: PriceCalculationStrategy.calculate(basePrice, groups, options, selections),
    selections: toCartSelections(selections),
  };
}

function canApply({ line, option, groups, options }: CartLineOptionInput) {
  return getTurbineCandidates({
    line,
    groups,
    options,
    limit: Number.MAX_SAFE_INTEGER,
  }).some((candidate) => candidate.id === option.id);
}

function updateSelection(
  selections: SelectedOption[],
  groupId: string,
  optionId: string,
  nextQuantity: number,
) {
  const next = selections.filter((selection) => selection.option_id !== optionId);
  if (nextQuantity > 0) {
    next.push({ group_id: groupId, option_id: optionId, quantity: nextQuantity });
  }
  return next;
}

export function addOptionToCartLine(input: CartLineOptionInput): CartLineOptionResult {
  if (!canApply(input)) return { line: input.line, changed: false };
  const selections = normalizeCartSelections(input.line.selections);
  const selected = selectedOptionQuantity(selections, input.option.id);
  if (selected > 0) return { line: input.line, changed: false };
  const groups = productGroups(input.groups, input.line.id);
  const options = productOptions(groups, input.options);
  return {
    line: recalculateLinePrice(
      input.line,
      groups,
      options,
      updateSelection(selections, input.group.id, input.option.id, 1),
      input.basePrice,
    ),
    changed: true,
  };
}

export function removeOptionFromCartLine(input: CartLineOptionInput): CartLineOptionResult {
  const selections = normalizeCartSelections(input.line.selections);
  if (selectedOptionQuantity(selections, input.option.id) <= 0) {
    return { line: input.line, changed: false };
  }
  const groups = productGroups(input.groups, input.line.id);
  const options = productOptions(groups, input.options);
  return {
    line: recalculateLinePrice(
      input.line,
      groups,
      options,
      updateSelection(selections, input.group.id, input.option.id, 0),
      input.basePrice,
    ),
    changed: true,
  };
}

export function incrementOptionQuantity(input: CartLineOptionInput): CartLineOptionResult {
  if (!canApply(input)) return { line: input.line, changed: false };
  const selections = normalizeCartSelections(input.line.selections);
  const selected = selectedOptionQuantity(selections, input.option.id);
  const maxQuantity = Number(input.option.max_quantity) || 0;
  const groupTotal = selectedGroupQuantity(selections, input.group.id);
  if (selected >= maxQuantity) return { line: input.line, changed: false };
  if (input.group.max_selection > 0 && groupTotal >= input.group.max_selection) {
    return { line: input.line, changed: false };
  }
  const groups = productGroups(input.groups, input.line.id);
  const options = productOptions(groups, input.options);
  return {
    line: recalculateLinePrice(
      input.line,
      groups,
      options,
      updateSelection(selections, input.group.id, input.option.id, selected + 1),
      input.basePrice,
    ),
    changed: true,
  };
}

export function decrementOptionQuantity(input: CartLineOptionInput): CartLineOptionResult {
  const selections = normalizeCartSelections(input.line.selections);
  const selected = selectedOptionQuantity(selections, input.option.id);
  if (selected <= 0) return { line: input.line, changed: false };
  const groups = productGroups(input.groups, input.line.id);
  const options = productOptions(groups, input.options);
  return {
    line: recalculateLinePrice(
      input.line,
      groups,
      options,
      updateSelection(selections, input.group.id, input.option.id, selected - 1),
      input.basePrice,
    ),
    changed: true,
  };
}

export function updateCartLineOption(
  cart: CartItem[],
  lineId: string,
  updater: (line: CartItem) => CartLineOptionResult,
) {
  let changed = false;
  const nextCart = cart.map((line) => {
    if (line.lineId !== lineId) return line;
    const result = updater(line);
    changed = result.changed;
    return result.line;
  });
  return { cart: nextCart, changed };
}
