import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Shield, XCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StripeService } from "@/lib/stripe";
import type { StripeConnectAccountSnapshot } from "@/lib/stripe/StripeConnectService";

interface Props {
  restaurantId: string | null;
  urlParam?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  not_created: "Não conectado",
  onboarding_pending: "Documentação pendente",
  active: "Conta ativa",
  restricted: "Em análise",
  rejected: "Rejeitada",
  disabled: "Desativada",
};

export function StripeConnectCard({ restaurantId, urlParam }: Props) {
  const qc = useQueryClient();

  const statusQuery = useQuery<StripeConnectAccountSnapshot>({
    queryKey: ["stripe-connect", restaurantId],
    enabled: !!restaurantId,
    queryFn: () => StripeService.connect.refreshAccount(restaurantId!),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (urlParam === "success") {
      toast.success("Stripe conectado — sincronizando dados...");
      qc.invalidateQueries({ queryKey: ["stripe-connect", restaurantId] });
    }
    if (urlParam === "refresh") {
      toast.message("Continue o cadastro na Stripe");
    }
  }, [urlParam, qc, restaurantId]);

  const connect = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      return StripeService.connect.createExpressAccount(restaurantId);
    },
    onSuccess: ({ onboardingUrl }) => {
      window.location.href = onboardingUrl;
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar Stripe"),
  });

  const relink = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      return StripeService.connect.createAccountLink(restaurantId);
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar link"),
  });

  const refresh = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      return StripeService.connect.refreshAccount(restaurantId);
    },
    onSuccess: () => {
      toast.success("Dados sincronizados com a Stripe");
      qc.invalidateQueries({ queryKey: ["stripe-connect", restaurantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao sincronizar"),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      await StripeService.connect.disconnectAccount(restaurantId);
    },
    onSuccess: () => {
      toast.success("Conta Stripe desconectada");
      qc.invalidateQueries({ queryKey: ["stripe-connect", restaurantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao desconectar"),
  });

  const s = statusQuery.data;
  const status = s?.status ?? "not_created";
  const connected = !!s?.accountId && status !== "not_created";


  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#635BFF]/10 text-[#635BFF] font-semibold">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Stripe Connect</h2>
              <StatusBadge loading={statusQuery.isLoading} status={status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Gateway oficial de pagamentos da Localix. Recebimentos diretamente no CNPJ do parceiro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!connected && (
            <Button onClick={() => connect.mutate()} disabled={connect.isPending || !restaurantId}>
              {connect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Conectar Stripe <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
          {connected && (
            <Button onClick={() => relink.mutate()} disabled={relink.isPending}>
              {relink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerenciar Stripe"}
            </Button>
          )}
          {connected && (
            <Button
              variant="outline"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              title="Sincronizar com a Stripe"
            >
              {refresh.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
          {connected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              Desconectar
            </Button>
          )}
        </div>
      </div>

      {connected && s && (

        <>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Conta" value={s.accountId ?? "—"} />
            <Info label="Status" value={STATUS_LABEL[status] ?? status} />
            <Info label="Charges" value={s.chargesEnabled ? "Habilitado" : "Bloqueado"} />
            <Info label="Payouts" value={s.payoutsEnabled ? "Habilitado" : "Bloqueado"} />
            <Info label="Documentação" value={s.detailsSubmitted ? "Enviada" : "Pendente"} />
            <Info label="Última sync" value={fmt(s.lastSync)} />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <CapabilityBadge label="Cartão" state={s.capabilities.card} />
            <CapabilityBadge label="PIX" state={s.capabilities.pix} />
            <CapabilityBadge label="Payouts" state={s.capabilities.transfers} />
          </div>
        </>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-3 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Toda comunicação com a Stripe é feita por funções seguras no backend. Chaves secretas
          nunca são expostas ao navegador.
        </p>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}

function StatusBadge({ loading, status }: { loading: boolean; status: string }) {
  if (loading) return <Badge variant="secondary">Verificando…</Badge>;
  if (status === "active")
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-500">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Ativo
      </Badge>
    );
  if (status === "onboarding_pending")
    return <Badge variant="secondary">Documentação pendente</Badge>;
  if (status === "restricted") return <Badge variant="secondary">Em análise</Badge>;
  if (status === "rejected" || status === "disabled")
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> {STATUS_LABEL[status]}
      </Badge>
    );
  return (
    <Badge variant="outline">
      <XCircle className="mr-1 h-3 w-3" /> Não conectado
    </Badge>
  );
}

function CapabilityBadge({
  label,
  state,
}: {
  label: string;
  state: "active" | "pending" | "inactive";
}) {
  const cls =
    state === "active"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      : state === "pending"
        ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
        : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cls}>{label}: {state}</Badge>;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default StripeConnectCard;
