// CustomerTrackingView — Tela do cliente, mobile-first, sem dados internos.
// Consome apenas Tracking Domain (via hook público). Nunca altera nada.

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, WifiOff } from "lucide-react";
import { useCustomerTracking } from "./use-customer-tracking";
import { CustomerTrackingTimeline } from "./CustomerTrackingTimeline";
import { CustomerTrackingMessageService } from "./customer-tracking.messages";

export interface CustomerTrackingViewProps {
  orderId: string;
  className?: string;
}

export function CustomerTrackingView({ orderId, className }: CustomerTrackingViewProps) {
  const { view, loading, offline, nowMs } = useCustomerTracking(orderId);

  if (loading && !view) {
    return (
      <Card className={`p-5 ${className ?? ""}`}>
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      </Card>
    );
  }

  if (offline && !view) {
    return (
      <Card className={`p-5 ${className ?? ""}`}>
        <div className="flex items-start gap-3 text-muted-foreground">
          <WifiOff className="h-5 w-5" aria-hidden />
          <p className="text-sm">{CustomerTrackingMessageService.offlineMessage()}</p>
        </div>
      </Card>
    );
  }

  if (!view) return null;

  const isCancelled = view.step === "cancelado";
  const freshness = CustomerTrackingMessageService.freshnessLabel(view.updated_at, nowMs);

  return (
    <Card className={`p-5 ${className ?? ""} animate-in fade-in duration-300`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Acompanhamento</h2>
          <p className="text-sm text-muted-foreground">{view.message}</p>
        </div>
        {isCancelled ? (
          <Badge variant="destructive">Cancelado</Badge>
        ) : view.eta_label ? (
          <Badge variant="secondary" className="whitespace-nowrap">
            <Clock className="mr-1 h-3 w-3" aria-hidden />
            {`${Math.round(view.eta_min_minutes ?? 0)}–${Math.round(view.eta_max_minutes ?? 0)} min`}
          </Badge>
        ) : null}
      </div>

      {view.driver_name && !isCancelled && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <User className="h-4 w-4 text-primary" aria-hidden />
          <span>
            <span className="font-medium">{view.driver_name}</span> está cuidando da sua entrega.
          </span>
        </div>
      )}

      {view.eta_label && !isCancelled && (
        <p className="mb-4 text-sm font-medium text-foreground">{view.eta_label}</p>
      )}

      {!isCancelled && <CustomerTrackingTimeline step={view.step} />}

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{freshness}</span>
        {offline && (
          <span className="flex items-center gap-1">
            <WifiOff className="h-3 w-3" aria-hidden /> Reconectando…
          </span>
        )}
      </div>
    </Card>
  );
}
