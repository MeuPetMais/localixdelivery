import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Megaphone,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { getGrowthDashboardData } from "@/lib/growth-dashboard.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/growth")({
  head: () => ({ meta: [{ title: "Growth — Localix" }] }),
  component: GrowthPage,
});

type TabId = "overview" | "opportunities" | "campaigns" | "automation" | "results";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Visão Geral" },
  { id: "opportunities", label: "Oportunidades" },
  { id: "campaigns", label: "Campanhas" },
  { id: "automation", label: "Automações" },
  { id: "results", label: "Resultados" },
];

const LIFECYCLE_LABEL: Record<string, string> = {
  NEW: "Novo",
  AWAITING_SECOND_PURCHASE: "Aguardando 2ª compra",
  RECURRING: "Recorrente",
  HIGH_VALUE: "Alto valor",
  LOYAL: "Fiel",
  AT_RISK: "Em risco",
  INACTIVE: "Inativo",
  REACTIVATED: "Reativado",
};

const JOB_STATUS_LABEL: Record<string, string> = {
  BLOCKED_CONSENT: "Bloqueado · consentimento",
  BLOCKED_PROVIDER: "Bloqueado · provider",
  BLOCKED_FREQUENCY: "Bloqueado · frequência",
  READY: "Pronto",
  QUEUED: "Na fila",
  SENT: "Enviado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

function GrowthPage() {
  const restaurant = useRestaurant();
  const load = useServerFn(getGrowthDashboardData);
  const [tab, setTab] = useState<TabId>("overview");

  const { data, isLoading, isFetching, refetch } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["growth-dashboard", restaurant?.id],
    queryFn: () => load({ data: { restaurantId: restaurant.id } }),
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid min-h-[45vh] place-items-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const lc = data.customers.lifecycle_counts;
  const actionable =
    (lc.AWAITING_SECOND_PURCHASE ?? 0) +
    (lc.AT_RISK ?? 0) +
    (lc.INACTIVE ?? 0) +
    (lc.REACTIVATED ?? 0);
  const consentedWhatsApp = data.consent.by_channel.WHATSAPP?.granted ?? 0;
  const readyJobs = data.automation.status_counts.READY ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-extrabold">Localix Growth</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Transforme comportamento de compra em oportunidades de segunda compra,
            recorrência e reativação. Dados financeiros continuam autoritativos nos
            domínios de pedidos e pagamentos.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={isFetching}
          onClick={() => refetch().catch(() => toast.error("Falha ao atualizar Growth"))}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview
          totalCustomers={data.customers.total}
          actionable={actionable}
          recurring={lc.RECURRING ?? 0}
          atRisk={(lc.AT_RISK ?? 0) + (lc.INACTIVE ?? 0)}
          consentedWhatsApp={consentedWhatsApp}
          readyJobs={readyJobs}
          measurement={data.measurement}
          providers={data.automation.providers}
        />
      )}

      {tab === "opportunities" && (
        <Opportunities rows={data.customers.opportunities} />
      )}

      {tab === "campaigns" && (
        <Campaigns
          consent={data.consent}
          providers={data.automation.providers}
        />
      )}

      {tab === "automation" && (
        <Automation
          counts={data.automation.status_counts}
          jobs={data.automation.recent_jobs}
        />
      )}

      {tab === "results" && <Results measurement={data.measurement} />}
    </div>
  );
}

function Overview({
  totalCustomers,
  actionable,
  recurring,
  atRisk,
  consentedWhatsApp,
  readyJobs,
  measurement,
  providers,
}: any) {
  const providerCount = Object.values(providers).filter(Boolean).length;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Clientes mapeados" value={String(totalCustomers)} />
        <MetricCard icon={Sparkles} label="Oportunidades" value={String(actionable)} />
        <MetricCard icon={Activity} label="Recorrentes" value={String(recurring)} />
        <MetricCard icon={AlertTriangle} label="Em risco / inativos" value={String(atRisk)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Consentimento</h2>
          </div>
          <p className="mt-4 text-3xl font-extrabold">{consentedWhatsApp}</p>
          <p className="text-sm text-muted-foreground">
            clientes com consentimento vigente para WhatsApp.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Automação</h2>
          </div>
          <p className="mt-4 text-3xl font-extrabold">{readyJobs}</p>
          <p className="text-sm text-muted-foreground">jobs atualmente em estado READY.</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Canais ativos</h2>
          </div>
          <p className="mt-4 text-3xl font-extrabold">{providerCount}</p>
          <p className="text-sm text-muted-foreground">
            providers habilitados no ambiente atual.
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Funil de Growth medido</h2>
            <p className="text-sm text-muted-foreground">
              Atribuição analítica; não representa prova causal de incremento.
            </p>
          </div>
          <Link to="/customers" className="text-sm font-medium text-primary hover:underline">
            Abrir Customer 360 →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniMetric label="Oportunidades vistas" value={measurement.opportunity_views} />
          <MiniMetric label="Ações executadas" value={measurement.actions_executed} />
          <MiniMetric label="Pedidos atribuídos" value={measurement.attributed_orders} />
          <MiniMetric label="Valor atribuído" value={brl(measurement.attributed_order_total)} />
        </div>
      </Card>
    </div>
  );
}

