import { brl } from "@/lib/format";

export type PersistedOrderItemAddon = {
  groupId?: string;
  groupName?: string;
  optionId?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
};

export type PersistedOrderItem = {
  addons?: PersistedOrderItemAddon[] | null;
};

export function getOrderItemAddons(item: PersistedOrderItem | null | undefined) {
  if (!item || !Array.isArray(item.addons)) return [];
  return item.addons
    .map((addon) => ({
      groupId: String(addon?.groupId ?? ""),
      groupName: String(addon?.groupName ?? "").trim(),
      optionId: String(addon?.optionId ?? ""),
      name: String(addon?.name ?? "").trim(),
      quantity: Math.max(1, Number(addon?.quantity ?? 1) || 1),
      unitPrice: Number(addon?.unitPrice ?? 0) || 0,
      total: Number(addon?.total ?? 0) || 0,
    }))
    .filter((addon) => addon.name);
}

export function formatOrderItemAddonLabel(addon: PersistedOrderItemAddon) {
  const quantity = Math.max(1, Number(addon.quantity ?? 1) || 1);
  const name = String(addon.name ?? "").trim();
  const unitPrice = Number(addon.unitPrice ?? 0) || 0;
  const quantityPrefix = quantity > 1 ? `${quantity}x ` : "";
  const priceSuffix = unitPrice > 0 ? ` (+ ${brl(unitPrice * quantity)})` : "";
  return `${quantityPrefix}${name}${priceSuffix}`;
}

export function groupOrderItemAddons(item: PersistedOrderItem | null | undefined) {
  const grouped = new Map<string, ReturnType<typeof getOrderItemAddons>>();
  for (const addon of getOrderItemAddons(item)) {
    const key = addon.groupName || "Opções";
    const current = grouped.get(key) ?? [];
    current.push(addon);
    grouped.set(key, current);
  }
  return Array.from(grouped.entries()).map(([groupName, addons]) => ({ groupName, addons }));
}

export function orderItemAddonPrintLines(item: PersistedOrderItem | null | undefined) {
  return groupOrderItemAddons(item).flatMap(({ groupName, addons }) =>
    addons.map((addon) => `${groupName}: ${formatOrderItemAddonLabel(addon)}`),
  );
}
