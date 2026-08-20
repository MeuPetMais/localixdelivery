import { describe, expect, it } from "vitest";
import { getDashboardRealizedOrders, sumDashboardOrderTotals } from "./dashboard.functions";

describe("dashboard realized metrics", () => {
  it("usa somente entregue e concluido para metricas realizadas e financeiras", () => {
    const orders = [
      { id: "1", status: "aguardando_pagamento", total: 10 },
      { id: "2", status: "pago", total: 20 },
      { id: "3", status: "entregue", total: 30 },
      { id: "4", status: "concluido", total: 40 },
      { id: "5", status: "cancelado", total: 50 },
      { id: "6", status: "falha_pagamento", total: 60 },
      { id: "7", status: "reembolsado", total: 70 },
      { id: "8", status: "chargeback", total: 80 },
    ];

    const realizedOrders = getDashboardRealizedOrders(orders);

    expect(realizedOrders.map((order) => order.status)).toEqual(["entregue", "concluido"]);
    expect(sumDashboardOrderTotals(realizedOrders)).toBe(70);
  });
});
