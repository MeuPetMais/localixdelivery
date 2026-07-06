# LOCALIX SUPPORT PLAYBOOK — v1.0 RC2

Manual oficial da equipe de suporte. Reflete exclusivamente a
implementação atual. Itens ausentes estão marcados como
**"Não implementado na v1.0"**.

Data: 2026-07-06 · Status: Feature Freeze

---

## Capítulo 1 — Objetivo

- **Finalidade.** Padronizar o atendimento a clientes, parceiros e
  administradores da Localix.
- **Escopo.** Dúvidas e problemas relativos a acesso, pedidos,
  pagamentos, fidelidade, cardápio, financeiro e configurações.
- **Responsáveis.** Equipe de Suporte (Nível 1). Escalonamento
  conforme Cap. 8.
- **Quando utilizar.** Sempre que houver contato de cliente ou parceiro
  por qualquer canal, ou alerta de merchant impactado.

---

## Capítulo 2 — Perfis atendidos

- **Cliente.** Consumidor final. Acessa `/entrar`, `/{slug}`,
  `/meus-pedidos`, `/meus-enderecos`, `/favoritos`, `/fidelidade`,
  `/beneficios`, `/pedido/$id`, `/cliente`.
- **Parceiro (Estabelecimento).** Owner do restaurante. Acessa
  `/auth` (login) e todas as telas em `/_authenticated/*`.
- **Administrador.** Governança global. Acessa `/admin_/login` e
  `/admin/*`.

Nenhum outro perfil existe na v1.0.

---

## Capítulo 3 — Atendimento ao Cliente

- **Cadastro / Login.** `/entrar` — e-mail/senha, Google ou Apple.
- **Recuperação de acesso.** `/esqueci-senha` → e-mail → `/redefinir-senha`.
- **Atualização de dados.** `/cliente` (perfil) e `/meus-enderecos`.
- **Pedidos.** Realizados em `/{slug}` → `/{slug}/checkout`;
  acompanhados em `/pedido/$id` (realtime) e `/meus-pedidos`.
- **Pagamentos.** Stripe Checkout ou Mercado Pago (legado) ou Dinheiro
  (conforme configuração do restaurante).
- **Fidelidade.** `/fidelidade` — saldo, histórico e resgates.
- **Histórico.** `/meus-pedidos`, `/favoritos`.

Chat/atendimento síncrono in-app com o cliente: **Não implementado na
v1.0**.

---

## Capítulo 4 — Atendimento ao Parceiro

- **Cadastro / Login.** `/auth` — **exclusivamente e-mail/senha**.
- **Stripe Connect.** `_authenticated/pagamentos` → `StripeConnectCard`
  (onboarding via `stripe-connect-create`, sync via
  `stripe-connect-refresh`).
- **Cardápio / Produtos.** `_authenticated/menu`, `units`, `inventory`,
  `suppliers`, `featured`, `promotions`.
- **Pedidos.** `_authenticated/orders`, `kitchen`, `OperationsCenter`.
- **Funcionários.** Gerenciados via `RestaurantSettingsService`
  (`src/lib/restaurant-settings/*`) em `_authenticated/settings`.
- **Configurações.** `_authenticated/settings`, `perfil`,
  `print-settings`.
- **Financeiro.** `_authenticated/finance`, `financial-center`,
  `finance-ai`.

Suporte in-app do parceiro: `_authenticated/support` (`KnowledgeBase`) +
`HelpFab`.

---

## Capítulo 5 — Problemas de pagamento

- **Checkout Stripe.** Verificar Edge Function `stripe-checkout`
  (logs). Confirmar `PaymentIntent` retornado ao cliente.
- **Pagamento recusado.** Orientar cliente a revisar cartão/limite. Não
  há reprocessamento automático — cliente precisa refazer o checkout.
- **Webhook.** `stripe-webhook` (Stripe) e `mp-webhook` (MP) com
  assinatura verificada; dedupe em `payment_webhook_events`. Consultar
  status por `event.id`.
- **Split.** Automático via `application_fee_amount` +
  `transfer_data.destination` (`StripeSplitService`). Valores derivam
  de `PlatformRevenueService` — sem hardcode.
- **Conciliação.** `payment_reconciliation` — relatórios manuais.
  Conciliação automatizada: **Não implementado na v1.0**.
- **Refund.** Back-end operacional via Stripe. UI de refund completa:
  **Não implementado na v1.0** (parcial na v1.0).

---

## Capítulo 6 — Problemas de pedidos

- **Pedido não recebido pelo restaurante.** Confirmar que webhook
  chegou (`payment_webhook_events`) e que pedido está em `pago`.
  Pedidos só entram no `KitchenDisplay` após confirmação.
- **Pedido cancelado.** Trigger de rollback do Loyalty (reverte
  reserve/commit). Reembolso via Stripe quando aplicável.
- **Pedido parado.** Verificar `OrderOrchestrator` + `OrderTimelineService`.
  Nunca forçar transição fora do orchestrator; nunca voltar para `novo`.
- **Pedido entregue.** Estado final `entregue` — EARN de Loyalty
  disparado, ledger registrado.

---

## Capítulo 7 — Programa de Fidelidade

- **Consulta de saldo.** Cliente em `/fidelidade`; suporte via
  `_authenticated/loyalty` (perfil restaurante) ou `/admin/clientes`.
