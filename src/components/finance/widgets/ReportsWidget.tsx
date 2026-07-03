import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { WidgetCard, WidgetHeader, WidgetLoading, WidgetEmpty } from "@/components/dashboard/WidgetPrimitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, FileText, Trash2, RefreshCw } from "lucide-react";
import {
  ReportsDomain, type ExportFormat, type ReportType,
} from "@/lib/finance/reports";
import { listReports, saveReport, deleteReport } from "@/lib/finance/reports/reports.functions";
import type { FinanceFilters } from "@/lib/finance";

const REPORT_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: "cashflow", label: "Fluxo de Caixa" },
  { value: "receivables", label: "Recebimentos" },
  { value: "payables", label: "Pagamentos" },
  { value: "dre", label: "DRE" },
  { value: "profitability", label: "Lucratividade" },
  { value: "executive_ceo", label: "Executivo CEO" },
  { value: "executive_finance", label: "Executivo Financeiro" },
  { value: "top_products", label: "Produtos mais lucrativos" },
  { value: "top_gateway", label: "Gateway mais utilizado" },
];

const FORMATS: ExportFormat[] = ["pdf", "xlsx", "csv", "json"];

function downloadPayload(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function ReportsWidget({
  restaurantId,
  filters,
}: {
  restaurantId: string;
  filters: Partial<FinanceFilters>;
}) {
  const [type, setType] = useState<ReportType>("cashflow");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const service = useMemo(() => ReportsDomain.createReportService(), []);
  const qc = useQueryClient();

  const listFn = useServerFn(listReports);
  const saveFn = useServerFn(saveReport);
  const deleteFn = useServerFn(deleteReport);

  const historyKey = ["finance", "reports", restaurantId];
  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => listFn({ data: { restaurantId, limit: 20 } }),
    enabled: !!restaurantId,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { result, export: payload } = await service.generate({ restaurantId, type, filters, format });
      if (payload) downloadPayload(payload.filename, payload.mimeType, payload.content);
      await saveFn({
        data: {
          restaurantId, type, title: result.title,
          filters: (result.filters ?? {}) as never, format, status: "READY",
        },
      });
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: historyKey }); toast.success("Relatório gerado."); },
    onError: (e: Error) => toast.error(e.message || "Falha ao gerar relatório."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: historyKey }); toast.success("Relatório removido."); },
  });

  return (
    <>
      <WidgetCard span={4}>
        <WidgetHeader
          title="Gerar relatório"
          action={
            <Button size="sm" variant="ghost" onClick={() => history.refetch()} disabled={history.isFetching}>
              <RefreshCw className={`h-4 w-4 ${history.isFetching ? "animate-spin" : ""}`} />
            </Button>
          }
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-52">
            <label className="text-xs text-muted-foreground">Relatório</label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-32">
            <label className="text-xs text-muted-foreground">Formato</label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATS.map(f => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {generate.isPending ? "Gerando…" : "Gerar & baixar"}
          </Button>
        </div>
      </WidgetCard>

      <WidgetCard span={4}>
        <WidgetHeader title="Histórico de relatórios" />
        {history.isLoading ? <WidgetLoading /> :
          !history.data?.length ? <WidgetEmpty description="Nenhum relatório gerado ainda." /> :
          <ul className="divide-y">
            {history.data.map(r => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.file_format.toUpperCase()} · {new Date(r.created_at).toLocaleString("pt-BR")} · {r.status}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>}
      </WidgetCard>
    </>
  );
}
