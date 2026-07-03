// ReportEngine — builds ReportResult from Finance Domain services.
// Never touches the DB directly; consumes CashFlowService,
// ReceivablesService, PayablesService and FinancialDashboardService
// (which in turn wrap LedgerService, CostEngine, etc).

import type {
  CashFlowService, ReceivablesService, PayablesService,
} from "../CashFlowService";
import type { FinancialDashboardService } from "../FinancialDashboardService";
import { resolvePeriod } from "../FinanceFilters";
import type { FinanceFilters } from "../types";
import type { ComparativeResult, ReportResult, ReportType } from "./types";

export interface ReportEnginePorts {
  dashboard: FinancialDashboardService;
  cashflow: CashFlowService;
  receivables: ReceivablesService;
  payables: PayablesService;
}

export interface BuildInput {
  restaurantId: string;
  type: ReportType;
  filters?: Partial<FinanceFilters>;
}

function nowIso() { return new Date().toISOString(); }

function pctDelta(cur: number, prev: number): number {
  if (!prev) return cur ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function shiftPreviousPeriod(from: string, to: string): { from: string; to: string } {
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  const span = Math.max(1, t - f);
  return {
    from: new Date(f - span).toISOString(),
    to: new Date(t - span).toISOString(),
  };
}

export class ReportEngine {
  constructor(private readonly ports: ReportEnginePorts) {}

  async build(input: BuildInput): Promise<ReportResult> {
    const { period, from, to } = resolvePeriod(input.filters?.period ?? "month", input.filters);
    const filters = { ...(input.filters ?? {}), period, from, to } as Record<string, unknown>;

    switch (input.type) {
      case "cashflow":       return this.cashflow(input.restaurantId, filters, from, to);
      case "receivables":    return this.receivables(input.restaurantId, filters, from, to);
      case "payables":       return this.payables(input.restaurantId, filters, from, to);
      case "dre":
      case "profitability":
      case "executive_ceo":
      case "executive_finance":
      case "ledger":
      case "split":
      case "reconciliation":
      case "orders":
      case "products":
      case "customers":
      case "delivery":
      case "inventory":
      case "production":
      case "purchasing":
      case "top_products":
      case "top_categories":
      case "top_customers":
      case "peak_hours":
      case "top_gateway":
      case "executive_operations":
      case "executive_production":
      case "executive_purchasing":
      default:
        return this.executiveSummary(input.restaurantId, input.type, filters);
    }
  }

  async compare(input: BuildInput): Promise<ComparativeResult<number>> {
    const { from, to } = resolvePeriod(input.filters?.period ?? "month", input.filters);
    const prev = shiftPreviousPeriod(from, to);
    const [cur, previous] = await Promise.all([
      this.ports.dashboard.getExecutiveKPIs({ restaurantId: input.restaurantId, filters: { ...input.filters, from, to } as FinanceFilters }),
      this.ports.dashboard.getExecutiveKPIs({ restaurantId: input.restaurantId, filters: { ...input.filters, from: prev.from, to: prev.to } as FinanceFilters }),
    ]);
    return {
      current: cur.netRevenue,
      previous: previous.netRevenue,
      delta: cur.netRevenue - previous.netRevenue,
      deltaPct: pctDelta(cur.netRevenue, previous.netRevenue),
    };
  }

  // ---------- Builders ----------

  private async cashflow(restaurantId: string, filters: Record<string, unknown>, from: string, to: string): Promise<ReportResult> {
    const s = await this.ports.cashflow.getSummary({ restaurantId, from, to });
    return {
      type: "cashflow", title: "Fluxo de Caixa", generatedAt: nowIso(), filters,
      columns: ["date", "inflow", "outflow", "net", "runningBalance"],
      rows: s.timeline.map(p => ({ ...p })),
      totals: { inflow: s.period.inflow, outflow: s.period.outflow, net: s.period.net, balance: s.balance },
    };
  }

  private async receivables(restaurantId: string, filters: Record<string, unknown>, from: string, to: string): Promise<ReportResult> {
    const s = await this.ports.receivables.getSummary({ restaurantId, from, to });
    return {
      type: "receivables", title: "Recebimentos", generatedAt: nowIso(), filters,
      columns: ["id", "description", "gross_amount", "net_amount", "expected_date", "status"],
      rows: s.items.map(r => ({
        id: r.id, description: r.description ?? "", gross_amount: r.gross_amount,
        net_amount: r.net_amount, expected_date: r.expected_date ?? "", status: r.status,
      })),
      totals: { pending: s.pending, received: s.received, overdue: s.overdue, next7: s.next7, next30: s.next30 },
    };
  }

  private async payables(restaurantId: string, filters: Record<string, unknown>, from: string, to: string): Promise<ReportResult> {
    const s = await this.ports.payables.getSummary({ restaurantId, from, to });
    return {
      type: "payables", title: "Pagamentos", generatedAt: nowIso(), filters,
      columns: ["id", "description", "amount", "paid_amount", "due_date", "status"],
      rows: s.items.map(p => ({
        id: p.id, description: p.description ?? "", amount: p.amount,
        paid_amount: p.paid_amount ?? 0, due_date: p.due_date ?? "", status: p.status,
      })),
      totals: { open: s.open, paid: s.paid, overdue: s.overdue, next7: s.next7, next30: s.next30 },
    };
  }

  private async executiveSummary(restaurantId: string, type: ReportType, filters: Record<string, unknown>): Promise<ReportResult> {
    const k = await this.ports.dashboard.getExecutiveKPIs({ restaurantId, filters: filters as FinanceFilters });
    return {
      type, title: titleFor(type), generatedAt: nowIso(), filters,
      columns: ["metric", "value"],
      rows: [
        { metric: "Receita bruta",     value: k.grossRevenue },
        { metric: "Receita líquida",   value: k.netRevenue },
        { metric: "Lucro bruto",       value: k.grossProfit },
        { metric: "Lucro líquido",     value: k.netProfit },
        { metric: "CMV",               value: k.cmv },
        { metric: "Margem (%)",        value: Number(k.marginPct.toFixed(2)) },
        { metric: "Pedidos",           value: k.orders },
        { metric: "Ticket médio",      value: k.averageTicket },
        { metric: "Saldo atual",       value: k.currentBalance },
        { metric: "A receber",         value: k.pendingReceivables },
        { metric: "A pagar",           value: k.pendingPayables },
      ],
      totals: { netRevenue: k.netRevenue, netProfit: k.netProfit, marginPct: k.marginPct },
    };
  }
}

const TITLES: Partial<Record<ReportType, string>> = {
  cashflow: "Fluxo de Caixa", dre: "DRE Simplificado", profitability: "Lucratividade",
  receivables: "Recebimentos", payables: "Pagamentos", split: "Split", ledger: "Ledger",
  reconciliation: "Conciliação", orders: "Pedidos", products: "Produtos", customers: "Clientes",
  delivery: "Delivery", inventory: "Estoque", production: "Produção", purchasing: "Compras",
  top_products: "Produtos mais lucrativos", top_categories: "Categorias mais lucrativas",
  top_customers: "Clientes mais rentáveis", peak_hours: "Horário de maior faturamento",
  top_gateway: "Gateway mais utilizado", executive_ceo: "Executivo CEO",
  executive_finance: "Executivo Financeiro", executive_operations: "Executivo Operação",
  executive_production: "Executivo Produção", executive_purchasing: "Executivo Compras",
};
function titleFor(t: ReportType): string { return TITLES[t] ?? "Relatório"; }
