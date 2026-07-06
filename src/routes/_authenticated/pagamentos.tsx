import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Shield, XCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { PaymentService } from "@/lib/payments/PaymentService";
import { StripeConnectCard } from "@/components/payments/StripeConnectCard";

type Search = {
  mp?: "success" | "error";
  reason?: string;
  stripe?: "success" | "refresh";
};

export const Route = createFileRoute("/_authenticated/pagamentos")({
  validateSearch: (s): Search => ({
    mp: s.mp === "success" || s.mp === "error" ? s.mp : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
    stripe: s.stripe === "success" || s.stripe === "refresh" ? s.stripe : undefined,
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const restaurant = useRestaurant();
  const restaurantId = restaurant?.id ?? null;
  const search = useSearch({ from: Route.id }) as Search;
  const qc = useQueryClient();

  useEffect(() => {
    if (search.mp === "success") toast.success("Mercado Pago conectado com sucesso!");
    if (search.mp === "error") toast.error(`Falha ao conectar Mercado Pago${search.reason ? `: ${search.reason}` : ""}`);
  }, [search.mp, search.reason]);

  const statusQuery = useQuery({
    queryKey: ["mp-status", restaurantId],
    enabled: !!restaurantId,
    queryFn: () => PaymentService.connectionStatus("mercado_pago", restaurantId!),
    refetchOnWindowFocus: false,
  });

  const connect = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      return PaymentService.connect("mercado_pago", restaurantId, "/pagamentos?mp=success");
    },
    onSuccess: ({ authorizeUrl }) => {
      window.location.href = authorizeUrl;
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível iniciar a conexão"),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      await PaymentService.disconnect("mercado_pago", restaurantId);
    },
    onSuccess: () => {
      toast.success("Conta Mercado Pago desconectada");
      qc.invalidateQueries({ queryKey: ["mp-status", restaurantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao desconectar"),
  });

  const s = statusQuery.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Pagamentos</h1>
        <p className="text-sm text-muted-foreground">
          Conecte sua conta do gateway para receber pagamentos diretamente no seu CNPJ.
        </p>
      </header>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00b1ea]/10 text-[#00b1ea]">
              MP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Mercado Pago</h2>
                <StatusBadge loading={statusQuery.isLoading} connected={s?.connected} />
              </div>
              <p className="text-xs text-muted-foreground">
                Pix e cartão. Split de plataforma será ativado em uma etapa futura.
              </p>
            </div>
          </div>

          {s?.connected ? (
            <Button
              variant="outline"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desconectar"}
            </Button>
          ) : (
            <Button onClick={() => connect.mutate()} disabled={connect.isPending || !restaurantId}>
              {connect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Conectar Mercado Pago <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>

        {s?.connected && (
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Conta MP" value={s.accountId ?? "—"} />
            <Info label="Modo" value={s.liveMode ? "Produção" : "Sandbox"} />
            <Info label="Escopos" value={s.scope ?? "—"} />
            <Info label="Conectado em" value={fmt(s.connectedAt)} />
            <Info label="Token expira em" value={fmt(s.expiresAt)} />
          </dl>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-3 text-xs text-muted-foreground">
          <Shield className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Os tokens de acesso ficam criptografados no backend e nunca são expostos ao navegador.
            Toda comunicação com o Mercado Pago passa por funções seguras do servidor.
          </p>
        </div>
      </Card>

      <StripeConnectCard restaurantId={restaurantId} urlParam={search.stripe} />

      <Card className="p-6">
        <h3 className="font-semibold">Outros gateways</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagar.me e Asaas estarão disponíveis em breve — a plataforma já está preparada para
          suportar múltiplos provedores sem alteração no checkout.
        </p>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function StatusBadge({ loading, connected }: { loading: boolean; connected?: boolean }) {
  if (loading) return <Badge variant="secondary">Verificando…</Badge>;
  if (connected)
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-500">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
      </Badge>
    );
  return (
    <Badge variant="outline">
      <XCircle className="mr-1 h-3 w-3" /> Não conectado
    </Badge>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}
