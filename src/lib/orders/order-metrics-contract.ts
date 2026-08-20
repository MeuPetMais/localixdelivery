import { ORDER_STATES, type OrderState } from "./OrderStateMachine";

export type OrderMetricClassification = {
  operationallyConfirmed: boolean;
  growthEligible: boolean;
  excludeFromRealizedMetrics: boolean;
};

export const ORDER_STATUS_METRIC_CLASSIFICATION: Record<OrderState, OrderMetricClassification> = {
  novo: {
    operationallyConfirmed: false,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  aguardando_pagamento: {
    operationallyConfirmed: false,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  pago: {
    operationallyConfirmed: true,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  falha_pagamento: {
    operationallyConfirmed: false,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  aceito: {
    operationallyConfirmed: true,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  rejeitado: {
    operationallyConfirmed: false,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  em_preparo: {
    operationallyConfirmed: true,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  pronto: {
    operationallyConfirmed: true,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  saiu_para_entrega: {
    operationallyConfirmed: true,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  entregue: {
    operationallyConfirmed: true,
    growthEligible: true,
    excludeFromRealizedMetrics: false,
  },
  concluido: {
    operationallyConfirmed: true,
    growthEligible: true,
    excludeFromRealizedMetrics: false,
  },
  cancelado: {
    operationallyConfirmed: false,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  reembolsado: {
    operationallyConfirmed: false,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
  chargeback: {
    operationallyConfirmed: false,
    growthEligible: false,
    excludeFromRealizedMetrics: true,
  },
} as const;

export const ORDER_OPERATIONALLY_CONFIRMED_STATUSES = ORDER_STATES.filter(
  (status) => ORDER_STATUS_METRIC_CLASSIFICATION[status].operationallyConfirmed,
);

export const ORDER_GROWTH_ELIGIBLE_STATUSES = ORDER_STATES.filter(
  (status) => ORDER_STATUS_METRIC_CLASSIFICATION[status].growthEligible,
);

export const ORDER_REALIZED_METRICS_EXCLUDED_STATUSES = ORDER_STATES.filter(
  (status) => ORDER_STATUS_METRIC_CLASSIFICATION[status].excludeFromRealizedMetrics,
);

export const ORDER_GROWTH_ELIGIBLE = ORDER_GROWTH_ELIGIBLE_STATUSES;

const ORDER_STATE_SET = new Set<string>(ORDER_STATES);

export function isOrderState(status: unknown): status is OrderState {
  return typeof status === "string" && ORDER_STATE_SET.has(status);
}

export function classifyOrderForMetrics(status: unknown): OrderMetricClassification {
  if (!isOrderState(status)) {
    return {
      operationallyConfirmed: false,
      growthEligible: false,
      excludeFromRealizedMetrics: true,
    };
  }

  return ORDER_STATUS_METRIC_CLASSIFICATION[status];
}

export function isOrderOperationallyConfirmed(status: unknown): status is OrderState {
  return classifyOrderForMetrics(status).operationallyConfirmed;
}

export function isOrderGrowthEligible(status: unknown): status is OrderState {
  return classifyOrderForMetrics(status).growthEligible;
}

export function isOrderRealizedSaleEligible(status: unknown): status is OrderState {
  return isOrderGrowthEligible(status);
}

export function shouldExcludeOrderFromRealizedMetrics(status: unknown): boolean {
  return classifyOrderForMetrics(status).excludeFromRealizedMetrics;
}
