import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentService } from "@/lib/payments/PaymentService";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
}

export function PaymentGatewayCard({ restaurantId }: { restaurantId: string }) {
  const q = useQuery({
    queryKey: ["mp-status", restaurantId],
    enabled: !!restaurantId,
    queryFn: () => PaymentService.connectionStatus("mercado_pago", restaurantId),
    refetchOnWindowFocus: false,
  });

  if (q.isLoading) {
    return (
      <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando gateway de pagamento…
      </Card>
    );
  }

  if (q.isError) {
    return (
      <Card className="flex items-center justify-between gap-3 border-destructive/40 p-4">
        <div className="text-sm">Não foi possível consultar o gateway.</div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button>
      </Card>
    );
  }

  const s = q.data;

  if (!s?.connected) {
    return (
      <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">Gateway de Pagamento</div>
          <h3 className="mt-1 text-lg font-semibold">Receba pagamentos online</h3>
          <p className="text-sm text-muted-foreground">
            Nenhuma conta Mercado Pago conectada. Conecte sua conta para receber PIX e cartão diretamente no seu CNPJ.
          </p>
        </div>
        <Button asChild>
          <Link to="/pagamentos">
            Conectar Mercado Pago <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gateway de Pagamento</div>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-lg font-semibold">Mercado Pago</h3>
            <Badge className="bg-emerald-500 hover:bg-emerald-500">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Conta conectada
            </Badge>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>Última sincronização: <span className="text-foreground">{fmt(s.connectedAt)}</span></div>
            <div>Modo: <span className="text-foreground">{s.liveMode ? "Produção" : "Sandbox"}</span></div>
            <div>Conta MP: <span className="text-foreground">{s.accountId ?? "—"}</span></div>
            <div>Token expira: <span className="text-foreground">{fmt(s.expiresAt)}</span></div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/pagamentos">Gerenciar conexão</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pagamentos">Abrir Central de Pagamentos</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
