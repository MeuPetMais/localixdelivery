import { describe, it, expect } from "vitest";
import { parseStoredOrderItems } from "./stored-order-items";
describe("stored order JSON boundary", () => {
  it("preserves prices, quantities and builder selections", () => {
    const item = {
      id: "burger",
      name: "Burger",
      price: 19.9,
      qty: 2,
      kind: "builder",
      builderId: "b",
      selections: [{ group_id: "g", option_id: "o", qty: 1 }],
      addons: [{ name: "Cheese", total: 2 }],
      notes: "No salt",
    };
    expect(parseStoredOrderItems([item])).toEqual([item]);
    expect(parseStoredOrderItems([item]).reduce((sum, row) => sum + row.price * row.qty, 0)).toBe(
      39.8,
    );
  });
  it("ignores malformed JSON without inventing purchasable items", () => {
    expect(parseStoredOrderItems(null)).toEqual([]);
    expect(parseStoredOrderItems([null, "bad", {}, { name: "bad", price: "bad", qty: 1 }])).toEqual(
      [],
    );
  });
});

import { repeatStoredOrderItems } from "./stored-order-items";
import { normalizeCartItems } from "@/lib/cart/cart-lines";
import {
  renderCustomerReceipt,
  renderKitchenReceipt,
  type PrintableOrder,
} from "@/lib/print-service";
it("preserves a historical product with null builderId for display, subtotal, repeat and both receipts", async () => {
  const items = parseStoredOrderItems([
    { id: "burger", name: "Historical Burger", price: "25", qty: "2", builderId: null },
    { name: "invalid", price: "bad", qty: 1 },
  ]);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ name: "Historical Burger", price: 25, qty: 2, builderId: null });
  expect(items.reduce((sum, row) => sum + row.price * row.qty, 0)).toBe(50);
  expect(JSON.parse(JSON.stringify(repeatStoredOrderItems(items)))).toEqual([
    { id: "burger", name: "Historical Burger", price: 25, qty: 2, builderId: null },
  ]);
  expect(normalizeCartItems(JSON.parse(JSON.stringify(repeatStoredOrderItems(items))))).toEqual([
    expect.objectContaining({ id: "burger", name: "Historical Burger", price: 25, qty: 2 }),
  ]);
  const order: PrintableOrder = {
    order_number: 1,
    customer_name: "Customer",
    items,
    total: 50,
    created_at: "2026-11-09T15:00:00Z",
  };
  expect(await renderKitchenReceipt(order, "80mm")).toContain("Historical Burger");
  const receipt = await renderCustomerReceipt(order, "80mm");
  expect(receipt).toContain("Historical Burger");
  expect(receipt).toContain("50,00");
});
