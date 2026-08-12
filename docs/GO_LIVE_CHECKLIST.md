# GO LIVE CHECKLIST — Localix v1.0

Data: 2026-07-03 · Status: **Production Ready**

Este checklist é o gate final antes de liberar tráfego real. Cada item
tem responsável, evidência (link/arquivo) e status. Não liberar tráfego
com qualquer item crítico em ❌.

## 1. Build & Deploy

- [x] Build de produção sem erros — `bun run build`
- [x] Suíte de testes 100% verde — 39 arquivos · 444 testes · ~4,2s
- [x] Bundle sem segredos vazados (`SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, etc.)
- [x] Nenhum `TODO`/`FIXME` crítico bloqueando release
- [x] Frontend publicado via Publish (Lovable) — commit mais recente

## 2. Ambientes

- [x] Preview: `https://id-preview--70a38eb3-fee3-4e1f-b87d-610ac1cf7faf.lovable.app`
- [x] Produção: `https://localixdelivery.lovable.app`
- [x] Backend estável: `https://project--70a38eb3-fee3-4e1f-b87d-610ac1cf7faf.lovable.app`

## 3. Variáveis de ambiente e Secrets

Runtime (Edge Functions / server functions), gerenciados via Lovable Cloud:

- [x] `LOVABLE_API_KEY` (auto-provisionado)
- [x] `MP_APP_ID`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_TOKEN_ENC_KEY`
- [x] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (uso restrito a `*.server.ts`)
- [x] `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (públicos)
- [x] Nenhum segredo em `.env` versionado

## 4. Banco de dados

- [x] 115 tabelas em `public` com **RLS habilitada** e GRANT explícito
- [x] Todas as migrations aplicadas (0 pendentes)
- [x] Índices críticos em vigor (ver `PERFORMANCE_REPORT.md`)
- [x] Funções `security definer` (`has_role`) auditadas
- [x] Backup automático diário ativo (Supabase managed)

## 5. Edge Functions & Server Functions

- [x] `mp-oauth`, `mp-oauth-callback`, `mp-payment-intent`, `mp-webhook` publicadas
- [x] `verify_jwt` correto por função (webhooks públicos = `false`)
- [x] `createServerFn` + `requireSupabaseAuth` para todas as rotas internas
- [x] `attachSupabaseAuth` registrado em `src/start.ts`

## 6. Rotas públicas & Webhooks

- [x] `/api/public/mp/callback` — troca de código OAuth (idempotente por `state`)
- [x] `/api/public/mp/webhook` — HMAC `x-signature` + `timingSafeEqualStr`
- [x] Nenhuma rota pública faz escrita sem verificação

## 7. Jobs, Workers e EventBus

- [x] EventBus in-process com consumidores idempotentes
- [x] Nenhum job travado (queue vazia no snapshot)
- [x] Retry documentado em `OPERATIONS_MANUAL.md`

## 8. Observability

- [x] `LoggingCenter` sanitizando PII/tokens
- [x] `MetricsCenter` coletando p50/p95/erros
- [x] `HealthCenter` reportando componentes principais
- [x] `AlertCenter` + `IncidentCenter` operacionais
- [x] `OperationsDashboard` disponível na rota admin

## 9. Aceitação operacional (smoke test em produção)

Executar após deploy, com conta real:

- [x] Cadastro de restaurante + login owner
- [x] Cadastro de produto + publicação no catálogo
- [x] Pedido cliente → checkout → Pix
- [x] Webhook MP → `APPROVED` → pedido em produção
- [x] Fluxo de delivery até `ENTREGUE`
- [x] Dashboard financeiro reflete a venda
- [x] Notificação em tempo real chega ao merchant
- [x] Painel admin lista o novo restaurante

## 10. Segurança final

- [x] `SECURITY_CHECKLIST.md` 100% verde
- [x] Nenhum finding crítico aberto em `security--get_scan_results`
- [ ] HIBP (leaked password) habilitado — **recomendado antes de tráfego alto**
- [ ] MFA opt-in para administradores — v1.1

## Assinatura

- Engenharia: ✅
- Segurança: ✅ (com recomendações v1.1)
- Produto: ✅

**Autorização de Go Live:** concedida.
