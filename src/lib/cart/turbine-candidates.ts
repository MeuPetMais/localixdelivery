import type { CartItem, CartSelection } from "./cart-lines";
import type {
  ProductOption,
  ProductOptionGroup,
  SelectedOption,
} from "@/lib/product/configuration/types";
import {
  isOptionUpsellEnabled,
  optionUpsellPriority,
} from "@/lib/product/configuration/option-upsell-metadata";

export type TurbineCandidate = {
  id: string;
  name: string;
  price_adjustment: number;
  groupId: string;
  groupName: string;
  selectedQuantity: number;
  maxQuantity: number;
  canIncrement: boolean;
};

type CandidateInput = {
  line: CartItem | null | undefined;
  groups: ProductOptionGroup[];
  options: ProductOption[];
  limit?: number;
};

export function normalizeCartSelections(selections: CartSelection[] | undefined): SelectedOption[] {
  return (selections ?? [])
    .map((selection) => ({
      group_id: selection.group_id ?? selection.groupId ?? "",
      option_id: selection.option_id ?? selection.optionId ?? "",
      quantity: Number(selection.quantity ?? selection.qty ?? 1),
    }))
    .filter((selection) => selection.group_id && selection.option_id && selection.quantity > 0);
}

export function selectedOptionQuantity(selections: SelectedOption[], optionId: string) {
  return selections
    .filter((selection) => selection.option_id === optionId)
    .reduce((sum, selection) => sum + selection.quantity, 0);
}

export function selectedGroupQuantity(selections: SelectedOption[], groupId: string) {
  return selections
    .filter((selection) => selection.group_id === groupId)
    .reduce((sum, selection) => sum + selection.quantity, 0);
}

export function metadataDependenciesSatisfied(
  metadata: ProductOption["metadata"] | ProductOptionGroup["metadata"] | undefined,
  selections: SelectedOption[],
) {
  const dependencies = metadata?.dependencies;
  if (!dependencies) return true;

  if (Array.isArray(dependencies)) {
    return dependencies.every((dependency) =>
      typeof dependency === "string"
        ? selections.some((selection) => selection.option_id === dependency)
        : true,
    );
  }

  if (typeof dependencies !== "object") return true;
  const optionIds = "option_ids" in dependencies ? dependencies.option_ids : undefined;
  if (Array.isArray(optionIds)) {
    return optionIds.every(
      (optionId) =>
        typeof optionId !== "string" ||
        selections.some((selection) => selection.option_id === optionId),
    );
  }

  const optionId = "option_id" in dependencies ? dependencies.option_id : undefined;
  return (
    typeof optionId !== "string" || selections.some((selection) => selection.option_id === optionId)
  );
}

function groupCanBeUpsold(
  group: ProductOptionGroup,
  selections: SelectedOption[],
  { enforceCapacity = true } = {},
) {
  if (group.required || group.min_selection > 0 || group.type === "SINGLE") return false;
  if (
    group.depends_on_option_id &&
    !selections.some((selection) => selection.option_id === group.depends_on_option_id)
  ) {
    return false;
  }
  if (
    group.depends_on_group_id &&
    selectedGroupQuantity(selections, group.depends_on_group_id) <= 0
  ) {
    return false;
  }
  if (!metadataDependenciesSatisfied(group.metadata, selections)) return false;
  return (
    !enforceCapacity ||
    group.max_selection <= 0 ||
    selectedGroupQuantity(selections, group.id) < group.max_selection
  );
}

export function getTurbineCandidates({
  line,
  groups,
  options,
  limit = 4,
}: CandidateInput): TurbineCandidate[] {
  if (!line || line.kind === "builder") return [];
  const productId = line.id;
  const selections = normalizeCartSelections(line.selections);
  const groupsById = new Map(
    groups.filter((group) => group.product_id === productId).map((group) => [group.id, group]),
  );

  return options
    .filter((option) => {
      const group = groupsById.get(option.group_id);
      if (!group || !option.active) return false;
      if (!isOptionUpsellEnabled(option)) return false;
      if (!groupCanBeUpsold(group, selections)) return false;
      if (!metadataDependenciesSatisfied(option.metadata, selections)) return false;
      const maxQuantity = Number(option.max_quantity);
      if (maxQuantity <= 0) return false;
      return selectedOptionQuantity(selections, option.id) < maxQuantity;
    })
    .sort((a, b) => {
      const groupA = groupsById.get(a.group_id);
      const groupB = groupsById.get(b.group_id);
      return (
        (optionUpsellPriority(a) ?? Number.MAX_SAFE_INTEGER) -
          (optionUpsellPriority(b) ?? Number.MAX_SAFE_INTEGER) ||
        (groupA?.display_order ?? 0) - (groupB?.display_order ?? 0) ||
        a.display_order - b.display_order ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      );
    })
    .slice(0, limit)
    .map((option) => {
      const group = groupsById.get(option.group_id)!;
      return {
        id: option.id,
        name: option.name,
        price_adjustment: Number(option.price_adjustment) || 0,
        groupId: group.id,
        groupName: group.name,
        selectedQuantity: selectedOptionQuantity(selections, option.id),
        maxQuantity: Number(option.max_quantity) || 0,
        canIncrement: true,
      };
    });
}

export function getTurbineDisplayCandidates(input: CandidateInput): TurbineCandidate[] {
  const line = input.line;
  if (!line || line.kind === "builder") return [];
  const selections = normalizeCartSelections(line.selections);
  const addable = getTurbineCandidates({ ...input, limit: Number.MAX_SAFE_INTEGER });
  const byId = new Map(addable.map((candidate) => [candidate.id, candidate]));
  const groupsById = new Map(
    input.groups.filter((group) => group.product_id === line.id).map((group) => [group.id, group]),
  );

  for (const selection of selections) {
    if (byId.has(selection.option_id)) continue;
    const option = input.options.find((item) => item.id === selection.option_id);
    const group = option ? groupsById.get(option.group_id) : undefined;
    if (!option || !group || !option.active) continue;
    if (!isOptionUpsellEnabled(option)) continue;
    if (!groupCanBeUpsold(group, selections, { enforceCapacity: false })) continue;
    byId.set(option.id, {
      id: option.id,
      name: option.name,
      price_adjustment: Number(option.price_adjustment) || 0,
      groupId: group.id,
      groupName: group.name,
      selectedQuantity: selectedOptionQuantity(selections, option.id),
      maxQuantity: Number(option.max_quantity) || 0,
      canIncrement: false,
    });
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const groupA = groupsById.get(a.groupId);
      const groupB = groupsById.get(b.groupId);
      const optionA = input.options.find((option) => option.id === a.id);
      const optionB = input.options.find((option) => option.id === b.id);
      return (
        (optionUpsellPriority(optionA ?? { metadata: undefined }) ?? Number.MAX_SAFE_INTEGER) -
          (optionUpsellPriority(optionB ?? { metadata: undefined }) ?? Number.MAX_SAFE_INTEGER) ||
        (groupA?.display_order ?? 0) - (groupB?.display_order ?? 0) ||
        (optionA?.display_order ?? 0) - (optionB?.display_order ?? 0) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      );
    })
    .slice(0, input.limit ?? 4);
}
