import type { AnalyticsScope, DashboardSection, KpiValue } from "./types";
import { KpiCalculator } from "./KpiCalculator";

/** Pure builders that map already-computed domain metrics into KPI sections. */
export const DashboardBuilders = {
  executive(input: {
    revenue: number; profit: number; gmv: number; orders: number;
    activeCustomers: number; recurringCustomers: number;
    previous?: Partial<{ revenue: number; profit: number; gmv: number; orders: number; activeCustomers: number; recurringCustomers: number }>;
  }): DashboardSection {
    const p = input.previous ?? {};
    const scope: AnalyticsScope = "executive";
    const kpis: KpiValue[] = [
      KpiCalculator.build({ key: "gmv", label: "GMV", value: input.gmv, format: "currency", previous: p.gmv, scope }),
      KpiCalculator.build({ key: "revenue", label: "Receita", value: input.revenue, format: "currency", previous: p.revenue, scope }),
      KpiCalculator.build({ key: "profit", label: "Lucro", value: input.profit, format: "currency", previous: p.profit, scope }),
      KpiCalculator.build({ key: "orders", label: "Pedidos", value: input.orders, previous: p.orders, scope }),
      KpiCalculator.build({ key: "avg_ticket", label: "Ticket Médio", value: KpiCalculator.safeDiv(input.revenue, input.orders), format: "currency", scope }),
      KpiCalculator.build({ key: "active_customers", label: "Clientes Ativos", value: input.activeCustomers, previous: p.activeCustomers, scope }),
      KpiCalculator.build({ key: "recurring_customers", label: "Clientes Recorrentes", value: input.recurringCustomers, previous: p.recurringCustomers, scope }),
    ];
    return { id: "executive_kpis", title: "Executive KPIs", kpis };
  },

  operational(input: {
    orders: number; delivered: number; avgPrepMin: number; avgDeliveryMin: number; slaPct: number;
    previous?: Partial<{ orders: number; delivered: number; avgPrepMin: number; avgDeliveryMin: number; slaPct: number }>;
  }): DashboardSection {
    const p = input.previous ?? {};
    const scope: AnalyticsScope = "operations";
    const kpis: KpiValue[] = [
      KpiCalculator.build({ key: "orders", label: "Pedidos", value: input.orders, previous: p.orders, scope }),
      KpiCalculator.build({ key: "delivered", label: "Entregues", value: input.delivered, previous: p.delivered, scope }),
      KpiCalculator.build({ key: "conversion", label: "Conversão", value: KpiCalculator.safeDiv(input.delivered, input.orders) * 100, format: "percent", scope }),
      KpiCalculator.build({ key: "avg_prep", label: "Tempo Médio de Preparo", value: input.avgPrepMin, format: "duration", previous: p.avgPrepMin, scope }),
      KpiCalculator.build({ key: "avg_delivery", label: "Tempo Médio de Entrega", value: input.avgDeliveryMin, format: "duration", previous: p.avgDeliveryMin, scope }),
      KpiCalculator.build({ key: "sla", label: "SLA Operacional", value: input.slaPct, format: "percent", previous: p.slaPct, scope }),
    ];
    return { id: "operational_kpis", title: "Operações", kpis };
  },

  financial(input: {
    revenue: number; cmv: number; margin: number; receivables: number; payables: number;
    previous?: Partial<{ revenue: number; cmv: number; margin: number; receivables: number; payables: number }>;
  }): DashboardSection {
    const p = input.previous ?? {};
    const scope: AnalyticsScope = "financial";
    const kpis: KpiValue[] = [
      KpiCalculator.build({ key: "revenue", label: "Receita", value: input.revenue, format: "currency", previous: p.revenue, scope }),
      KpiCalculator.build({ key: "cmv", label: "CMV", value: input.cmv, format: "currency", previous: p.cmv, scope }),
      KpiCalculator.build({ key: "margin", label: "Margem", value: input.margin, format: "percent", previous: p.margin, scope }),
      KpiCalculator.build({ key: "receivables", label: "A Receber", value: input.receivables, format: "currency", scope }),
      KpiCalculator.build({ key: "payables", label: "A Pagar", value: input.payables, format: "currency", scope }),
    ];
    return { id: "financial_kpis", title: "Financeiro", kpis };
  },

  customer(input: {
    total: number; active: number; recurring: number; ltv: number; cac: number;
    previous?: Partial<{ total: number; active: number; recurring: number; ltv: number; cac: number }>;
  }): DashboardSection {
    const p = input.previous ?? {};
    const scope: AnalyticsScope = "customer";
    const kpis: KpiValue[] = [
      KpiCalculator.build({ key: "total_customers", label: "Total de Clientes", value: input.total, previous: p.total, scope }),
      KpiCalculator.build({ key: "active_customers", label: "Ativos", value: input.active, previous: p.active, scope }),
      KpiCalculator.build({ key: "recurring_customers", label: "Recorrentes", value: input.recurring, previous: p.recurring, scope }),
      KpiCalculator.build({ key: "ltv", label: "LTV", value: input.ltv, format: "currency", previous: p.ltv, scope }),
      KpiCalculator.build({ key: "cac", label: "CAC", value: input.cac, format: "currency", previous: p.cac, scope }),
    ];
    return { id: "customer_kpis", title: "Clientes", kpis };
  },

  product(input: {
    topSelling: Array<{ id: string; name?: string; qty: number }>;
    topProfitable: Array<{ id: string; name?: string; profit: number }>;
  }): DashboardSection {
    const scope: AnalyticsScope = "product";
    const kpis: KpiValue[] = [
      ...input.topSelling.slice(0, 5).map((p, i) =>
        KpiCalculator.build({ key: `top_selling_${i}`, label: `Mais Vendido: ${p.name ?? p.id}`, value: p.qty, scope })),
      ...input.topProfitable.slice(0, 5).map((p, i) =>
        KpiCalculator.build({ key: `top_profit_${i}`, label: `Mais Lucrativo: ${p.name ?? p.id}`, value: p.profit, format: "currency", scope })),
    ];
    return { id: "product_kpis", title: "Produtos", kpis };
  },

  delivery(input: {
    delivered: number; avgTimeMin: number; onTimePct: number; incidents: number;
    previous?: Partial<{ delivered: number; avgTimeMin: number; onTimePct: number; incidents: number }>;
  }): DashboardSection {
    const p = input.previous ?? {};
    const scope: AnalyticsScope = "delivery";
    return {
      id: "delivery_kpis", title: "Entregas",
      kpis: [
        KpiCalculator.build({ key: "delivered", label: "Entregues", value: input.delivered, previous: p.delivered, scope }),
        KpiCalculator.build({ key: "avg_time", label: "Tempo Médio", value: input.avgTimeMin, format: "duration", previous: p.avgTimeMin, scope }),
        KpiCalculator.build({ key: "on_time", label: "No Prazo", value: input.onTimePct, format: "percent", previous: p.onTimePct, scope }),
        KpiCalculator.build({ key: "incidents", label: "Incidentes", value: input.incidents, previous: p.incidents, scope }),
      ],
    };
  },

  inventory(input: {
    skus: number; lowStock: number; outOfStock: number; wastePct: number;
    previous?: Partial<{ skus: number; lowStock: number; outOfStock: number; wastePct: number }>;
  }): DashboardSection {
    const p = input.previous ?? {};
    const scope: AnalyticsScope = "inventory";
    return {
      id: "inventory_kpis", title: "Estoque",
      kpis: [
        KpiCalculator.build({ key: "skus", label: "SKUs", value: input.skus, previous: p.skus, scope }),
        KpiCalculator.build({ key: "low_stock", label: "Estoque Baixo", value: input.lowStock, previous: p.lowStock, scope }),
        KpiCalculator.build({ key: "out_of_stock", label: "Sem Estoque", value: input.outOfStock, previous: p.outOfStock, scope }),
        KpiCalculator.build({ key: "waste", label: "Perdas", value: input.wastePct, format: "percent", previous: p.wastePct, scope }),
      ],
    };
  },

  platform(input: {
    tenants: number; activeTenants: number; gmv: number; mrr: number; conversionPct: number;
    previous?: Partial<{ tenants: number; activeTenants: number; gmv: number; mrr: number; conversionPct: number }>;
  }): DashboardSection {
    const p = input.previous ?? {};
    const scope: AnalyticsScope = "platform";
    return {
      id: "platform_kpis", title: "Plataforma",
      kpis: [
        KpiCalculator.build({ key: "tenants", label: "Tenants", value: input.tenants, previous: p.tenants, scope }),
        KpiCalculator.build({ key: "active_tenants", label: "Ativos", value: input.activeTenants, previous: p.activeTenants, scope }),
        KpiCalculator.build({ key: "gmv", label: "GMV", value: input.gmv, format: "currency", previous: p.gmv, scope }),
        KpiCalculator.build({ key: "mrr", label: "MRR", value: input.mrr, format: "currency", previous: p.mrr, scope }),
        KpiCalculator.build({ key: "conversion", label: "Conversão", value: input.conversionPct, format: "percent", previous: p.conversionPct, scope }),
      ],
    };
  },
};