function Opportunities({ rows }: { rows: any[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b p-5">
        <h2 className="font-semibold">Oportunidades prioritárias</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Priorização derivada do lifecycle canônico do Customer 360.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3">Pedidos</th>
              <th className="px-4 py-3">Total gasto</th>
              <th className="px-4 py-3">Última compra</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhuma oportunidade identificada neste momento.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.name || "Cliente sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{row.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{LIFECYCLE_LABEL[row.lifecycle] ?? row.lifecycle}</Badge>
                </td>
                <td className="px-4 py-3">{row.total_orders}</td>
                <td className="px-4 py-3 font-medium">{brl(row.total_spent)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.last_order_at ? new Date(row.last_order_at).toLocaleDateString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Campaigns({ consent, providers }: any) {
  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30 p-5">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h2 className="font-semibold">Campanhas ainda em modo controlado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O Localix não dispara campanhas automaticamente nesta fase. Um canal somente
              pode avançar quando houver consentimento explícito, provider comprovado,
              frequência permitida e sender idempotente.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(consent.by_channel).map(([channel, counts]: any) => (
          <Card key={channel} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{channel}</h3>
              <Badge variant={providers[channel] ? "default" : "outline"}>
                {providers[channel] ? "Provider ativo" : "Provider bloqueado"}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="Consentidos" value={counts.granted} />
              <MiniMetric label="Negados/revogados" value={counts.denied} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Automation({ counts, jobs }: { counts: Record<string, number>; jobs: any[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["READY", "BLOCKED_CONSENT", "BLOCKED_PROVIDER", "BLOCKED_FREQUENCY"].map((status) => (
          <MetricCard
            key={status}
            icon={status === "READY" ? CheckCircle2 : AlertTriangle}
            label={JOB_STATUS_LABEL[status]}
            value={String(counts[status] ?? 0)}
          />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b p-5">
          <h2 className="font-semibold">Jobs recentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A fila é server-side. Jobs bloqueados não podem ser enviados.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Criado</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum job de automação criado ainda.
                  </td>
                </tr>
              ) : jobs.map((job) => (
                <tr key={job.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{job.trigger_type}</td>
                  <td className="px-4 py-3">{job.channel}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{JOB_STATUS_LABEL[job.status] ?? job.status}</Badge>
                  </td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">{job.reason || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(job.created_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Results({ measurement }: { measurement: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BarChart3} label="Oportunidades vistas" value={String(measurement.opportunity_views)} />
        <MetricCard icon={Activity} label="Ações selecionadas" value={String(measurement.actions_selected)} />
        <MetricCard icon={CheckCircle2} label="Ações executadas" value={String(measurement.actions_executed)} />
        <MetricCard icon={Users} label="Clientes convertidos" value={String(measurement.customers_with_attributed_order)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Pedidos atribuídos</p>
          <p className="mt-1 text-3xl font-extrabold">{measurement.attributed_orders}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Valor de pedidos atribuídos</p>
          <p className="mt-1 text-3xl font-extrabold">{brl(measurement.attributed_order_total)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Action → Order</p>
          <p className="mt-1 text-3xl font-extrabold">
            {measurement.action_to_order_rate == null ? "—" : `${measurement.action_to_order_rate}%`}
          </p>
        </Card>
      </div>
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          Estes indicadores medem atribuição técnica no ledger do Growth. Eles não devem ser
          interpretados isoladamente como causalidade ou receita incremental comprovada.
        </p>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
