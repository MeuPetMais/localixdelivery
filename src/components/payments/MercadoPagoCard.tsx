import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, Shield, XCircle } from "lucide-react";
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

type StartOAuth = typeof PaymentService.connect;
type DisconnectOAuth = typeof PaymentService.disconnect;

const defaultStartOAuth: StartOAuth = (providerId, restaurantId, redirectTo) =>
  PaymentService.connect(providerId, restaurantId, redirectTo);

const defaultDisconnectOAuth: DisconnectOAuth = (providerId, restaurantId) =>
  PaymentService.disconnect(providerId, restaurantId);

export async function startMercadoPagoConnection(
  restaurantId: string | null,
  origin: string,
  redirect: (url: string) => void,
  startOAuth: StartOAuth = defaultStartOAuth,
) {
  if (!restaurantId) throw new Error("Restaurante não carregado");

  const { authorizeUrl } = await startOAuth("mercado_pago", restaurantId, `${origin}/pagamentos`);
  redirect(authorizeUrl);
}

export async function disconnectMercadoPagoConnection(
  restaurantId: string | null,
  confirmDisconnect: (message: string) => boolean,
  disconnect: DisconnectOAuth = defaultDisconnectOAuth,
) {
  if (!restaurantId) throw new Error("Restaurante não carregado");
  if (!confirmDisconnect("Desconectar Mercado Pago deste restaurante?")) return false;

  await disconnect("mercado_pago", restaurantId);
  return true;
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
    mutationFn: () =>
      startMercadoPagoConnection(
        restaurantId,
        window.location.origin,
        (url) => {
          window.location.href = url;
        },
      ),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível iniciar a conexão Mercado Pago"),
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
    mutationFn: () =>
      disconnectMercadoPagoConnection(
        restaurantId,
        (message) => window.confirm(message),
      ),
    onSuccess: (disconnected) => {
      if (!disconnected) return;
      toast.success("Mercado Pago desconectado");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao desconectar"),
  });

  const status = statusQuery.data;
  const connected = !!status?.connected;
  const errorMessage = statusQuery.isError || connect.isError || refresh.isError || disconnect.isError
    ? "Não foi possível consultar ou atualizar a conexão Mercado Pago. Tente novamente."
    : null;

  return (
    <Card className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">Mercado Pago</h3>
            {isPrimary && <Badge>Principal</Badge>}
            {connected && status?.liveMode === false && <Badge variant="secondary">Ambiente de teste</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {connected
              ? "Sua conta Mercado Pago está conectada e apta a receber pagamentos."
              : "Conecte sua conta Mercado Pago para receber pagamentos e permitir o repasse automático."}
          </p>
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

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {connected && (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Info label="Conta" value={status?.accountId ?? "—"} />
          <Info label="Modo" value={status?.liveMode ? "Produção" : "Teste"} />
          <Info label="Conectado em" value={formatDate(status?.connectedAt ?? null)} />
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <Button onClick={() => connect.mutate()} disabled={connect.isPending || !restaurantId}>
            {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
            {connect.isPending ? "Conectando" : "Conectar Mercado Pago"}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              {disconnect.isPending ? "Desconectando" : "Desconectar"}
            </Button>
            {!isPrimary && (
              <Button variant="secondary" onClick={onSetPrimary} disabled={settingPrimary}>
                Definir como principal
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-3 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          A conexão é feita pelo ambiente seguro do Mercado Pago. Tokens, códigos de autorização e
          credenciais nunca são exibidos nesta tela.
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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}
