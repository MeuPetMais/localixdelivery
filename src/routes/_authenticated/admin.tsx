import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { Building2, ShoppingBag, DollarSign, Activity, Loader2 } from "lucide-react";
import { getAdminMetrics, getRecentRestaurants } from "@/lib/admin.functions";
import { useIsAdmin } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Localix" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const navigate = useNavigate();
  const { isAdmin, isLoading: rolesLoading } = useIsAdmin(user.id);

  const metricsFn = useServerFn(getAdminMetrics);
  const recentFn = useServerFn(getRecentRestaurants);

  const { data: metrics, isLoading: mLoading } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-metrics"],
    queryFn: () => metricsFn(),
  });

  const { data: recent } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-recent-restaurants"],
    queryFn: () => recentFn(),
  });

  useEffect(() => {
    if (!rolesLoading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [rolesLoading, isAdmin, navigate]);

  if (rolesLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Painel do Administrador</h1>
        <p className="text-sm text-muted-foreground">Visão geral da plataforma Localix Delivery.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Estabelecimentos"
          value={mLoading ? "…" : String(metrics?.restaurantsTotal ?? 0)}
          icon={Building2}
        />
        <Metric
          title="Estabelecimentos ativos"
          value={mLoading ? "…" : String(metrics?.restaurantsActive ?? 0)}
          icon={Activity}
        />
        <Metric
          title="Pedidos realizados"
          value={mLoading ? "…" : String(metrics?.ordersTotal ?? 0)}
          icon={ShoppingBag}
        />
        <Metric
          title="Receita da plataforma"
          value={mLoading ? "…" : brl(metrics?.platformRevenue ?? 0)}
          icon={DollarSign}
          hint={metrics ? `GMV ${brl(metrics.gmv)}` : undefined}
        />
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Estabelecimentos recentes</h2>
          <Badge variant="secondary">{recent?.length ?? 0}</Badge>
        </div>
        <div className="divide-y">
          {(recent ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">/r/{r.slug}</p>
              </div>
              <Badge variant={r.is_open ? "default" : "outline"}>
                {r.is_open ? "Aberto" : "Fechado"}
              </Badge>
            </div>
          ))}
          {(recent?.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum estabelecimento cadastrado ainda.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
