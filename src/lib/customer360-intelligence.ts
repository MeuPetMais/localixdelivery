import type { Customer360ReadModel } from "@/lib/customer360";

export type Customer360InsightType =
  | "SECOND_PURCHASE_OPPORTUNITY"
  | "RECURRENCE_HEALTHY"
  | "AT_RISK"
  | "INACTIVE"
  | "REACTIVATED"
  | "HIGH_VALUE"
  | "LOYAL"
  | "FAVORITE_PRODUCT";

export type Customer360InsightSeverity = "info" | "success" | "warning" | "critical";

export type Customer360Insight = {
  type: Customer360InsightType;
  severity: Customer360InsightSeverity;
  title: string;
  description: string;
  evidence: Record<string, string | number | boolean | null>;
  recommended_action:
    | "ENCOURAGE_SECOND_PURCHASE"
    | "MAINTAIN_RECURRENCE"
    | "REACTIVATE_CUSTOMER"
    | "RETAIN_HIGH_VALUE"
    | "REWARD_LOYALTY"
    | "PROMOTE_FAVORITE_PRODUCT";
};

export function buildCustomer360Intelligence(model: Customer360ReadModel): Customer360Insight[] {
  const { lifecycle, metrics } = model;
  const insights: Customer360Insight[] = [];

  if (lifecycle === "AWAITING_SECOND_PURCHASE") {
    insights.push({
      type: "SECOND_PURCHASE_OPPORTUNITY",
      severity: "info",
      title: "Oportunidade de segunda compra",
      description: "O cliente fez a primeira compra recentemente e ainda não voltou.",
      evidence: {
        total_orders: metrics.total_orders,
        days_since_last_order: metrics.days_since_last_order,
      },
      recommended_action: "ENCOURAGE_SECOND_PURCHASE",
    });
  }

  if (lifecycle === "RECURRING") {
    insights.push({
      type: "RECURRENCE_HEALTHY",
      severity: "success",
      title: "Recorrência ativa",
      description: "O cliente já voltou a comprar e mantém comportamento recorrente.",
      evidence: {
        total_orders: metrics.total_orders,
        frequency_per_30d: metrics.frequency_per_30d,
      },
      recommended_action: "MAINTAIN_RECURRENCE",
    });
  }

  if (lifecycle === "AT_RISK") {
    insights.push({
      type: "AT_RISK",
      severity: "warning",
      title: "Cliente em risco de inatividade",
      description: "A recência ultrapassou o limite de atenção do Customer 360.",
      evidence: {
        days_since_last_order: metrics.days_since_last_order,
        total_orders: metrics.total_orders,
      },
      recommended_action: "REACTIVATE_CUSTOMER",
    });
  }

  if (lifecycle === "INACTIVE") {
    insights.push({
      type: "INACTIVE",
      severity: "critical",
      title: "Cliente inativo",
      description: "O cliente está há um período prolongado sem nova compra.",
      evidence: {
        days_since_last_order: metrics.days_since_last_order,
        total_orders: metrics.total_orders,
      },
      recommended_action: "REACTIVATE_CUSTOMER",
    });
  }

  if (lifecycle === "REACTIVATED") {
    insights.push({
      type: "REACTIVATED",
      severity: "success",
      title: "Cliente reativado",
      description: "O cliente voltou a comprar após um intervalo compatível com inatividade.",
      evidence: {
        days_since_last_order: metrics.days_since_last_order,
        total_orders: metrics.total_orders,
      },
      recommended_action: "MAINTAIN_RECURRENCE",
    });
  }

  if (lifecycle === "HIGH_VALUE") {
    insights.push({
      type: "HIGH_VALUE",
      severity: "success",
      title: "Cliente de alto valor",
      description: "O gasto acumulado atingiu o critério de alto valor definido no Customer 360.",
      evidence: {
        total_spent: metrics.total_spent,
        total_orders: metrics.total_orders,
        avg_ticket: metrics.avg_ticket,
      },
      recommended_action: "RETAIN_HIGH_VALUE",
    });
  }

  if (lifecycle === "LOYAL") {
    insights.push({
      type: "LOYAL",
      severity: "success",
      title: "Cliente fiel",
      description: "O volume de compras atingiu o critério de fidelidade do Customer 360.",
      evidence: {
        total_orders: metrics.total_orders,
        frequency_per_30d: metrics.frequency_per_30d,
      },
      recommended_action: "REWARD_LOYALTY",
    });
  }

  const favorite = metrics.favorite_products[0];
  if (favorite) {
    insights.push({
      type: "FAVORITE_PRODUCT",
      severity: "info",
      title: "Produto favorito identificado",
      description: favorite.name
        ? `${favorite.name} é o item mais recorrente no histórico realizado desse cliente.`
        : "Foi identificado um produto com maior recorrência no histórico realizado.",
      evidence: {
        product_id: favorite.product_id,
        product_name: favorite.name,
        quantity: favorite.qty,
      },
      recommended_action: "PROMOTE_FAVORITE_PRODUCT",
    });
  }

  return insights;
}
