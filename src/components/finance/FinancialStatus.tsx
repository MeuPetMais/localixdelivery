import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import type { FinanceStatus } from "@/lib/finance";

export function FinancialStatusBar({ status }: { status: FinanceStatus | null }) {
  if (!status) return null;
  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString("pt-BR") : "—";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <span>Saldo: <strong className="text-foreground">{brl(status.balance)}</strong></span>
      <span>·</span>
      <span>Gateway: <Badge variant="outline">{status.activeGateway ?? "—"}</Badge></span>
      <span>·</span>
      <span>Última conciliação: {fmt(status.lastReconciliationAt)}</span>
      <span>·</span>
      <span>Último split: {fmt(status.lastSplitAt)}</span>
      <span>·</span>
      <span>Atualizado: {fmt(status.lastUpdatedAt)}</span>
    </div>
  );
}
