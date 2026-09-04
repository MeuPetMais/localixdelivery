export type CartSelection = {
  groupId?: string;
  group_id?: string;
  optionId?: string;
  option_id?: string;
  qty?: number;
  quantity?: number;
};

export type CartItem = {
  lineId: string;
  id: string;
  name: string;
  price: number;
  qty: number;
  kind?: "product" | "builder";
  builderId?: string;
  selections?: CartSelection[];
  notes?: string;
};

export type CartItemInput = Omit<CartItem, "lineId" | "qty"> & {
  lineId?: string;
  qty?: number;
};

export function createCartLineId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `line:${crypto.randomUUID()}`;
  }
  return `line:${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function normalizedSelections(selections: CartSelection[] | undefined) {
  return (selections ?? [])
    .map((selection) => ({
      groupId: selection.groupId ?? selection.group_id ?? "",
      optionId: selection.optionId ?? selection.option_id ?? "",
      qty: selection.qty ?? selection.quantity ?? 1,
    }))
    .filter((selection) => selection.groupId && selection.optionId && selection.qty > 0)
    .sort(
      (a, b) =>
        a.groupId.localeCompare(b.groupId) || a.optionId.localeCompare(b.optionId) || a.qty - b.qty,
    );
}

export function cartLineEquivalenceKey(
  item: Pick<CartItem, "id" | "kind" | "builderId" | "selections" | "notes">,
) {
  return JSON.stringify({
    id: item.id,
    kind: item.kind ?? "product",
    builderId: item.builderId ?? null,
    selections: normalizedSelections(item.selections),
    notes: item.notes?.trim() ?? "",
  });
}

export function normalizeCartItems(items: unknown[]): CartItem[] {
  const usedLineIds = new Set<string>();
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "string" && typeof item.name === "string")
    .map((item) => {
      const requestedLineId = typeof item.lineId === "string" && item.lineId ? item.lineId : null;
      const lineId =
        requestedLineId && !usedLineIds.has(requestedLineId) ? requestedLineId : createCartLineId();
      usedLineIds.add(lineId);

      const kind =
        item.kind === "builder" ? "builder" : item.kind === "product" ? "product" : undefined;
      const builderId = typeof item.builderId === "string" ? item.builderId : undefined;
      const selections = Array.isArray(item.selections)
        ? (item.selections as CartSelection[])
        : undefined;
      const notes = typeof item.notes === "string" ? item.notes : undefined;
      const qty = Number(item.qty);

      return {
        lineId,
        id: item.id as string,
        name: item.name as string,
        price: Number(item.price) || 0,
        qty: Number.isInteger(qty) && qty > 0 ? qty : 1,
        kind,
        builderId,
        selections,
        notes,
      };
    });
}

export function addCartItem(cart: CartItem[], input: CartItemInput): CartItem[] {
  return addCartItemWithResult(cart, input).cart;
}

export function addCartItemWithResult(cart: CartItem[], input: CartItemInput) {
  const qty = Number.isInteger(input.qty) && Number(input.qty) > 0 ? Number(input.qty) : 1;
  const nextItem: CartItem = {
    ...input,
    lineId: input.lineId ?? createCartLineId(),
    price: Number(input.price) || 0,
    qty,
  };
  const key = cartLineEquivalenceKey(nextItem);
  const found = cart.find((item) => cartLineEquivalenceKey(item) === key);
  if (!found) return { cart: [...cart, nextItem], line: nextItem };
  const updatedLine = { ...found, qty: found.qty + qty };
  return {
    cart: cart.map((item) => (item.lineId === found.lineId ? updatedLine : item)),
    line: updatedLine,
  };
}

export function decrementCartLine(cart: CartItem[], lineId: string): CartItem[] {
  return cart.flatMap((item) =>
    item.lineId === lineId ? (item.qty <= 1 ? [] : [{ ...item, qty: item.qty - 1 }]) : [item],
  );
}

export function incrementCartLine(cart: CartItem[], lineId: string): CartItem[] {
  return cart.map((item) => (item.lineId === lineId ? { ...item, qty: item.qty + 1 } : item));
}
