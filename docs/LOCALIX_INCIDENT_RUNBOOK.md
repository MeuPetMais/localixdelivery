# LOCALIX INCIDENT RUNBOOK — v1.0 RC2

Manual oficial de resposta a incidentes. Reflete exclusivamente a
infraestrutura e os processos implementados. Itens ausentes estão
marcados como **"Não implementado na v1.0"**.

Data: 2026-07-06 · Status: Feature Freeze

---

## Capítulo 1 — Objetivo

- **Finalidade.** Padronizar a resposta a incidentes operacionais da
  plataforma Localix.
- **Quando utilizar.** Sempre que houver falha detectada em produção,
  degradação de serviço, alerta P1/P2, ou reclamação recorrente.
- **Responsáveis.** On-call da semana (Plataforma) + escalonamento para
  Pagamentos, Segurança e Produto conforme categoria (ver
  `docs/OPERATIONS_MANUAL.md` §1).
- **Escopo.** Autenticação, pagamentos, pedidos, fidelidade,
  infraestrutura (Lovable Cloud + Edge Functions + Storage) e
  observability.

---

## Capítulo 2 — Classificação de incidentes

Classificação em uso (ver `docs/OPERATIONS_MANUAL.md` §8):

- **P1.** Indisponibilidade ou pagamentos travados. Resposta imediata.
- **P2.** Degradação (p95 acima do SLO, taxa de erro elevada). Até 1h.
- **P3.** Informativo, backlog.

SLA formal externo publicado: **Não implementado na v1.0**.

---

## Capítulo 3 — Procedimento geral

1. **Identificar.** Sinal via `AlertCenter`, `OperationsDashboard`,
   `HealthCenter`, logs de Edge Function ou reporte de merchant/cliente.
2. **Registrar.** Abrir incidente em `IncidentCenter`
   (`src/lib/observability/*`). Incluir categoria, severidade, escopo.
3. **Analisar.** Consultar `LoggingCenter` (PII sanitizado),
   `MetricsCenter` (p50/p95/erros), `AuditCenter` (categorias `admin`,
   `financial`, `auth`) e logs de Edge Function específicos.
4. **Acompanhar.** Atualizar status no `IncidentCenter`; notificar
   merchants afetados via `NotificationCenter` (scope `operational`).
5. **Encerrar.** Confirmar retorno das métricas ao normal, fechar
   `IncidentCenter`, agendar postmortem se P1 (obrigatório em 72h).

Ferramenta de paging externa (PagerDuty/Opsgenie): **Não implementado
na v1.0**.

---

## Capítulo 4 — Incidentes de autenticação

- **Login/Logout.** Fluxo em `src/hooks/use-auth.ts` e
  `use-customer-auth.ts`. Reset de sessão via
  `supabase.auth.signOut()`.
- **Recuperação de acesso.** `/esqueci-senha` → e-mail →
  `/redefinir-senha`.
- **Cliente.** `/entrar` — e-mail/senha, Google, Apple.
- **Parceiro.** `/auth` — **exclusivamente e-mail/senha**. Trigger
  `enforce_partner_email_only` bloqueia OAuth; guard em
  `_authenticated/route.tsx` faz `signOut` e redireciona.
- **Administrador.** `/admin_/login` — exclusivamente e-mail/senha.
  Guard em `admin.tsx` bloqueia OAuth.

Sintomas comuns e ação:
- *Parceiro logou via Google/Apple.* Guard esperado — redireciona para
  `/entrar`. Ver `docs/RC2_SEC_001_REPORT.md` para procedimento de
  transferência de `owner_id` quando houver conta invalida legada.
- *Sessão expira em rota autenticada.* Revalidação por `restaurant_id`
  no `RestaurantSessionContext` (não limpar contexto).

MFA para administradores: **Não implementado na v1.0** (v1.1).

---

## Capítulo 5 — Incidentes de pagamento

