# LOCALIX LAUNCH PLAN — v1.0 RC2

Plano oficial de Go Live da Localix v1.0 RC2. Reflete exclusivamente os
processos e critérios já definidos. Itens ausentes estão marcados como
**"Não implementado na v1.0"**.

Data: 2026-07-06 · Status: Feature Freeze

---

## Capítulo 1 — Objetivo do Go Live

- **Finalidade.** Autorizar a operação da Localix v1.0 RC2 em
  produção, promovendo o soft launch validado no piloto
  (`docs/LOCALIX_PILOT_PLAN.md`) para operação regular.
- **Escopo.** Frontend publicado (Publish/Lovable), backend Lovable
  Cloud (migrations + Edge Functions), integrações Stripe (Checkout +
  Connect + Split + Webhook), Mercado Pago legado, observability e
  suporte.
- **Responsáveis.** Engenharia, Segurança, Produto e Plataforma —
  assinatura formal em `docs/GO_LIVE_CHECKLIST.md`. On-call ativo
  conforme `docs/OPERATIONS_MANUAL.md` §8.
- **Critérios para início.** `docs/GO_LIVE_CHECKLIST.md` 100% verde
  (exceto itens explicitamente reservados para v1.1) e nenhum
  bloqueador 🔴 aberto em `docs/GO_LIVE_AUDIT.md`.

---

## Capítulo 2 — Pré-requisitos

Consolidados de `docs/GO_LIVE_AUDIT.md`, `docs/GO_LIVE_SCORE.md`,
`docs/PRODUCTION_READINESS.md` e `docs/GO_LIVE_CHECKLIST.md`:

- **Build & Deploy.** `bun run build` sem erros; suíte 100% verde
  (39 arquivos · 444 testes); sem segredos vazados; sem TODO/FIXME
  crítico bloqueando release.
- **Ambientes.** Preview, Produção e Backend estáveis.
- **Secrets runtime.** `LOVABLE_API_KEY`, `MP_APP_ID`,
  `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_TOKEN_ENCRYPTION_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`; nenhum segredo em `.env` versionado.
- **Banco.** 115 tabelas em `public` com RLS habilitada e GRANT
  explícito; 0 migrations pendentes; índices críticos aplicados;
  `has_role` auditada; backup diário automático.
- **Edge Functions.** `mp-*` e `stripe-*` publicadas; `verify_jwt`
  correto por função; `createServerFn` + `requireSupabaseAuth` +
  `attachSupabaseAuth`.
- **Webhooks públicos.** `/api/public/mp/callback` idempotente por
  `state`; `/api/public/mp/webhook` com HMAC + `timingSafeEqualStr`.
- **Segurança.** `docs/SECURITY_CHECKLIST.md` 100% verde; nenhum
  finding crítico aberto em `security--get_scan_results`. HIBP e MFA
  admin marcados como recomendados / v1.1.
- **Score geral.** 92/100 em `docs/GO_LIVE_SCORE.md`; 0 bloqueadores.

---

## Capítulo 3 — Checklist de preparação

- **Infraestrutura.** Lovable Cloud healthy (`supabase--cloud_status`);
  logs Edge Functions acessíveis; storage buckets privados com
  policies (ex.: `product-images`).
- **Banco.** Migrations aplicadas; RLS + GRANT por tabela pública;
  triggers `enforce_partner_email_only` e `enforce_role_email_only`
  ativos (`docs/RC2_SEC_001_REPORT.md`).
- **Stripe.** Connect Express operacional; webhook assinado; dedupe
  via `payment_webhook_events`; split via
  `StripeSplitService` (`application_fee_amount` +
  `transfer_data.destination`).
- **Autenticação.** Cliente: e-mail/Google/Apple; Parceiro/Admin:
  exclusivamente e-mail/senha (triggers + guards em
  `_authenticated/route.tsx` e `admin.tsx`).
- **Documentação.** Suite oficial listada no Cap. 8.
- **Observabilidade.** `LoggingCenter`, `MetricsCenter`,
  `HealthCenter`, `AlertCenter`, `IncidentCenter`,
  `OperationsDashboard` operacionais.
- **GitHub.** `.github/workflows/ci.yml` (lint, typecheck, testes,
  build); `.gitignore` sem segredos; `docs/GITHUB_AUDIT.md` verde.
- **Deploy.** Frontend via Publish (Lovable); backend
  (edge functions + migrations) automático.

---

## Capítulo 4 — Sequência de execução

Exatamente conforme processo atual:

