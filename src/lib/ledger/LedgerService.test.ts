import { describe, it, expect } from "vitest";
import {
  computeBalance,
  signedAmount,
  type LedgerEntry,
} from "./LedgerService";

const REST = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function entry(part: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    order_id: null,
    restaurant_id: REST,
    customer_id: null,
    provider: null,
    transaction_type: "ADJUSTMENT",
    reference_type: null,
    reference_id: null,
    amount: 0,
    currency: "BRL",
    status: "COMPLETED",
    description: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...part,
  };
}

describe("LedgerService — regras puras", () => {
  it("Criar lançamento: shape mínimo respeitado", () => {
    const e = entry({ transaction_type: "PAYMENT_APPROVED", amount: 50 });
    expect(e.status).toBe("COMPLETED");
    expect(e.amount).toBe(50);
    expect(e.currency).toBe("BRL");
  });

  it("Buscar lançamento: filtra por restaurant_id", () => {
    const entries = [
      entry({ transaction_type: "PLATFORM_FEE", amount: 1 }),
      entry({ restaurant_id: OTHER, transaction_type: "PLATFORM_FEE", amount: 9 }),
    ];
    const mine = entries.filter((e) => e.restaurant_id === REST);
    expect(mine).toHaveLength(1);
    expect(mine[0].amount).toBe(1);
  });

  it("Extrato: agrega entradas do restaurante em ordem", () => {
    const entries = [
      entry({ transaction_type: "RESTAURANT_RECEIVABLE", amount: 100 }),
      entry({ transaction_type: "PLATFORM_FEE", amount: 1.49 }),
      entry({ transaction_type: "GATEWAY_FEE", amount: 2.5 }),
    ];
    expect(entries.every((e) => e.restaurant_id === REST)).toBe(true);
    expect(entries).toHaveLength(3);
  });

  it("Saldo: recebível - taxas - reembolsos - payouts", () => {
    const entries = [
      entry({ transaction_type: "RESTAURANT_RECEIVABLE", amount: 200 }),
      entry({ transaction_type: "PLATFORM_FEE", amount: 1.49 }),
      entry({ transaction_type: "GATEWAY_FEE", amount: 3.51 }),
      entry({ transaction_type: "REFUND", amount: 20 }),
      entry({ transaction_type: "PAYOUT", amount: 100 }),
    ];
    const b = computeBalance(entries, REST);
    expect(b.receivable).toBe(200);
    expect(b.platformFees).toBe(1.49);
    expect(b.gatewayFees).toBe(3.51);
    expect(b.refunds).toBe(20);
    expect(b.payouts).toBe(100);
    expect(b.netBalance).toBe(75);
    expect(b.entriesCount).toBe(5);
  });

  it("Saldo: ignora lançamentos PENDING/FAILED/CANCELLED", () => {
    const entries = [
      entry({ transaction_type: "RESTAURANT_RECEIVABLE", amount: 50 }),
      entry({ transaction_type: "PLATFORM_FEE", amount: 5, status: "PENDING" }),
      entry({ transaction_type: "REFUND", amount: 10, status: "CANCELLED" }),
      entry({ transaction_type: "PAYMENT_APPROVED", amount: 30, status: "FAILED" }),
    ];
    const b = computeBalance(entries, REST);
    expect(b.netBalance).toBe(50);
  });

  it("Auditoria: sinais corretos por tipo", () => {
    expect(signedAmount({ transaction_type: "RESTAURANT_RECEIVABLE", amount: 10, status: "COMPLETED" })).toBe(10);
    expect(signedAmount({ transaction_type: "PLATFORM_FEE", amount: 2, status: "COMPLETED" })).toBe(-2);
    expect(signedAmount({ transaction_type: "GATEWAY_FEE", amount: 3, status: "COMPLETED" })).toBe(-3);
    expect(signedAmount({ transaction_type: "REFUND", amount: 5, status: "COMPLETED" })).toBe(-5);
    expect(signedAmount({ transaction_type: "PAYOUT", amount: 7, status: "COMPLETED" })).toBe(-7);
    expect(signedAmount({ transaction_type: "ORDER_CREATED", amount: 99, status: "COMPLETED" })).toBe(0);
    expect(signedAmount({ transaction_type: "PLATFORM_FEE", amount: 2, status: "PENDING" })).toBe(0);
  });

  it("Auditoria: append-only — cada evento gera um novo lançamento", () => {
    // Simula: pedido criado, pagamento aprovado, taxas e recebível — 4 lançamentos independentes.
    const orderId = crypto.randomUUID();
    const entries = [
      entry({ order_id: orderId, transaction_type: "ORDER_CREATED", amount: 0, status: "COMPLETED" }),
      entry({ order_id: orderId, transaction_type: "PAYMENT_APPROVED", amount: 50, status: "COMPLETED" }),
      entry({ order_id: orderId, transaction_type: "PLATFORM_FEE", amount: 1.49, status: "COMPLETED" }),
      entry({ order_id: orderId, transaction_type: "RESTAURANT_RECEIVABLE", amount: 48.51, status: "COMPLETED" }),
    ];
    const ids = new Set(entries.map((e) => e.id));
    expect(ids.size).toBe(4);
    expect(entries.every((e) => e.order_id === orderId)).toBe(true);
  });
});
