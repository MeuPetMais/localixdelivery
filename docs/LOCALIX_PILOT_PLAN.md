# LOCALIX PILOT PLAN — v1.0 RC2

Plano operacional oficial para execução do piloto da Localix. Reflete
exclusivamente o modelo atualmente definido. Itens ausentes estão
marcados como **"Não implementado na v1.0"**.

Data: 2026-07-06 · Status: Feature Freeze

---

## Capítulo 1 — Objetivo do piloto

- **Finalidade.** Validar em produção controlada (soft launch) a
  operação ponta-a-ponta da Localix v1.0 RC2 antes do full launch,
  conforme veredito de `docs/PRODUCTION_READINESS.md` e
  `docs/GO_LIVE_AUDIT.md`.
- **Escopo.** Fluxo real de pedidos, pagamentos via Stripe Connect,
  cozinha, entrega, fidelidade, financeiro e suporte, com merchants
  reais.
- **Responsáveis.** Comercial (seleção), Onboarding (implantação),
  Suporte (N1), Plataforma / Pagamentos (N2), Engenharia (N3), com
  on-call ativo (`docs/OPERATIONS_MANUAL.md` §8).
- **Duração prevista.** 3 a 5 dias úteis para fechar os itens 🟡
  identificados na RC1 (`docs/GO_LIVE_AUDIT.md` — Sumário;
  `docs/PRODUCTION_READINESS.md`). Prazo formal por merchant: **Não
  implementado na v1.0**.
- **Critérios de início.** `docs/GO_LIVE_CHECKLIST.md` 100% verde
  (exceto itens explicitamente marcados como v1.1) e nenhum bloqueador
  🔴 aberto.

---

## Capítulo 2 — Critérios para seleção dos estabelecimentos

Aderentes a `docs/LOCALIX_BUSINESS_MODEL_V1.md` §1/§4 e
`docs/LOCALIX_COMMERCIAL_PLAYBOOK.md` Cap. 2/3:

- **Segmentos.** Restaurantes, pizzarias, hamburguerias, açaiterias,
  esfiharias, cafeterias e operações de delivery com volume
  operacional consistente.
- **Operação de delivery** ativa.
- **Volume mínimo.** 600 pedidos/mês (meta de referência durante a
  implantação).
- **Ticket mínimo.** R$ 20,00.
- **Requisitos técnicos.** Capacidade de concluir KYC/KYB no Stripe;
  disponibilidade para treinamento; aceite do checkout Localix.
- **Aceite formal.** Modelo de R$ 0,99 por pedido, sem mensalidade e
  sem comissão sobre faturamento.

Nenhum critério novo é criado neste plano.

---

## Capítulo 3 — Preparação do ambiente

Etapas existentes (`docs/LOCALIX_ONBOARDING_PLAYBOOK.md`):

1. **Cadastro.** `/auth` (e-mail/senha — obrigatório para parceiros).
2. **Onboarding.** `OwnerOnboarding` + `_authenticated/settings` /
   `perfil`.
3. **Stripe Connect.** `_authenticated/pagamentos` → onboarding via
   `stripe-connect-create`; sync via `stripe-connect-refresh`
   (`charges_enabled`, `payouts_enabled`).
4. **Cardápio.** `_authenticated/menu`, `units`, `inventory`,
   `featured`, `promotions`.
5. **Homologação.** Checklist de homologação (Playbook de Onboarding,
   Cap. 11) + `/admin/aprovacoes` quando aplicável.
6. **Publicação.** Restaurante visível em `/{slug}`.

---

## Capítulo 4 — Execução do piloto

Fluxo exatamente conforme implementação:

```text
Implantação
   ↓
Treinamento nas telas (dashboard, orders, kitchen, finance, menu, pagamentos)
   ↓
Primeiro pedido em /{slug}
   ↓
Primeiro pagamento (Stripe Checkout → webhook confirma → status "pago")
   ↓
Primeira produção (KitchenDisplay)
   ↓
Primeira entrega (DeliveryPanel → status "entregue")
   ↓
Primeiro crédito de fidelidade (EARN via loyalty.functions.ts)
   ↓
Registro no ledger append-only (LedgerService)
   ↓
Validação operacional (smoke test do GO_LIVE_CHECKLIST.md §9)
```

