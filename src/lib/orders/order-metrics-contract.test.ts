import { describe, expect, it } from "vitest";
import { ORDER_STATES, type OrderState } from "./OrderStateMachine";
import {
  ORDER_GROWTH_ELIGIBLE,
  ORDER_GROWTH_ELIGIBLE_STATUSES,
  ORDER_OPERATIONALLY_CONFIRMED_STATUSES,
  ORDER_REALIZED_METRICS_EXCLUDED_STATUSES,
  ORDER_STATUS_METRIC_CLASSIFICATION,
  classifyOrderForMetrics,
  isOrderGrowthEligible,
  isOrderOperationallyConfirmed,
  isOrderRealizedSaleEligible,
  shouldExcludeOrderFromRealizedMetrics,
} from "./order-metrics-contract";

const ALL_ORDER_STATUSES = [
  "novo",
  "aguardando_pagamento",
  "pago",
  "aceito",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "entregue",
  "concluido",
  "falha_pagamento",
  "cancelado",
  "rejeitado",
  "reembolsado",
  "chargeback",
] satisfies OrderState[];

const OPERATIONALLY_CONFIRMED_STATUSES = [
  "pago",
  "aceito",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "entregue",
  "concluido",
] satisfies OrderState[];

const GROWTH_ELIGIBLE_STATUSES = ["entregue", "concluido"] satisfies OrderState[];

describe("order metrics contract", () => {
  it("cobre todos os status existentes de pedidos", () => {
    expect(new Set(ALL_ORDER_STATUSES)).toEqual(new Set(ORDER_STATES));
    expect(Object.keys(ORDER_STATUS_METRIC_CLASSIFICATION).sort()).toEqual([...ORDER_STATES].sort());
  });

  it("classifica como confirmado operacionalmente apenas estados pos-pagamento aceitos pelo contrato", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(isOrderOperationallyConfirmed(status)).toBe(OPERATIONALLY_CONFIRMED_STATUSES.includes(status));
    }

    expect(ORDER_OPERATIONALLY_CONFIRMED_STATUSES).toEqual(OPERATIONALLY_CONFIRMED_STATUSES);
  });

  it("classifica somente entregue e concluido como venda realizada elegivel para Growth", () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(isOrderGrowthEligible(status)).toBe(GROWTH_ELIGIBLE_STATUSES.includes(status));
      expect(isOrderRealizedSaleEligible(status)).toBe(GROWTH_ELIGIBLE_STATUSES.includes(status));
    }

    expect(ORDER_GROWTH_ELIGIBLE_STATUSES).toEqual(GROWTH_ELIGIBLE_STATUSES);
    expect(ORDER_GROWTH_ELIGIBLE).toEqual(GROWTH_ELIGIBLE_STATUSES);
  });

  it("mantem pago como confirmado operacionalmente, mas fora de venda realizada", () => {
    expect(isOrderOperationallyConfirmed("pago")).toBe(true);
    expect(isOrderGrowthEligible("pago")).toBe(false);
    expect(shouldExcludeOrderFromRealizedMetrics("pago")).toBe(true);
    expect(classifyOrderForMetrics("pago")).toEqual({
      operationallyConfirmed: true,
      growthEligible: false,
      excludeFromRealizedMetrics: true,
    });
  });

  it("exclui das metricas realizadas qualquer status que nao seja venda realizada", () => {
    const excludedStatuses = ALL_ORDER_STATUSES.filter((status) => !GROWTH_ELIGIBLE_STATUSES.includes(status));

    for (const status of ALL_ORDER_STATUSES) {
      expect(shouldExcludeOrderFromRealizedMetrics(status)).toBe(excludedStatuses.includes(status));
    }

    expect(new Set(ORDER_REALIZED_METRICS_EXCLUDED_STATUSES)).toEqual(new Set(excludedStatuses));
  });

  it("trata status desconhecido como nao confirmado e excluido de metricas realizadas", () => {
    expect(classifyOrderForMetrics("pendente")).toEqual({
      operationallyConfirmed: false,
      growthEligible: false,
      excludeFromRealizedMetrics: true,
    });
    expect(isOrderOperationallyConfirmed(null)).toBe(false);
    expect(isOrderGrowthEligible(undefined)).toBe(false);
    expect(shouldExcludeOrderFromRealizedMetrics("")).toBe(true);
  });
});
