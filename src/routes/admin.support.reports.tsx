import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BarChart3, CalendarDays, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminSupportReports } from "@/lib/support-admin.functions";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  type SupportCategory,
  type SupportPriority,
} from "@/lib/support-admin";

export const Route = createFileRoute("/admin/support/reports")({
  head: () => ({ meta: [{ title: "Admin - Relatorios de suporte" }] }),
  component: SupportReportsPage,
});

type Filters = {
  from?: string;
  to?: string;
  category?: SupportCategory;
  priority?: SupportPriority;
};

function SupportReportsPage() {
  const reportsFn = useServerFn(getAdminSupportReports);
  const [filters, setFilters] = useState<Filters>(() => {
    const today = new Date();
    const from = new Date(today.getTime() - 29 * 24 * 3_600_000).toISOString().slice(0, 10);
    return { from, to: today.toISOString().slice(0, 10) };
  });

  const query = useQuery({
    queryKey: ["admin-support-reports", filters],
    queryFn: () => reportsFn({ data: filters }),
  });

  const report = query.data?.report;
  const topRestaurants = useMemo(() => topEntries(report?.byRestaurant ?? {}, 8), [report]);
  const topAgents = useMemo(() => Object.entries(report?.byAgent ?? {}).slice(0, 8), [report]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/support" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Voltar para fila
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatorios de suporte
          </h1>
          <p className="text-sm text-slate-400">{query.data?.ruleDescription ?? "Metricas de SLA, produtividade e demanda."}</p>
        </div>
        <Button variant="secondary" className="gap-2" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900 p-3">
        <div className="grid gap-2 md:grid-cols-5">
          <Field label="Inicio">
            <Input
              type="date"
              value={filters.from ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))}
              className="border-slate-700 bg-slate-950 text-slate-100"
            />
          </Field>
          <Field label="Fim">
            <Input
              type="date"
              value={filters.to ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))}
              className="border-slate-700 bg-slate-950 text-slate-100"
            />
          </Field>
          <Field label="Categoria">
            <Select value={filters.category ?? "all"} onValueChange={(value) => setFilters((current) => ({ ...current, category: value === "all" ? undefined : (value as SupportCategory) }))}>
              <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {SUPPORT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{CATEGORY_LABEL[category]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridade">
            <Select value={filters.priority ?? "all"} onValueChange={(value) => setFilters((current) => ({ ...current, priority: value === "all" ? undefined : (value as SupportPriority) }))}>
              <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {SUPPORT_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{PRIORITY_LABEL[priority]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end">
            <div className="flex h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
              <CalendarDays className="h-4 w-4" />
              {query.data?.settings.timezone ?? "America/Sao_Paulo"}
            </div>
          </div>
        </div>
      </Card>

      {query.isLoading || !report ? (
        <Card className="border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">Carregando relatorios...</Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Chamados" value={report.totalTickets} />
            <Metric label="1a resposta media" value={`${report.avgFirstResponseMinutes} min`} />
            <Metric label="Resolucao media" value={`${report.avgResolutionMinutes} min`} />
            <Metric label="Taxa de reabertura" value={`${report.reopenRate}%`} />
            <Metric label="SLA cumprido" value={report.slaMet} tone="green" />
            <Metric label="SLA vencido" value={report.slaBreached} tone="red" />
            <Metric label="Categorias" value={Object.keys(report.byCategory).length} />
            <Metric label="Estabelecimentos" value={Object.keys(report.byRestaurant).length} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="Chamados por periodo" rows={topEntries(report.byPeriod, 14)} />
            <Breakdown title="Chamados por categoria" rows={labelEntries(report.byCategory, CATEGORY_LABEL)} />
            <Breakdown title="Chamados por prioridade" rows={labelEntries(report.byPriority, PRIORITY_LABEL)} />
            <Breakdown title="Chamados por estabelecimento" rows={topRestaurants} />
          </div>

          <Card className="border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-100">Desempenho por atendente</div>
            <div className="overflow-hidden rounded-md border border-slate-800">
              <div className="grid grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] gap-3 bg-slate-800/60 px-3 py-2 text-xs font-semibold uppercase text-slate-400">
                <span>Atendente</span>
                <span>Atribuidos</span>
                <span>Resolvidos</span>
                <span>1a resposta</span>
                <span>Resolucao</span>
              </div>
              {topAgents.map(([agent, stats]) => (
                <div key={agent} className="grid grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] gap-3 border-t border-slate-800 px-3 py-2 text-sm text-slate-200">
                  <span className="truncate">{agent}</span>
                  <span>{stats.assigned}</span>
                  <span>{stats.resolved}</span>
                  <span>{stats.avgFirstResponseMinutes} min</span>
                  <span>{stats.avgResolutionMinutes} min</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number | string; tone?: "slate" | "green" | "red" }) {
  const toneClass = tone === "green" ? "text-emerald-300" : tone === "red" ? "text-red-300" : "text-slate-100";
  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </Card>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-100">{title}</div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-400">Sem dados no periodo.</div>
        ) : rows.map(([label, value]) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate text-slate-300">{label}</span>
              <span className="text-slate-100">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-800">
              <div className="h-full bg-primary" style={{ width: `${Math.max(6, (value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function topEntries(input: Record<string, number>, limit: number): Array<[string, number]> {
  return Object.entries(input).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function labelEntries<T extends string>(input: Record<string, number>, labels: Record<T, string>): Array<[string, number]> {
  return topEntries(input, 20).map(([key, value]) => [(labels as Record<string, string>)[key] ?? key, value]);
}
