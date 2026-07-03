# Reports & Executive Intelligence

Camada executiva do Finance Domain. Responsável por gerar relatórios,
exportações e agendamentos. **Nunca consulta tabelas diretamente** — sempre
consome os Services do Finance Domain (Ledger, CashFlow, Receivables,
Payables, Dashboard, Cost, Split, Reconciliation).

## Arquitetura

```
UI (ReportsWidget)
       │
       ▼
FinancialReportService
       │
       ├── ReportEngine     ← constrói dados via FinanceDomain services
       ├── ExportEngine     ← PDF (HTML) · XLSX (CSV) · CSV · JSON
       ├── ScheduleEngine   ← cálculo de próxima execução
       └── ReportEventBus   ← publica eventos p/ NotificationCenter
       │
       ▼
reports.functions.ts (RLS)
       │
       ▼
financial_reports · scheduled_reports
```

## Serviços

| Serviço                    | Responsabilidade                                          |
| -------------------------- | --------------------------------------------------------- |
| `ReportEngine`             | Construção de resultados por tipo + comparativos          |
| `ExportEngine`             | Serialização em PDF/XLSX/CSV/JSON                         |
| `ScheduleEngine`           | Regras de recorrência (`daily`/`weekly`/`monthly`)        |
| `FinancialReportService`   | Orquestração + publicação de eventos                      |
| `ReportsDomain`            | Factory pública (wiring por padrão)                       |

## Tabelas

- **financial_reports** — histórico de gerações (`PENDING/GENERATING/READY/FAILED/EXPIRED`).
- **scheduled_reports** — agendamentos recorrentes (`daily/weekly/monthly/custom`).

Ambas com RLS restrito ao `owner_id` do restaurante.

## Eventos (`ReportEventBus`)

- `ReportRequested`
- `ReportGenerated`
- `ReportExported`
- `ReportScheduled`
- `ReportDelivered`

Consumíveis pelo `NotificationCenter` para notificar o usuário quando o
relatório fica pronto.

## Como adicionar um novo relatório

1. Adicionar o valor em `ReportType` (`types.ts`).
2. Registrar o título em `TITLES` no `ReportEngine`.
3. Se precisar de dados dedicados, implementar um builder privado no
   `ReportEngine` (padrão de `cashflow` / `receivables` / `payables`).
4. Adicionar a opção no `ReportsWidget` (dropdown "Relatório").

Nenhum outro módulo precisa ser modificado.

## Reutilizações

- `FinancialDashboardService` (KPIs)
- `CashFlowService` / `ReceivablesService` / `PayablesService`
- `LedgerService` (via ports do FinanceDomain)
- `FinancePermissions`, `FinanceAudit`, `resolvePeriod`
- Componentes: `WidgetPrimitives`, `FinancialErrorBoundary`, `FinancialWorkspace`

## Compartilhamento (fase futura)

`ExportPayload` já entrega `filename`/`mimeType`/`content`. Basta plugar
adapters para e-mail, WhatsApp, link temporário ou API — sem alterar o
ReportEngine.