- **Acúmulo (EARN).** Automático em `pago`/`entregue` com dedupe.
- **Resgate (REDEEM).** No checkout via `LoyaltyRedeemBlock`
  (reserve/commit).
- **Expiração.** Job `loyalty_expire_points`. Ajuste manual de saldo:
  **Não implementado na v1.0**.

---

## Capítulo 8 — Escalonamento

Níveis operacionais atuais:

- **N1 — Suporte.** Triagem, orientação, consulta em telas de admin.
- **N2 — Plataforma / Pagamentos.** Análise técnica em logs, Edge
  Functions, Stripe Dashboard, `IncidentCenter`.
- **N3 — Engenharia.** Bugs de código, migrations, incidentes P1.

Ferramenta formal de ticketing externa integrada: **Não implementado na
v1.0**. Registro de incidentes usa `IncidentCenter`
(`src/lib/observability/*`).

---

## Capítulo 9 — Boas práticas

- Confirmar identidade antes de qualquer alteração sensível (owner do
  restaurante, e-mail do cliente).
- Nunca compartilhar chaves de API, tokens ou dados de acesso ao
  backend com o usuário.
- Nunca forçar transições de pedido diretamente no banco — usar sempre
  as telas ou o `OrderOrchestrator`.
- Reproduzir o problema em preview antes de escalar.
- Registrar cada atendimento com passos executados e resolução.
- Respeitar sanitização de PII conforme `LoggingCenter`.

---

## Capítulo 10 — Checklist de encerramento do atendimento

- [ ] Problema reproduzido ou causa identificada.
- [ ] Ação executada (ou escalonamento realizado).
- [ ] Usuário notificado da resolução ou próximo passo.
- [ ] Registro no canal de suporte com passos e evidências.
- [ ] Incidente aberto em `IncidentCenter` se impacto sistêmico.
- [ ] Merchants afetados notificados via `NotificationCenter` (scope
      `operational`), quando aplicável.

---

## Capítulo 11 — FAQ

**Cliente**

- *"Meu pedido não aparece."* Verificar `/meus-pedidos` e confirmar
  pagamento aprovado. Pedidos sem webhook confirmado não avançam.
- *"Não consigo fazer login."* Usar `/esqueci-senha` ou trocar de
  provedor (Google/Apple/e-mail).
- *"Meus pontos não creditaram."* EARN acontece em `pago`/`entregue`.
  Confirmar o status do pedido.

**Parceiro**

- *"Não consigo entrar com Google/Apple."* Comportamento esperado —
  parceiros usam **exclusivamente e-mail/senha**. Orientar `/auth`.
- *"Stripe não aceita pagamentos."* Verificar
  `_authenticated/pagamentos` — `charges_enabled` e `payouts_enabled`
  devem estar `true`. Reexecutar sync se necessário.
- *"Pedido pago não entrou na cozinha."* Verificar
  `payment_webhook_events` para o `event.id` correspondente.

**Administrador**

- *"Preciso remover um parceiro criado por OAuth (legado)."* Seguir
  procedimento em `docs/RC2_SEC_001_REPORT.md` (transferência de
  `owner_id`).

---

## Capítulo 12 — Glossário

- **Cliente / Parceiro / Administrador.** Perfis da plataforma.
- **Slug.** Identificador do restaurante em `/{slug}`.
- **Owner.** Dono do restaurante.
- **PaymentService.** Fachada única do Payment Domain.
- **payment_webhook_events.** Tabela de dedupe/retry de webhooks.
- **payment_reconciliation.** Tabela de conciliação (manual na v1.0).
- **EARN / REDEEM.** Operações de acúmulo/resgate de Loyalty.
- **OrderOrchestrator.** Máquina de estados dos pedidos.
- **KnowledgeBase / HelpFab.** Componentes de suporte in-app do parceiro.
- **IncidentCenter / NotificationCenter.** Serviços de observability e
  notificações operacionais.

---

## Validação

Consistência conferida contra:
- `docs/LOCALIX_OPERATIONS_MANUAL.md`
- `docs/LOCALIX_ONBOARDING_PLAYBOOK.md`
- `docs/LOCALIX_INCIDENT_RUNBOOK.md`
- `docs/ARCHITECTURE_BASELINE.md`
- `docs/GO_LIVE_AUDIT.md`
- `docs/PRODUCTION_READINESS.md`
- Código: `src/routes/**`, `src/components/support/*`,
  `src/lib/observability/*`, `src/lib/payments/*`, `src/lib/orders/*`,
  `src/lib/restaurant-settings/*`, `supabase/functions/*`.

## Relatório final

**Estrutura.** 12 capítulos conforme escopo.

**Fontes.** Docs listados + inspeção direta do código-fonte.

**Inconsistências encontradas:** 0.

**Itens marcados como "Não implementado na v1.0":**
- Chat/atendimento síncrono in-app com o cliente.
- Ferramenta externa de ticketing integrada.
- Conciliação financeira automatizada.
- UI de refund completa.
- Ajuste manual de saldo de Loyalty.

**Confirmação.** O documento representa fielmente os procedimentos de
suporte atualmente implementados na Localix v1.0 RC2. Nenhum código ou
documentação existente foi alterado.
