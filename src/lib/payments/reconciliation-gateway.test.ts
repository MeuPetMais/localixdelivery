import { describe, it, expect } from "vitest";
import { gatewayFromStoredPayment } from "./reconciliation-gateway";
describe("reconciliation stored gateway adapter", () => {
  it("preserves stored amount and explicit reference without treating the intent ID as JSON", () => {
    expect(
      gatewayFromStoredPayment(
        {
          payment_id: "123",
          external_reference: "stored-order",
          transaction_amount: 51.25,
          payment_intent: "pi_123",
        },
        "fallback",
      ),
    ).toEqual({
      id: "123",
      external_reference: "stored-order",
      transaction_amount: 51.25,
      currency_id: "BRL",
      fee_details: null,
      net_received_amount: null,
      status: null,
    });
  });
  it("uses the order reference fallback and requires a payment ID", () => {
    expect(
      gatewayFromStoredPayment(
        {
          payment_id: "123",
          external_reference: null,
          transaction_amount: 50,
          payment_intent: null,
        },
        "order",
      ),
    ).toEqual({
      id: "123",
      external_reference: "order",
      transaction_amount: 50,
      currency_id: "BRL",
      fee_details: null,
      net_received_amount: null,
      status: null,
    });
    expect(gatewayFromStoredPayment(null, "order")).toBeNull();
  });
});