Automação de "pilot cohort" com múltiplos merchants em paralelo: **Não
implementado na v1.0**.

---

## Capítulo 5 — Monitoramento

Indicadores efetivamente acompanhados hoje:

- **Performance** (`docs/GO_LIVE_AUDIT.md` §9): tempos médios de login
  (~800 ms), dashboard (~1,2 s), checkout (~1,5 s), lista de pedidos
  (~600 ms), analytics (~1,4 s), financeiro (~1,1 s).
- **p50/p95/erros** via `MetricsCenter` (`response_ms`,
  `edge_function_ms`) — `docs/OPERATIONS_MANUAL.md` §2.
- **Saúde geral** via `OperationsDashboard` + `HealthCenter`.
- **Alertas** via `AlertCenter`; incidentes via `IncidentCenter`.
- **Auditoria** via `AuditCenter` (categorias `admin`, `financial`,
  `auth`).
- **Webhook Stripe/MP:** taxa de sucesso, dedupe em
  `payment_webhook_events`.
- **Financeiro:** ledger reconcilia com Stripe (spot check diário).
- **Aceitação operacional:** itens de `docs/GO_LIVE_CHECKLIST.md` §9.

Nenhum KPI novo é criado.

---

## Capítulo 6 — Critérios de sucesso

Baseados em `docs/GO_LIVE_AUDIT.md` (🟢 Production Ready) e
`docs/PRODUCTION_READINESS.md`:

- Fluxo E2E do pedido concluído com sucesso: cadastro do restaurante,
  Stripe Connect ativo, pedido pago via webhook, produção na cozinha,
  entrega, fidelidade creditada, dashboard financeiro refletindo a
  venda.
- Nenhum bloqueador 🔴 aberto durante o piloto.
- Itens 🟡 residuais (UI refund, admin mobile, alertas proativos,
  rate limit generalizado, conciliação automatizada) sob
  acompanhamento — não regridem para 🔴.
- Smoke test do `docs/GO_LIVE_CHECKLIST.md` §9 executado com sucesso
  em produção.
- Nenhum incidente P1 aberto sem resolução.

Meta quantitativa formal (ex.: NPS mínimo, GMV alvo): **Não
implementado na v1.0**.

---

## Capítulo 7 — Critérios de encerramento

- Todos os critérios de sucesso do Cap. 6 atendidos.
- Itens 🟡 do RC1 endereçados ou formalmente aceitos para v1.1
  (`docs/GO_LIVE_AUDIT.md` Sumário — "3 a 5 dias úteis").
- Postmortem obrigatório para qualquer incidente P1 encerrado em até
  72h (`docs/OPERATIONS_MANUAL.md` §8).
- Autorização final por Engenharia, Segurança e Produto (assinatura
  em `docs/GO_LIVE_CHECKLIST.md`).
- Relatório final do piloto elaborado (Cap. 10).

---

## Capítulo 8 — Riscos conhecidos

Herança direta da RC1/RC2, sem novos riscos criados:

- **UI de refund parcial** (`GO_LIVE_AUDIT.md` §3).
- **Responsividade admin mobile** (`GO_LIVE_AUDIT.md` §7).
- **Alertas proativos externos ausentes** (`GO_LIVE_AUDIT.md` §10,
  `PRODUCTION_READINESS.md`).
- **Rate limit global ausente** — presente apenas em Edge Functions
  críticas.
- **Conciliação financeira automatizada ausente** — relatórios
  manuais em `payment_reconciliation`.
- **Parceiros legados criados via OAuth** — `docs/RC2_SEC_001_REPORT.md`
  já mitigado por triggers + guards, com procedimento seguro de
  transferência de `owner_id` documentado.

