# OPERATIONS MANUAL — Localix v1.0

Guia diário de operação da plataforma em produção. Complementa
`OPERATIONS_RUNBOOK.md` (foco em incidentes) e `OBSERVABILITY_GUIDE.md`
(foco em instrumentação).

## 1. Estrutura de responsabilidades

| Área | Responsável | Ferramenta principal |
| --- | --- | --- |
| Frontend / Publish | Time Produto | Lovable Publish |
| Backend / DB / Edge | Time Plataforma | Lovable Cloud |
| Pagamentos | Time Pagamentos | Mercado Pago + `mp-*` functions |
| Observability | On-call | `OperationsDashboard` |
| Segurança | Time Segurança | `security--*` tools |

## 2. Rotinas diárias

- Verificar `OperationsDashboard` (saúde geral, incidentes abertos).
- Revisar alertas do `AlertCenter` das últimas 24h.
- Conferir métricas p95 (`response_ms`, `edge_function_ms`) e taxa de erro.
- Revisar auditorias sensíveis (`AuditCenter` categorias `admin`, `financial`).

## 3. Rotinas semanais

- Auditoria de novos usuários administradores.
- Revisão de `TECHNICAL_DEBT.md` e priorização para v1.1.
- Backup restore drill em ambiente de staging (ver `DISASTER_RECOVERY_PLAN.md`).
- Revisão de feature flags ativas (`platformConfiguration.featureFlags`).

## 4. Rotinas mensais

- Rotação preventiva de secrets sensíveis (`MP_WEBHOOK_SECRET`, `MP_TOKEN_ENCRYPTION_KEY`).
- Revisão de RLS de novas tabelas.
- Consolidação de métricas de performance vs SLO.

## 5. Deploy padrão

1. Merge/commit no editor Lovable → build automático.
2. Aguardar Publish para promover a produção (frontend).
3. Backend (edge functions + migrations) é aplicado automaticamente.
4. Executar smoke test em produção (ver `GO_LIVE_CHECKLIST.md` §9).
5. Anotar release em changelog interno.

## 6. Feature flags & Rollout

- Ativar via `platformConfiguration.featureFlags.setRollout(...)`.
- Rollout inicial recomendado: 10% → 25% → 50% → 100% (24h entre etapas).
- Kill switch: `platformConfiguration.killSwitch.enable('key', reason)`.
- Todas mudanças são auditadas em `platform_config_audit_log`.

## 7. Rate limits & Timeouts (configurações padrão)

| Recurso | Limite | Ação em excesso |
| --- | --- | --- |
| Server Functions | 30 req/s por usuário | 429 + log |
| Webhook `/api/public/mp/webhook` | 60 req/min por IP (planejado v1.1) | 429 |
| Timeout HTTP externo (MP) | 15s | retry exponencial (3x) |
| Cache tenant config | TTL 5min | invalidado por evento |

## 8. On-call

- Escala semanal, handoff às segundas 09:00 BRT.
- Alerta P1 (indisponibilidade / pagamentos travados): ativar imediatamente
  o `OPERATIONS_RUNBOOK.md` correspondente.
- Alerta P2 (degradação): investigar em até 1h.
- Alerta P3 (informativo): backlog.

## 9. Comunicação

- Status externo: página estática em `/status` (v1.1).
- Merchants impactados: usar `NotificationCenter` (`operational` scope).
- Postmortem obrigatório para P1 em até 72h.

## 10. Referências

- `OBSERVABILITY_GUIDE.md`
- `OPERATIONS_RUNBOOK.md`
- `SECURITY_GUIDE.md`
- `PERFORMANCE_GUIDE.md`
- `DEPLOYMENT_GUIDE.md`
- `ROLLBACK_GUIDE.md`
- `DISASTER_RECOVERY_PLAN.md`
