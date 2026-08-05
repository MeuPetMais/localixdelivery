import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Clock, Filter, LifeBuoy, Search, ShieldAlert, UserRoundCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
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
import { getAdminSupportQueue, listSupportTeam } from "@/lib/support-admin.functions";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  isSlaBreached,
  type SupportCategory,
  type SupportPriority,
  type LegacySupportStatus,
} from "@/lib/support-admin";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Admin - Suporte" }] }),
  component: AdminSupportPage,
});

type Filters = {
  status?: LegacySupportStatus;
  priority?: SupportPriority;
  category?: SupportCategory;
  assignedTo?: string | null;
  unassigned?: boolean;
  search?: string;
};

function AdminSupportPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!shouldRenderAdminSupportQueue(pathname)) {
    return <Outlet />;
  }

  return <AdminSupportQueuePage />;
}

export function shouldRenderAdminSupportQueue(pathname: string) {
  return pathname === "/admin/support";
}

function AdminSupportQueuePage() {
  const queue = useServerFn(getAdminSupportQueue);
  const teamFn = useServerFn(listSupportTeam);
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});

  const query = useQuery({
    queryKey: ["admin-support-queue", filters],
    queryFn: () => queue({ data: filters }),
    refetchInterval: 60_000,
  });

  const team = useQuery({
    queryKey: ["admin-support-team"],
    queryFn: () => teamFn(),
    retry: false,
  });

  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-support-queue"] });
    const channel = supabase
      .channel("admin-support-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, invalidate)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const tickets = query.data?.tickets ?? [];
  const metrics = query.data?.metrics;
  const teamOptions = team.data ?? [];

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== undefined && value !== "" && value !== false).length,
    [filters],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Central de suporte
          </h1>
          <p className="text-sm text-slate-400">Fila interna Localix para atendimento dos estabelecimentos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2 border-slate-700 text-slate-200">
            <Link to="/admin/support/team">
              <Users className="h-4 w-4" />
              Equipe
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2 border-slate-700 text-slate-200">
            <Link to="/admin/support/reports">
              <BarChart3 className="h-4 w-4" />
              Relatorios
            </Link>
          </Button>
          <Button variant="outline" className="gap-2 border-slate-700 text-slate-200" onClick={() => setFilters({})}>
            <Filter className="h-4 w-4" />
            Limpar filtros {activeFilterCount ? `(${activeFilterCount})` : ""}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total aberto" value={metrics?.totalOpen ?? 0} />
        <Metric label="Urgentes" value={metrics?.urgent ?? 0} tone="red" />
        <Metric label="Em atendimento" value={metrics?.inProgress ?? 0} />
        <Metric label="Aguardando cliente" value={metrics?.waitingCustomer ?? 0} tone="green" />
        <Metric label="Aguardando suporte" value={metrics?.waitingSupport ?? 0} tone="amber" />
        <Metric label="Resolvidos hoje" value={metrics?.resolvedToday ?? 0} />
        <Metric label="1a resposta media" value={`${metrics?.avgFirstResponseMinutes ?? 0} min`} />
        <Metric label="Resolucao media" value={`${metrics?.avgResolutionMinutes ?? 0} min`} />
      </div>

      <Card className="border-slate-800 bg-slate-900 p-3">
        <div className="grid gap-2 lg:grid-cols-[1.3fr_repeat(5,minmax(0,1fr))]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={filters.search ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value || undefined }))}
              placeholder="Buscar por numero, assunto ou estabelecimento"
              className="border-slate-700 bg-slate-950 pl-9 text-slate-100"
            />
          </div>
          <FilterSelect
            value={filters.status ?? "all"}
            placeholder="Status"
            options={SUPPORT_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }))}
            onChange={(value) => setFilters((current) => ({ ...current, status: value === "all" ? undefined : (value as LegacySupportStatus) }))}
          />
          <FilterSelect
            value={filters.priority ?? "all"}
            placeholder="Prioridade"
            options={SUPPORT_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABEL[value] }))}
            onChange={(value) => setFilters((current) => ({ ...current, priority: value === "all" ? undefined : (value as SupportPriority) }))}
          />
          <FilterSelect
            value={filters.category ?? "all"}
            placeholder="Categoria"
            options={SUPPORT_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] }))}
            onChange={(value) => setFilters((current) => ({ ...current, category: value === "all" ? undefined : (value as SupportCategory) }))}
          />
          <FilterSelect
            value={filters.unassigned ? "unassigned" : filters.assignedTo ?? "all"}
            placeholder="Responsavel"
            options={[
              { value: "unassigned", label: "Nao atribuido" },
              ...teamOptions.map((member) => ({ value: member.user_id, label: member.label })),
            ]}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                unassigned: value === "unassigned" || undefined,
                assignedTo: value === "all" || value === "unassigned" ? undefined : value,
              }))
            }
          />
          <Button variant="secondary" disabled={query.isFetching} onClick={() => query.refetch()}>
            Atualizar
          </Button>
        </div>
      </Card>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <div className="grid grid-cols-[120px_1.2fr_1fr_130px_120px_130px_150px] gap-3 border-b border-slate-800 bg-slate-800/50 px-4 py-3 text-xs font-semibold uppercase text-slate-400">
          <span>Chamado</span>
          <span>Assunto</span>
          <span>Estabelecimento</span>
          <span>Categoria</span>
          <span>Prioridade</span>
          <span>Status</span>
          <span>Responsavel</span>
        </div>
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando chamados...</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum chamado encontrado.</div>
        ) : (
          tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to="/admin/support/$ticketId"
              params={{ ticketId: ticket.id }}
              className="grid grid-cols-[120px_1.2fr_1fr_130px_120px_130px_150px] gap-3 border-b border-slate-800 px-4 py-3 text-sm transition last:border-0 hover:bg-slate-800/50"
            >
              <div>
                <div className="font-mono text-slate-100">#{ticket.ticket_number ?? "-"}</div>
                <WaitTime at={ticket.last_message_at} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-100">{ticket.subject}</div>
                <div className="truncate text-xs text-slate-400">{ticket.last_message_body ?? "Sem mensagens"}</div>
              </div>
              <div className="truncate text-slate-300">{ticket.restaurant_name}</div>
              <div className="text-slate-300">{CATEGORY_LABEL[ticket.category]}</div>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} breached={isSlaBreached(ticket)} />
              <div className="truncate text-slate-300">{ticket.assignee_label ?? "Nao atribuido"}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number | string; tone?: "slate" | "red" | "amber" | "green" }) {
  const toneClass =
    tone === "red" ? "text-red-300" : tone === "amber" ? "text-amber-300" : tone === "green" ? "text-emerald-300" : "text-slate-100";
  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </Card>
  );
}

function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PriorityBadge({ priority }: { priority: SupportPriority }) {
  const className =
    priority === "urgente"
      ? "border-red-500/30 bg-red-500/15 text-red-200"
      : priority === "alta"
        ? "border-orange-500/30 bg-orange-500/15 text-orange-200"
        : "border-slate-700 bg-slate-800 text-slate-200";
  return <Badge className={className}>{PRIORITY_LABEL[priority]}</Badge>;
}

function StatusBadge({ status, breached }: { status: LegacySupportStatus; breached: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Badge className="border-slate-700 bg-slate-800 text-slate-200">{STATUS_LABEL[status]}</Badge>
      {breached && !["resolvido", "fechado"].includes(status) && <ShieldAlert className="h-4 w-4 text-red-300" />}
      {status === "respondido" && <UserRoundCheck className="h-4 w-4 text-emerald-300" />}
    </div>
  );
}

function WaitTime({ at }: { at: string }) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 60_000));
  const label = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}min`;
  return (
    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
      <Clock className="h-3 w-3" />
      {label}
    </div>
  );
}
