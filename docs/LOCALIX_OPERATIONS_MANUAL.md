# LOCALIX OPERATIONS MANUAL — v1.0 RC2

Documento operacional oficial. Reflete exclusivamente o comportamento
implementado da plataforma. Itens ausentes na v1.0 estão marcados como
**"Não implementado na v1.0"**.

Data: 2026-07-06 · Status: Feature Freeze

---

## Capítulo 1 — Visão Geral

**Objetivo da plataforma.** Localix é uma plataforma multi-tenant de
delivery: cada restaurante possui seu próprio ambiente acessado via
`/{slug}`. Não é marketplace.

**Escopo da operação.** Cadastro e operação de restaurantes, catálogo,
pedidos, pagamentos (Stripe Connect Express + Mercado Pago legado),
fidelidade, financeiro, analytics e administração global.

**Ambientes.**
- Preview: `https://id-preview--70a38eb3-fee3-4e1f-b87d-610ac1cf7faf.lovable.app`
- Produção: `https://localixdelivery.lovable.app`
- Backend (edge/API estável): `https://project--70a38eb3-fee3-4e1f-b87d-610ac1cf7faf.lovable.app`

**Componentes.**
- Frontend TanStack Start v1 (React 19 + Vite 7).
- Backend Lovable Cloud (Postgres + Auth + Storage + Edge Functions).
- Pagamentos: Stripe (Checkout + Connect Express + Split) e Mercado Pago
  (legado, via `mp-*` Edge Functions).
- IA: Lovable AI Gateway.

**Responsabilidades operacionais.** Ver `OPERATIONS_MANUAL.md` §1
(Produto, Plataforma, Pagamentos, Observability, Segurança).

---

## Capítulo 2 — Perfis de acesso

Perfis existentes (definidos em `app_role` + `user_roles`, aplicados via
`has_role`):

### 2.1 Cliente
- **Objetivo:** consumir catálogo, fazer pedidos, acumular fidelidade.
- **Login:** e-mail/senha, Google, Apple.
- **Telas:** `/{slug}`, `/{slug}/checkout`, `/{slug}/montar`, `/{slug}/sobre`,
  `/meus-pedidos`, `/meus-enderecos`, `/favoritos`, `/fidelidade`,
  `/beneficios`, `/pedido/$id`, `/pedido-sucesso/$id`, `/cliente`.
- **Limitações:** não acessa `_authenticated/*` nem `/admin/*`.

### 2.2 Parceiro (owner do restaurante)
- **Objetivo:** operar o próprio restaurante.
- **Login:** **exclusivamente e-mail/senha** (bloqueio OAuth via trigger
  `enforce_partner_email_only` + guard `_authenticated/route.tsx`).
- **Telas:** todas em `/_authenticated/*` — `dashboard`, `menu`, `orders`,
  `kitchen`, `inventory`, `suppliers`, `units`, `customers`, `promotions`,
  `featured`, `loyalty`, `programa-fidelidade`, `reviews`, `finance`,
  `financial-center`, `finance-ai`, `pagamentos`, `print-settings`,
  `settings`, `perfil`, `ai`, `consultor`, `builders`, `support`.
- **Limitações:** escopado ao próprio `restaurant_id` via RLS.

### 2.3 Administrador da plataforma
- **Objetivo:** governança global.
- **Login:** **exclusivamente e-mail/senha** via `/admin_/login` (bloqueio
  OAuth em `admin.tsx`).
- **Telas:** `/admin`, `/admin/aprovacoes`, `/admin/parceiros`,
  `/admin/clientes`, `/admin/pedidos`, `/admin/transacoes`,
  `/admin/financeiro`, `/admin/comissoes`, `/admin/relatorios`,
  `/admin/auditoria`, `/admin/suporte`, `/admin/configuracoes`.
- **Limitações:** validado por `has_role(auth.uid(),'admin')`.

Nenhum outro perfil existe na v1.0.

---

## Capítulo 3 — Fluxo operacional do restaurante

1. **Cadastro.** `/auth` (e-mail/senha). `OwnerOnboarding` cria o registro
   em `restaurants` com `owner_id = auth.uid()`.
2. **Configuração.** `_authenticated/settings` e `perfil` (dados, horários,
   entrega, endereço).
3. **Stripe Connect.** `_authenticated/pagamentos` → `StripeConnectCard`
   invoca `stripe-connect-create` (onboarding Express) e
   `stripe-connect-refresh` (sync de status). Cada restaurante possui sua
   própria conta Stripe.