- **Stripe Checkout.** Edge Function `stripe-checkout` cria
  PaymentIntent. Ver `supabase--edge_function_logs`.
- **Stripe Connect.** `stripe-connect-create` (onboarding),
  `stripe-connect-refresh` (sync `charges_enabled` /
  `payouts_enabled` / `details_submitted`).
- **Webhooks.** `stripe-webhook` (assinatura verificada) e
  `mp-webhook` (HMAC `x-signature` + `timingSafeEqualStr`).
- **PaymentIntent.** Confirmação apenas por webhook — pedido nunca vai
  para `pago` sem webhook confirmado.
- **PaymentService.** Única porta de entrada do domínio
  (`src/lib/payments/PaymentService.ts`).
- **payment_webhook_events.** Dedupe + retry idempotente.
- **payment_reconciliation.** Relatórios manuais (automação: **Não
  implementado na v1.0**).

Fluxo padrão:
1. Verificar `stripe-webhook` logs para o `event.id`.
2. Consultar `payment_webhook_events` (status, tentativas).
3. Se dedupe travando: identificar `event.id` e revalidar assinatura.
4. Refund: operacional via Stripe back-end; UI parcial (v1.1).

---

## Capítulo 6 — Incidentes de pedidos

- **Pedido não criado.** Verificar `OrderService` (`src/lib/checkout/`)
  e `orderPayment.server` (facade do Payment Domain). Confirmar que
  `order_payment` foi registrado como `pending`.
- **Pedido não atualizado.** Verificar `OrderOrchestrator` +
  `OrderStateMachine` + `TransitionValidator`. Consultar
  `OrderTimelineService`.
- **Pedido preso em status.** Verificar `payment_webhook_events`
  (pagamento não confirmado ⇒ pedido não avança para `pago`). Nunca
  força transição fora do orchestrator.
- **Pedido cancelado.** Rollback automático de Loyalty
  (`loyalty.functions.ts`), reversão de reserve/commit.

Regra invariante: pedido **nunca** regressa para `novo`.

---

## Capítulo 7 — Incidentes de fidelidade

- **Crédito (EARN).** Disparado em `pago`/`entregue` via
  `loyalty.functions.ts` com dedupe transacional.
- **Resgate (REDEEM).** Reserve no checkout, commit em `pago`.
- **Rollback.** Automático em cancelamento (reverte reserve/commit).
- **Expiração.** Job `loyalty_expire_points`.

Sintomas:
- *EARN duplicado.* Verificar dedupe key; consultar tabela de
  transações loyalty.
- *REDEEM sem reversão.* Confirmar transição do pedido para
  `cancelado`; job de rollback é acionado pelo orchestrator.

---

## Capítulo 8 — Incidentes de infraestrutura

- **Supabase / Lovable Cloud.** Health check via
  `supabase--cloud_status`. Restart via `supabase--restart` (paralisa
  alguns minutos). RLS habilitada em 100% das tabelas públicas.
- **Edge Functions.** `stripe-checkout`, `stripe-connect-create`,
  `stripe-connect-refresh`, `stripe-webhook`, `mp-oauth`,
  `mp-oauth-callback`, `mp-payment-intent`, `mp-webhook`. Logs via
  `supabase--edge_function_logs`.
- **Storage.** Buckets privados com policies (ex.: `product-images`).
- **Logs.** `LoggingCenter` (client + edge) com sanitização de
  PII/tokens.
- **Observabilidade.** `OperationsDashboard`, `AlertCenter`,
  `IncidentCenter`, `MetricsCenter`, `HealthCenter`
  (`src/lib/observability/*`).

Alertas proativos externos (paging): **Não implementado na v1.0**.
Rate limit global: **Não implementado na v1.0** (existe apenas em
Edge Functions críticas).

---

## Capítulo 9 — Recuperação

