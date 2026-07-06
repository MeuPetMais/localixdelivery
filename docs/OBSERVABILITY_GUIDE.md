# OBSERVABILITY_GUIDE

Camada: `src/lib/observability`. Puro TypeScript, sem regras de negócio,
impacto mínimo em performance (buffers circulares, agregação sob demanda).

## Componentes

| Center | Papel |
| --- | --- |
| `LoggingCenter` | Logs padronizados (`info`/`warning`/`error`/`critical`) sanitizados via `@/lib/security`. |
| `MetricsCenter` | Contadores/timings em janela de 60s (`request`, `error`, `response_ms`, `edge_function_ms`, `job_executed`, `queue_pending`). |
| `AuditCenter` | Auditoria unificada por categoria (`login`, `admin`, `financial`, `settings`, `ai`, `marketing`, `feature_flag`, `operations`). |
| `HealthCenter` | Registro/report de componentes (`database`, `edge_function`, `api`, `event_bus`, `worker`, `job`, `cache`, `queue`, `service`). |
| `AlertCenter` / `IncidentCenter` | Estrutura para alertas e incidentes (open → mitigated → closed). |
| `DiagnosticsCenter` | Módulos, dependências e última sincronização. |
| `OperationsDashboard` | Snapshot consolidado para o painel operacional. |

## Regras

- **Nunca** logar dados sensíveis: `LoggingCenter` já roteia via
  `sanitizeLogString` / `sanitizeLogPayload`.
- Correlacionar por `request_id`, `tenant_id`, `user_id` sempre que possível.
- `MetricsCenter` é fire-and-forget; jamais bloquear caminho crítico.
- `AuditCenter` complementa (não substitui) auditorias por domínio
  (`OrderAudit`, `FinanceAudit`, `PlatformConfigAuditService` etc.).
- Alertas críticos abrem incidente via `IncidentCenter`.

## Integrações

Consumido por Platform Administration, Analytics, NotificationCenter,
AI Platform, Marketing Automation, EventBus e Edge Functions —
somente via APIs públicas de cada domínio.

## Segurança

- RLS/tenant isolation permanecem responsabilidade dos repositórios de origem.
- Acesso ao painel operacional restrito a papéis administrativos.
- Buffers in-memory: nenhum dado sensível persiste em disco por padrão.