4. **Cardápio.** `_authenticated/menu`, `units`, `inventory`, `suppliers`,
   `featured`, `promotions`.
5. **Recebimento de pedidos.** `_authenticated/orders` +
   `OperationsCenter`; entrada apenas após webhook confirmar pagamento
   (status `pago`, nunca `novo`).
6. **Produção.** `_authenticated/kitchen` (`KitchenDisplay`) — transições
   via `OrderOrchestrator`.
7. **Entrega.** `DeliveryPanel` — transições até `entregue`.
8. **Finalização.** Ledger append-only (`LedgerService`), Loyalty EARN em
   `pago`/`entregue`, notificação ao cliente.

---

## Capítulo 4 — Fluxo operacional do cliente

- **Cadastro/Login.** `/entrar` — e-mail/senha, Google, Apple.
- **Pedidos.** `/{slug}` → produto → `AddedToCartSheet` →
  `/{slug}/checkout`.
- **Pagamento.** Stripe Checkout (padrão) ou Mercado Pago (legado);
  Dinheiro conforme configuração do restaurante.
- **Acompanhamento.** `/pedido/$id` (realtime via
  `OrdersRealtimeContext`) e `MerchantNotificationsBell` /
  `NotificationsBell`.
- **Fidelidade.** `/fidelidade`, `LoyaltyRedeemBlock` /
  `LoyaltyBenefitsBlock` no checkout.
- **Histórico.** `/meus-pedidos`, `/meus-enderecos`, `/favoritos`.

---

## Capítulo 5 — Fluxo financeiro

- **Stripe Checkout.** Edge Function `stripe-checkout` cria
  PaymentIntent.
- **Stripe Connect Express.** Cada restaurante conectado possui conta
  própria (`stripe-connect-create` / `-refresh`).
- **Pagamento.** Confirmado apenas via webhook `stripe-webhook`
  (assinatura verificada, dedupe em `payment_webhook_events`).
- **Split.** Automático via `application_fee_amount` +
  `transfer_data.destination` (`StripeSplitService`). Valores derivados de
  `PlatformRevenueService` — nenhum valor hardcoded.
- **Financeiro.** Ledger append-only, `payment_split` idempotente,
  dashboard em `_authenticated/finance` e `financial-center`.
- **Conciliação.** `payment_reconciliation` — relatórios manuais
  (automação: **Não implementado na v1.0**).

---

## Capítulo 6 — Programa de Fidelidade

- **Configuração.** `_authenticated/programa-fidelidade`.
- **Acúmulo (EARN).** Disparado em `pago`/`entregue` via
  `loyalty.functions.ts` (transacional, com dedupe).
- **Resgate.** Reserve/commit no checkout
  (`LoyaltyRedeemBlock`); rollback em cancelamento.
- **Expiração.** Job `loyalty_expire_points`.
- **Analytics.** `_authenticated/loyalty`.

---

## Capítulo 7 — Operação diária

Baseado em `OPERATIONS_MANUAL.md` §2:
- Conferir `OperationsDashboard` (saúde + incidentes).
- Revisar alertas do `AlertCenter` (24h).
- Conferir p95 (`response_ms`, `edge_function_ms`) e taxa de erro.
- Revisar `AuditCenter` (categorias `admin`, `financial`).

Semanal: auditoria de administradores, revisão de `TECHNICAL_DEBT.md`,
drill de backup em staging, revisão de feature flags.

Mensal: rotação de secrets (`MP_WEBHOOK_SECRET`,
`MP_TOKEN_ENCRYPTION_KEY`), revisão de RLS de tabelas novas.

---

## Capítulo 8 — Monitoramento

- **Logs.** `LoggingCenter` (sanitizando PII/tokens) + logs de Edge
  Functions no Lovable Cloud.
- **Edge Functions.** `stripe-checkout`, `stripe-connect-create`,
  `stripe-connect-refresh`, `stripe-webhook`, `mp-oauth`,
  `mp-oauth-callback`, `mp-payment-intent`, `mp-webhook`.
- **Stripe.** Dashboard Stripe (Connect + pagamentos).
- **Webhooks.** Retry + dedupe via `payment_webhook_events` + queue.
- **Dashboard.** `OperationsDashboard` (admin).
- **Alertas.** `AlertCenter` + `IncidentCenter`. Alertas proativos
  externos: **Não implementado na v1.0**.

