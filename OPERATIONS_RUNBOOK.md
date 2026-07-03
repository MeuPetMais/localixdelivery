# OPERATIONS_RUNBOOK

Guia rápido para operar a plataforma Localix usando `src/lib/observability`.

## Checagens diárias

1. `OperationsDashboard.snapshot()` — verificar `health.overall`, alertas
   ativos e erros recentes.
2. `MetricsCenter.summary()` — confirmar `success_rate ≥ 0.99` e
   `avg_response_ms` dentro do SLO.
3. `HealthCenter.snapshot()` — nenhum componente `down`/`degraded`.

## Playbooks

### Serviço indisponível
- Alerta: `service_down`.
- Ação: abrir `IncidentCenter.open`, comunicar via NotificationCenter,
  investigar logs por `service`.

### Alto tempo de resposta
- Alerta: `high_latency`.
- Ação: checar `MetricsCenter.filter("response_ms")` e cache
  (`platformCache`), avaliar degradação de dependências.

### Falha de Edge Function
- Alerta: `edge_function_failure`.
- Ação: consultar `supabase--edge_function_logs` do função afetada,
  verificar assinatura/HMAC, reprocessar via retry idempotente.

### Job parado
- Alerta: `stuck_job`.
- Ação: `HealthCenter.report({ key: "worker:X", status: "degraded" })`,
  reiniciar worker, validar fila.

### Erros repetitivos
- Alerta: `repeated_errors`.
- Ação: agrupar por `service`, abrir incidente se afetar tenants distintos.

## Auditoria & Compliance

- Consultas administrativas: `AuditCenter.list({ category, tenant_id })`.
- Exportações e ações sensíveis já são gravadas pelos audits de cada
  domínio (ver `SECURITY_GUIDE.md`).

## Encerramento de incidente

`IncidentCenter.mitigate(id)` → validar métricas → `IncidentCenter.close(id)`
e registrar post-mortem em `AuditCenter` com `category: "operations"`.