```text
Validação (GO_LIVE_CHECKLIST §1–§8)
   ↓
Backup automático confirmado (Lovable Cloud)
   ↓
Deploy — Publish frontend + edge/migrations automáticos
   ↓
Smoke Test em produção (GO_LIVE_CHECKLIST §9)
   ↓
Monitoramento — OperationsDashboard + AlertCenter + IncidentCenter
   ↓
Liberação — tráfego real habilitado (soft launch → full launch)
   ↓
Acompanhamento — on-call ativo, rotinas diárias (OPERATIONS_MANUAL §2)
```

Pipeline de deploy com aprovações manuais externas / blue-green /
canary: **Não implementado na v1.0**.

---

## Capítulo 5 — Validação pós-publicação

Verificações previstas (`docs/GO_LIVE_CHECKLIST.md` §9):

- [ ] Cadastro de restaurante + login owner.
- [ ] Cadastro de produto + publicação no catálogo.
- [ ] Pedido cliente → checkout → Pix.
- [ ] Webhook MP → `APPROVED` → pedido em produção.
- [ ] Fluxo de delivery até `ENTREGUE`.
- [ ] Dashboard financeiro reflete a venda.
- [ ] Notificação em tempo real chega ao merchant.
- [ ] Painel admin lista o novo restaurante.

Adicionalmente:
- Confirmar `charges_enabled` / `payouts_enabled` em restaurantes
  ativos.
- Conferir métricas p95 (`response_ms`, `edge_function_ms`) contra os
  valores de referência de `docs/GO_LIVE_AUDIT.md` §9.

---

## Capítulo 6 — Rollback

Procedimentos existentes (`docs/ROLLBACK_GUIDE.md` +
`docs/DISASTER_RECOVERY_PLAN.md`):

- **Frontend.** Reversão via Publish (versão anterior).
- **Backend / migrations.** Migração reversa quando aplicável; caso
  contrário, seguir `DISASTER_RECOVERY_PLAN.md`.
- **Edge Functions.** Redeploy da versão anterior.
- **Banco.** Restore a partir do backup diário automático (Lovable
  Cloud), sempre com alinhamento Plataforma + Segurança.
- **Feature flags.** Kill switch via
  `platformConfiguration.killSwitch.enable('key', reason)`.

PITR exposto ao operador e restauração parcial por tenant: **Não
implementado na v1.0**.

---

## Capítulo 7 — Critérios de encerramento do Go Live

- Todos os itens de `docs/GO_LIVE_CHECKLIST.md` marcados (exceto
  reservados para v1.1: HIBP e MFA admin).
- Smoke test em produção (Cap. 5) executado com sucesso.
- Sem incidentes P1 abertos.
- Métricas p50/p95/erros dentro dos valores de referência.
- Autorização formal em `docs/GO_LIVE_CHECKLIST.md` — Engenharia,
  Segurança, Produto.
- Registro do lançamento (Cap. 10) preenchido.

---

## Capítulo 8 — Documentação obrigatória

Suite oficial existente:

- `docs/LOCALIX_BUSINESS_MODEL_V1.md`
- `docs/ARCHITECTURE_BASELINE.md`
- `docs/GO_LIVE_AUDIT.md`
- `docs/GO_LIVE_SCORE.md`
- `docs/GO_LIVE_CHECKLIST.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/RELEASE_CANDIDATE_RC1.md`
- `docs/RC2_SEC_001_REPORT.md`
- `docs/LOCALIX_OPERATIONS_MANUAL.md`
- `docs/LOCALIX_ONBOARDING_PLAYBOOK.md`
- `docs/LOCALIX_INCIDENT_RUNBOOK.md`
- `docs/LOCALIX_SUPPORT_PLAYBOOK.md`
- `docs/LOCALIX_COMMERCIAL_PLAYBOOK.md`
- `docs/LOCALIX_PILOT_PLAN.md`
- `docs/OPERATIONS_MANUAL.md`, `docs/OPERATIONS_RUNBOOK.md`,
  `docs/OBSERVABILITY_GUIDE.md`
- `docs/DEPLOYMENT_GUIDE.md`, `docs/ROLLBACK_GUIDE.md`,
  `docs/DISASTER_RECOVERY_PLAN.md`