---

## Capítulo 9 — Backups e recuperação

- **Backup diário automático.** Gerenciado pelo Lovable Cloud.
- **Restore drill.** Documentado em `DISASTER_RECOVERY_PLAN.md`.
- **PITR (point-in-time recovery) exposto ao operador:** **Não
  implementado na v1.0**.
- **Runbook de restauração parcial por tenant:** **Não implementado na
  v1.0**.

---

## Capítulo 10 — Procedimentos de suporte

### 10.1 Restaurante
- Canal: `_authenticated/support` (`KnowledgeBase`) + `HelpFab`.
- Incidentes de pagamento: consultar `_authenticated/pagamentos` →
  reconectar Stripe se necessário.
- Suporte administrativo: `/admin/suporte`.

### 10.2 Cliente
- Canal: dentro do próprio pedido (`/pedido/$id`) e via notificações
  (`NotificationsBell`).
- Reembolso: back-end operacional via Stripe; UI parcial (ver
  `GO_LIVE_AUDIT.md` §3) — completa: **Não implementado na v1.0**.

Novos processos: nenhum criado.

---

## Capítulo 11 — Checklist operacional

### 11.1 Abertura
- [ ] `OperationsDashboard` verde.
- [ ] `AlertCenter` sem alertas P1 abertos.
- [ ] Edge Functions respondendo (`stripe-*`, `mp-*`).
- [ ] Fila `payment_webhook_events` sem itens travados.

### 11.2 Encerramento
- [ ] Pedidos do dia em estado final (`entregue`/`cancelado`).
- [ ] Ledger reconcilia com Stripe (spot check).
- [ ] Notificações operacionais enviadas.

### 11.3 Validação diária
- [ ] Smoke test: novo pedido em restaurante de referência.
- [ ] Webhook Stripe processado sem erro.
- [ ] `AuditCenter` sem eventos suspeitos em `admin`/`financial`.

---

## Capítulo 12 — Glossário

- **Slug.** Identificador do restaurante em `/{slug}`.
- **Owner / Parceiro.** Usuário dono do restaurante.
- **Tenant.** Restaurante (unidade multi-tenant).
- **Ledger.** Registro financeiro append-only.
- **Split.** Repartição automática Stripe → restaurante + Localix.
- **PlatformRevenue.** Domínio único de receita da plataforma.
- **EARN / REDEEM.** Operações de acúmulo/resgate de fidelidade.
- **OrderOrchestrator.** Máquina de estados dos pedidos.
- **OperationsCenter.** Painel unificado de operação.
- **has_role.** Função `security definer` de checagem de papel.
- **Edge Function.** Função serverless no Lovable Cloud.

---

## Validação

- Consistência conferida com o código atual (`src/lib/**`,
  `src/routes/**`, `supabase/functions/**`, migrations e docs em `docs/`).
- Nenhum processo especulativo incluído.
- Itens ausentes marcados como **"Não implementado na v1.0"**.

## Relatório final

**Estrutura:** 12 capítulos conforme escopo solicitado.

**Fontes utilizadas:**
- `docs/GO_LIVE_AUDIT.md`, `docs/GO_LIVE_CHECKLIST.md`,
  `docs/GO_LIVE_SCORE.md`, `docs/PRODUCTION_READINESS.md`,
  `docs/OPERATIONS_MANUAL.md`, `docs/RC2_SEC_001_REPORT.md`,
  `docs/STRIPE_SPLIT.md`, `docs/PLATFORM_REVENUE_FLOW.md`,
  `docs/FINANCIAL_SETTLEMENT.md`, `docs/DISASTER_RECOVERY_PLAN.md`.
- Código: `src/routes/`, `src/lib/operations/`, `src/lib/payments/`,
  `src/lib/stripe/`, `src/lib/billing/`, `supabase/functions/`.

**Inconsistências encontradas:** nenhuma nova; itens 🟡 do RC1 já
mapeados em `GO_LIVE_AUDIT.md`.

**Itens marcados como "Não implementado na v1.0":**
- Conciliação financeira automatizada.
- Alertas proativos externos (paging).
- PITR exposto ao operador.
- Runbook de restauração parcial por tenant.
- UI completa de reembolso.

**Confirmação:** o manual representa fielmente a implementação atual da
Localix v1.0 RC2. Nenhum código foi alterado.
