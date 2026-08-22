import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ordersSource = readFileSync(new URL("./orders.functions.ts", import.meta.url), "utf8");
const ordersRouteSource = readFileSync(
  new URL("../../routes/_authenticated/orders.tsx", import.meta.url),
  "utf8",
);
const kitchenRouteSource = readFileSync(
  new URL("../../routes/_authenticated/kitchen.tsx", import.meta.url),
  "utf8",
);

const cancelFunction = ordersSource.slice(
  ordersSource.indexOf("export const cancelRestaurantOrder"),
);

describe("cancelamento pago com Mercado Pago refund", () => {
  it("pedido pago chama fluxo financeiro em vez de transitionOrderStatus direto", () => {
    expect(ordersSource).toContain("export const cancelRestaurantOrder");
    expect(cancelFunction).toContain("isApprovedMercadoPagoPayment(payment)");
    expect(cancelFunction).toContain("supabaseAdmin.functions.invoke(");
    expect(cancelFunction).toContain('"mp-payment-intent"');
    expect(cancelFunction).toContain('body: { action: "refund", order_id: data.orderId }');
    expect(cancelFunction).toContain('refund?.status !== "REFUNDED"');
    expect(cancelFunction).toContain('status: "reembolsado"');
  });

  it("pedido nao pago preserva cancelamento operacional normal", () => {
    expect(cancelFunction).toContain('to: "cancelado"');
    expect(cancelFunction).toContain('reason: "restaurant_cancelled"');
    expect(cancelFunction).toContain('service: "orders.cancelRestaurantOrder"');
  });

  it("painel parceiro nao chama cancelado direto no botao de cancelar", () => {
    expect(ordersRouteSource).toContain("cancelRestaurantOrder");
    expect(ordersRouteSource).toContain("async function cancelOrder(order: Order)");
    expect(ordersRouteSource).toContain("if (cancelingIds.has(order.id)) return");
    expect(ordersRouteSource).toContain("onCancel={canCancel ? () => cancelOrder(o) : undefined}");
    expect(ordersRouteSource).not.toContain(
      'onCancel={canCancel ? () => updateStatus(o.id, "cancelado") : undefined}',
    );
  });

  it("cozinha bloqueia duplo clique e usa cancelRestaurantOrder", () => {
    expect(kitchenRouteSource).toContain("cancelRestaurantOrder");
    expect(kitchenRouteSource).toContain("if (cancelingIds.has(o.id)) return");
    expect(kitchenRouteSource).toContain("disabled={cancelingIds.has(o.id)}");
    expect(kitchenRouteSource).toContain("await cancelWithRefund(o)");
    expect(kitchenRouteSource).not.toContain(
      'onClick={() => transitionOrderStatus({ data: { orderId: o.id, to: "cancelado" } })}',
    );
  });
});