Nenhum bloqueador 🔴 identificado.

---

## Capítulo 9 — Checklist operacional

- [ ] Merchant selecionado atende Cap. 2.
- [ ] Onboarding concluído conforme Cap. 3.
- [ ] Stripe Connect: `charges_enabled = true` e
      `payouts_enabled = true`.
- [ ] Cardápio publicado (≥ 1 categoria + 1 produto).
- [ ] Smoke test E2E executado com sucesso (pedido pago → cozinha →
      entrega → EARN de Loyalty → ledger).
- [ ] `OperationsDashboard` verde.
- [ ] `AlertCenter` sem alertas P1 abertos.
- [ ] Notificações operacionais chegando ao merchant.
- [ ] Owner treinado nas telas essenciais.
- [ ] Nenhum bloqueador 🔴 no snapshot do dia.

---

## Capítulo 10 — Relatório final do piloto

Composição obrigatória (baseada nos artefatos existentes):

- **Escopo executado.** Merchants participantes e período.
- **Fluxo E2E validado.** Evidências dos smoke tests
  (`GO_LIVE_CHECKLIST.md` §9).
- **Indicadores.** Tempos médios (login, dashboard, checkout, orders,
  analytics, financeiro) e p50/p95/erros do `MetricsCenter`.
- **Incidentes.** Lista de incidentes abertos/fechados em
  `IncidentCenter`, com severidade e postmortem quando P1.
- **Itens 🟡.** Status de cada item herdado do RC1
  (`GO_LIVE_AUDIT.md` / `GO_LIVE_SCORE.md`).
- **Segurança.** Findings abertos em `security--get_scan_results`
  (conforme `GO_LIVE_CHECKLIST.md` §10).
- **Financeiro.** Reconciliação (manual) entre ledger e Stripe.
- **Decisão final.** Prosseguir para full launch ou estender piloto.

Templates automatizados de relatório: **Não implementado na v1.0**.

---

## Capítulo 11 — Glossário

- **Piloto / Soft launch.** Operação em produção controlada.
- **Full launch.** Liberação de tráfego sem restrição.
- **RC1 / RC2.** Release Candidates.
- **KYC / KYB.** Verificação de identidade / empresa conduzida pelo
  Stripe.
- **Split.** Repartição automática Stripe → restaurante + Localix.
- **PlatformRevenue.** Domínio único de receita da plataforma.
- **Smoke test.** Teste rápido de fluxo E2E em produção.
- **Postmortem.** Análise pós-incidente P1.
- **`charges_enabled` / `payouts_enabled`.** Flags Stripe.
- **`payment_webhook_events`.** Tabela de dedupe/retry de webhooks.

---

## Validação

Consistência conferida contra:
- `docs/LOCALIX_OPERATIONS_MANUAL.md`
- `docs/LOCALIX_ONBOARDING_PLAYBOOK.md`
- `docs/LOCALIX_SUPPORT_PLAYBOOK.md`
- `docs/LOCALIX_COMMERCIAL_PLAYBOOK.md`
- `docs/LOCALIX_BUSINESS_MODEL_V1.md`
- `docs/GO_LIVE_AUDIT.md`
- `docs/GO_LIVE_SCORE.md`
- `docs/GO_LIVE_CHECKLIST.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/RC2_SEC_001_REPORT.md`

## Relatório final

**Estrutura.** 11 capítulos conforme escopo.

**Fontes.** Docs listados acima.

**Inconsistências encontradas:** 0.

**Itens marcados como "Não implementado na v1.0":**
- Prazo formal do piloto por merchant.
- Automação de "pilot cohort" com múltiplos merchants em paralelo.
- Metas quantitativas formais (NPS mínimo, GMV alvo).
- Templates automatizados de relatório final do piloto.

**Confirmação.** O documento representa fielmente o plano de piloto
atualmente definido para a Localix v1.0 RC2. Nenhum código ou
documentação existente foi alterado.
