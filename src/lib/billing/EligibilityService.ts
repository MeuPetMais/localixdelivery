// Billing Domain — Elegibilidade comercial.
// Regras: BD-008 (>= 600 pedidos/mês) e BD-009 (ticket >= R$20).

import type { EligibilityCriteria, EligibilityResult } from "./types";

const DEFAULT_CRITERIA: EligibilityCriteria = {
  minMonthlyOrders: 600,
  minTicket: 20,
};

export const EligibilityService = {
  criteria(): EligibilityCriteria {
    return DEFAULT_CRITERIA;
  },
  evaluate(input: { monthlyOrders: number; averageTicket: number }): EligibilityResult {
    const reasons: string[] = [];
    if (input.monthlyOrders < DEFAULT_CRITERIA.minMonthlyOrders) {
      reasons.push(`Volume mensal abaixo de ${DEFAULT_CRITERIA.minMonthlyOrders} pedidos.`);
    }
    if (input.averageTicket < DEFAULT_CRITERIA.minTicket) {
      reasons.push(`Ticket médio abaixo de R$ ${DEFAULT_CRITERIA.minTicket}.`);
    }
    return {
      eligible: reasons.length === 0,
      reasons,
      criteria: DEFAULT_CRITERIA,
      observed: input,
    };
  },
};