- **Backup diário automático.** Gerenciado pelo Lovable Cloud.
- **Restore drill.** Documentado em `docs/DISASTER_RECOVERY_PLAN.md`
  (executado em staging).
- **PITR exposto ao operador:** **Não implementado na v1.0**.
- **Restauração parcial por tenant:** **Não implementado na v1.0**.

Não executar restore em produção sem alinhamento com Plataforma +
Segurança.

---

## Capítulo 10 — Comunicação

- **Interna.** `IncidentCenter` centraliza estado do incidente; handoff
  do on-call às segundas 09:00 BRT (`docs/OPERATIONS_MANUAL.md` §8).
- **Externa aos merchants.** `NotificationCenter` scope `operational`.
- **Página de status pública (`/status`):** **Não implementado na
  v1.0** (v1.1).
- **Postmortem P1.** Obrigatório em 72h.

Integração com ferramentas externas (Slack/Discord/Email
transacional dedicado a incidentes): **Não implementado na v1.0**.

---

## Capítulo 11 — Checklist de encerramento

- [ ] Causa raiz identificada e registrada no `IncidentCenter`.
- [ ] Métricas retornaram ao SLO (`response_ms`, `edge_function_ms`,
      taxa de erro).
- [ ] `AlertCenter` sem alertas ativos relacionados.
- [ ] Merchants afetados notificados (quando aplicável).
- [ ] `AuditCenter` revisado (categorias `admin`/`financial`).
- [ ] `payment_webhook_events` sem itens travados (se pagamento).
- [ ] Pedidos afetados em estado consistente (se pedidos).
- [ ] Ledger reconciliado (se financeiro).
- [ ] Postmortem agendado (se P1).

---

## Capítulo 12 — Glossário

- **On-call.** Responsável de plantão da semana.
- **P1 / P2 / P3.** Severidades de incidente.
- **IncidentCenter / AlertCenter / LoggingCenter / MetricsCenter /
  HealthCenter / AuditCenter.** Serviços de observability
  (`src/lib/observability/*`).
- **Edge Function.** Função serverless no Lovable Cloud.
- **PaymentService.** Fachada única do Payment Domain.
- **PlatformRevenue.** Fonte única da monetização da plataforma.
- **RLS.** Row-Level Security do Postgres.
- **OrderOrchestrator.** Máquina de estados dos pedidos.
- **RestaurantSessionContext.** Contexto de sessão do estabelecimento.

---

## Validação

Consistência conferida contra:
- `docs/LOCALIX_OPERATIONS_MANUAL.md`
- `docs/LOCALIX_ONBOARDING_PLAYBOOK.md`
- `docs/ARCHITECTURE_BASELINE.md`
- `docs/GO_LIVE_AUDIT.md`
- `docs/RELEASE_CANDIDATE_RC1.md`
- `docs/PRODUCTION_READINESS.md`
- Código: `src/lib/observability/*`, `src/lib/payments/*`,
  `src/lib/orders/*`, `src/routes/_authenticated/route.tsx`,
  `src/routes/admin.tsx`, `supabase/functions/*`, `supabase/migrations/*`.

## Relatório final

**Estrutura.** 12 capítulos conforme escopo.

**Fontes.** Docs listados + inspeção direta do código-fonte e das
migrations recentes.

**Inconsistências encontradas:** 0.

**Itens marcados como "Não implementado na v1.0":**
- SLA externo publicado.
- Ferramenta de paging externa (PagerDuty/Opsgenie).
- Alertas proativos externos.
- Rate limit global.
- Conciliação financeira automatizada.
- PITR exposto ao operador.
- Restauração parcial por tenant.
- Página de status pública (`/status`).
- Integração de comunicação de incidente com Slack/Discord/Email dedicado.
- MFA para administradores.

**Confirmação.** O documento representa fielmente os procedimentos
atualmente implementados na Localix v1.0 RC2. Nenhum código ou
documentação existente foi alterado.
