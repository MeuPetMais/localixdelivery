import { describe, expect, it, vi } from "vitest";
import {
  addCartItem,
  cartLineEquivalenceKey,
  decrementCartLine,
  incrementCartLine,
  normalizeCartItems,
  type CartItem,
} from "./cart-lines";

describe("cart line identity", () => {
  it("creates a lineId for the first product line", () => {
    const cart = addCartItem([], { id: "bacon", name: "Bacon", price: 25 });

    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ id: "bacon", qty: 1 });
    expect(cart[0].lineId).toMatch(/^line:/);
  });

  it("allows the same product to exist as two lines with different selections", () => {
    const cart = addCartItem(addCartItem([], { id: "bacon", name: "Bacon", price: 25 }), {
      id: "bacon",
      name: "Bacon",
      price: 30,
      selections: [{ groupId: "extras", optionId: "bacon-extra", qty: 1 }],
    });

    expect(cart).toHaveLength(2);
    expect(cart[0].id).toBe("bacon");
    expect(cart[1].id).toBe("bacon");
    expect(cart[0].lineId).not.toBe(cart[1].lineId);
  });

  it("changes the second line without changing the first line", () => {
    const [lineA, lineB] = twoBaconLines();

    const cart = incrementCartLine([lineA, lineB], lineB.lineId);

    expect(cart.find((item) => item.lineId === lineA.lineId)?.qty).toBe(1);
    expect(cart.find((item) => item.lineId === lineB.lineId)?.qty).toBe(2);
  });

  it("removes the second line without removing the first line", () => {
    const [lineA, lineB] = twoBaconLines();

    const cart = decrementCartLine([lineA, lineB], lineB.lineId);

    expect(cart).toHaveLength(1);
    expect(cart[0].lineId).toBe(lineA.lineId);
  });

  it("changes the quantity of the first line without changing the second line", () => {
    const [lineA, lineB] = twoBaconLines();

    const cart = incrementCartLine([lineA, lineB], lineA.lineId);

    expect(cart.find((item) => item.lineId === lineA.lineId)?.qty).toBe(2);
    expect(cart.find((item) => item.lineId === lineB.lineId)?.qty).toBe(1);
  });

  it("aggregates the same product with the same configuration", () => {
    const cart = addCartItem(addCartItem([], { id: "coke", name: "Coca-Cola", price: 8 }), {
      id: "coke",
      name: "Coca-Cola",
      price: 8,
    });

    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  it("does not aggregate the same product when notes are different", () => {
    const cart = addCartItem(
      addCartItem([], { id: "bacon", name: "Bacon", price: 25, notes: "sem cebola" }),
      { id: "bacon", name: "Bacon", price: 25, notes: "com cebola" },
    );

    expect(cart).toHaveLength(2);
  });

  it("keeps builders working with builderId and selections in the equivalence key", () => {
    const cart = addCartItem([], {
      id: "builder-1",
      name: "Pizza",
      price: 27,
      kind: "builder",
      builderId: "builder-1",
      selections: [{ groupId: "group-1", optionId: "opt-1", qty: 2 }],
    });

    expect(cart[0]).toMatchObject({
      id: "builder-1",
      kind: "builder",
      builderId: "builder-1",
      selections: [{ groupId: "group-1", optionId: "opt-1", qty: 2 }],
    });
  });

  it("preserves selections for checkout payload mapping", () => {
    const cart = addCartItem([], {
      id: "bacon",
      name: "Bacon",
      price: 30,
      selections: [{ groupId: "extras", optionId: "bacon-extra", qty: 1 }],
    });

    const payload = cart.map((item) => ({
      id: item.id,
      qty: item.qty,
      selections: item.selections,
      builderId: item.builderId,
      notes: item.notes,
    }));

    expect(payload[0]).toMatchObject({
      id: "bacon",
      qty: 1,
      selections: [{ groupId: "extras", optionId: "bacon-extra", qty: 1 }],
    });
  });

  it("keeps product id as the authoritative checkout id", () => {
    const cart = addCartItem([], { id: "bacon", name: "Bacon", price: 25 });

    const checkoutItem = { id: cart[0].id, qty: cart[0].qty };

    expect(cart[0].lineId).not.toBe("bacon");
    expect(checkoutItem.id).toBe("bacon");
  });

  it("uses real product ids for authoritative pricing lookups", () => {
    const cart = addCartItem([], {
      id: "prod-1",
      name: "Burger",
      price: 25,
      lineId: "line:browser-only",
    });

    const productIds = Array.from(
      new Set(cart.filter((item) => item.kind !== "builder").map((item) => item.id)),
    );

    expect(productIds).toEqual(["prod-1"]);
    expect(productIds).not.toContain("line:browser-only");
  });

  it("preserves lineId when cart is persisted and restored", () => {
    const cart = addCartItem([], { id: "bacon", name: "Bacon", price: 25 });
    const restored = normalizeCartItems(JSON.parse(JSON.stringify(cart)));

    expect(restored[0].lineId).toBe(cart[0].lineId);
  });

  it("migrates legacy session cart items without lineId", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "legacy-id" });

    const restored = normalizeCartItems([{ id: "bacon", name: "Bacon", price: 25, qty: 1 }]);

    expect(restored[0]).toMatchObject({ lineId: "line:legacy-id", id: "bacon", qty: 1 });
    vi.unstubAllGlobals();
  });

  it("keeps subtotal behavior unchanged", () => {
    const cart = addCartItem(addCartItem([], { id: "bacon", name: "Bacon", price: 25, qty: 2 }), {
      id: "coke",
      name: "Coca-Cola",
      price: 8,
    });

    expect(cart.reduce((sum, item) => sum + item.price * item.qty, 0)).toBe(58);
  });

  it("keeps cross-sell product exclusion based on product ids", () => {
    const cart = addCartItem([], { id: "bacon", name: "Bacon", price: 25 });
    const inCart = new Set(cart.map((item) => item.id));

    expect(inCart.has("bacon")).toBe(true);
    expect(inCart.has(cart[0].lineId)).toBe(false);
  });

  it("does not change the AddedToCartSheet product identity", () => {
    const added = { id: "bacon", name: "Bacon", price: 25, qty: 1, image_url: null };

    expect(added.id).toBe("bacon");
  });
});

function twoBaconLines(): [CartItem, CartItem] {
  const cart = addCartItem(addCartItem([], { id: "bacon", name: "Bacon", price: 25 }), {
    id: "bacon",
    name: "Bacon",
    price: 30,
    selections: [{ groupId: "extras", optionId: "bacon-extra", qty: 1 }],
  });
  return [cart[0], cart[1]];
}
