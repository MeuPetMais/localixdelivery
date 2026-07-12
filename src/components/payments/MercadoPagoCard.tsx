import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentService } from "@/lib/payments/PaymentService";

interface Props {
  restaurantId: string | null;
  isPrimary: boolean;
  onSetPrimary: () => void;
  settingPrimary?: boolean;
}

export function MercadoPagoCard({ restaurantId, isPrimary, onSetPrimary, settingPrimary }: Props) {
  const qc = useQueryClient();
  const queryKey = ["mp-status", restaurantId];

  const statusQuery = useQuery({
    queryKey,
    enabled: !!restaurantId,
    queryFn: () => PaymentService.connectionStatus("mercado_pago", restaurantId!),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const connect = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      const origin = window.location.origin;
      return PaymentService.connect("mercado_pago", restaurantId, `${origin}/pagamentos`);
    },
    onSuccess: ({ authorizeUrl }) => {
      window.location.href = authorizeUrl;
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar Mercado Pago"),
  });

  const refresh = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      return PaymentService.connectionStatus("mercado_pago", restaurantId);
    },
    onSuccess: () => {
      toast.success("Sincronizado com Mercado Pago");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao sincronizar"),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      await PaymentService.disconnect("mercado_pago", restaurantId);
    },
    onSuccess: () => {
      toast.success("Mercado Pago desconectado");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao desconectar"),
  });

  const status = statusQuery.data;
  const connected = !!status?.connected;

  return (
    <Card className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Mercado Pago</h3>
            {isPrimary && <Badge>Principal</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">PIX e cartão via Mercado Pago (OAuth).</p>
        </div>
        {connected ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3.5 w-3.5" /> Não conectado
          </Badge>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <StatusChip label="Conta" ok={connected} value={status?.accountId ?? "—"} />
        <StatusChip label="PIX" ok={connected} value={connected ? "🟢 Ativo" : "🔴 Off"} />
        <StatusChip label="Cartão" ok={connected} value={connected ? "🟢 Ativo" : "🔴 Off"} />
        <StatusChip label="Webhook" ok={connected} value={connected ? "🟢 OK" : "🟡 —"} />
      </div>
      {status?.connectedAt && (
        <p className="text-xs text-muted-foreground">
          Última sincronização: {new Date(status.connectedAt).toLocaleString("pt-BR")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <Button onClick={() => connect.mutate()} disabled={connect.isPending || !restaurantId}>
            {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Conectar
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refresh.isPending ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
            <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              Desconectar
            </Button>
            {!isPrimary && (
              <Button variant="secondary" onClick={onSetPrimary} disabled={settingPrimary}>
                Definir como principal
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function StatusChip({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-1 ${ok ? "border-emerald-500/30" : "border-border"}`}>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-xs font-medium truncate">{value}</p>
    </div>
  );
}