- `docs/SECURITY_GUIDE.md`, `docs/SECURITY_CHECKLIST.md`
- `docs/PERFORMANCE_GUIDE.md`, `docs/PERFORMANCE_REPORT.md`
- `docs/TECHNICAL_DEBT.md`, `docs/TECHNICAL_HEALTH_REPORT.md`
- `docs/PAYMENT_DOMAIN_FINAL_REPORT.md`,
  `docs/DOMAIN_MANIFEST_PAYMENT.md`,
  `docs/STRIPE_CONNECT_DOMAIN.md`, `docs/STRIPE_CONNECT_ONBOARDING.md`,
  `docs/STRIPE_ACCOUNT_LIFECYCLE.md`, `docs/STRIPE_SPLIT.md`,
  `docs/STRIPE_DOMAIN_REPORT.md`, `docs/STRIPE_SANDBOX.md`,
  `docs/FINANCIAL_SETTLEMENT.md`,
  `docs/PLATFORM_REVENUE_ARCHITECTURE.md`,
  `docs/PLATFORM_REVENUE_DOMAIN.md`, `docs/PLATFORM_REVENUE_FLOW.md`,
  `docs/PLATFORM_REVENUE_EVENTS.md`
- `docs/GITHUB_AUDIT.md`
- `CHANGELOG.md`, `README.md`, `CONTRIBUTING.md`, `LICENSE`, `ROADMAP.md`

---

## Capítulo 9 — Checklist final

- [ ] `GO_LIVE_CHECKLIST.md` §1–§10 conferido.
- [ ] Nenhum bloqueador 🔴 aberto em `GO_LIVE_AUDIT.md`.
- [ ] Score ≥ 92/100 em `GO_LIVE_SCORE.md`.
- [ ] Segurança: sem findings críticos em
      `security--get_scan_results`.
- [ ] Backup diário ativo (Lovable Cloud).
- [ ] Rollback ensaiado em staging (`DISASTER_RECOVERY_PLAN.md`).
- [ ] On-call escalado e ciente.
- [ ] Comunicação interna preparada (`OPERATIONS_MANUAL.md` §9).
- [ ] Smoke test em produção pronto para executar imediatamente após
      deploy.
- [ ] Registro do lançamento (Cap. 10) preparado.

---

## Capítulo 10 — Registro do lançamento

Composição obrigatória (baseada em artefatos existentes):

- **Versão publicada.** Tag/commit de referência.
- **Data e horário do Publish.**
- **Responsáveis assinantes** (`GO_LIVE_CHECKLIST.md`).
- **Resultado do smoke test** (`GO_LIVE_CHECKLIST.md` §9).
- **Métricas iniciais** (p50/p95/erros — `MetricsCenter`).
- **Findings de segurança** no snapshot (`security--get_scan_results`).
- **Incidentes abertos** no dia (`IncidentCenter`).
- **Itens 🟡 residuais** em acompanhamento
  (`GO_LIVE_AUDIT.md` / `GO_LIVE_SCORE.md`).
- **Entrada correspondente no `CHANGELOG.md`.**

Automação de release notes / changelog dinâmico: **Não implementado
na v1.0**.

---

## Capítulo 11 — Glossário

- **Go Live.** Autorização e execução da operação regular em
  produção.
- **Soft launch / Full launch.** Tráfego controlado → tráfego total.
- **RC1 / RC2.** Release Candidates.
- **Smoke test.** Teste rápido de fluxo E2E em produção.
- **Publish.** Ação de publicar o frontend via Lovable.
- **Kill switch.** Feature flag de desativação imediata.
- **PITR.** Point-in-time recovery.
- **HIBP.** "Have I Been Pwned" — checagem de senha vazada.
- **MFA.** Multi-Factor Authentication.
- **On-call.** Responsável de plantão.

---

## Validação

Consistência conferida contra:
- `docs/LOCALIX_OPERATIONS_MANUAL.md`
- `docs/LOCALIX_ONBOARDING_PLAYBOOK.md`
- `docs/LOCALIX_INCIDENT_RUNBOOK.md`
- `docs/LOCALIX_SUPPORT_PLAYBOOK.md`
- `docs/LOCALIX_COMMERCIAL_PLAYBOOK.md`
- `docs/LOCALIX_PILOT_PLAN.md`
- `docs/GO_LIVE_AUDIT.md`, `docs/GO_LIVE_SCORE.md`,
  `docs/GO_LIVE_CHECKLIST.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/ROLLBACK_GUIDE.md`, `docs/DISASTER_RECOVERY_PLAN.md`
- `docs/ARCHITECTURE_BASELINE.md`

## Relatório final

**Estrutura.** 11 capítulos conforme escopo.

**Fontes.** Docs listados acima.

**Inconsistências encontradas:** 0.

**Itens marcados como "Não implementado na v1.0":**
- Pipeline de deploy com aprovações externas / blue-green / canary.
- PITR exposto ao operador.
- Restauração parcial por tenant.
- Automação de release notes / changelog dinâmico.

**Confirmação.** O documento representa fielmente o plano oficial de
lançamento da Localix v1.0 RC2. Nenhum código ou documentação
existente foi alterado.
