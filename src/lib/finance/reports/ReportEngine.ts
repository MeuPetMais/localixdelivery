// ReportEngine — builds ReportResult from Finance Domain services.
import type {
  CashFlowService, ReceivablesService, PayablesService,
} from "../CashFlowService";
import type { FinancialDashboardService } from "../FinancialDashboardService";
import { resolvePeriod } from "../FinanceFilters";
import type { FinanceFilters, FinancePeriod } from "../types";
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

function resolveRange(filters?: Partial<FinanceFilters>): { period: FinancePeriod; from: string; to: string } {
  const period = (filters?.period ?? "month") as FinancePeriod;
  if (period === "custom" && filters?.from && filters?.to) {
    return { period, from: filters.from, to: filters.to };
  }
  return { period, ...resolvePeriod(period) };
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
    const { period, from, to } = resolveRange(input.filters);
    const filters: Record<string, unknown> = { ...(input.filters ?? {}), period, from, to };

    switch (input.type) {
      case "cashflow":    return this.cashflow(input.restaurantId, filters, from, to);
      case "receivables": return this.receivables(input.restaurantId, filters, from, to);
      case "payables":    return this.payables(input.restaurantId, filters, from, to);
      default:            return this.executiveSummary(input.restaurantId, input.type, filters);
    }
  }

  async compare(input: BuildInput): Promise<ComparativeResult<number>> {
    const { from, to } = resolveRange(input.filters);
    const prev = shiftPreviousPeriod(from, to);
    const baseFilters = (input.filters ?? {}) as Partial<FinanceFilters>;
    const [cur, previous] = await Promise.all([
      this.ports.dashboard.getExecutiveKPIs({ restaurantId: input.restaurantId, filters: { ...baseFilters, period: "custom", from, to } }),
      this.ports.dashboard.getExecutiveKPIs({ restaurantId: input.restaurantId, filters: { ...baseFilters, period: "custom", from: prev.from, to: prev.to } }),
    ]);
    return {
      current: cur.netRevenue,
      previous: previous.netRevenue,
      delta: cur.netRevenue - previous.netRevenue,
      deltaPct: pctDelta(cur.netRevenue, previous.netRevenue),
    };
  }

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
      columns: ["id", "gateway", "gross_amount", "net_amount", "expected_date", "status"],
      rows: s.items.map(r => ({
        id: r.id, gateway: r.gateway ?? "", gross_amount: r.gross_amount,
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
    const k = await this.ports.dashboard.getExecutiveKPIs({
      restaurantId,
      filters: filters as unknown as FinanceFilters,
    });
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
