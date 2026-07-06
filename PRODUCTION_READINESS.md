# Production Readiness — Localix

## Checklist final

### Infraestrutura
- [x] Lovable Cloud (backend + auth + storage + edge functions).
- [x] Backups automáticos gerenciados.
- [x] Secrets configurados (Stripe, MP, Supabase, LOVABLE_API_KEY).

### Segurança
- [x] RLS em 100% das tabelas públicas.
- [x] `has_role` como security definer (sem recursão).
- [x] Middleware `requireSupabaseAuth` em serverFns sensíveis.
- [x] Edge Functions com `verify_jwt` quando aplicável.
- [x] Webhooks com verificação de assinatura.

### Pagamentos
- [x] Stripe Checkout operacional.
- [x] Stripe Connect Express — onboarding por restaurante.
- [x] Split automático via `transfer_data.destination`.
- [x] Idempotência em `payment_webhook_events` e `payment_split`.

### Dados
- [x] Ledger append-only.
- [x] Loyalty transacional com dedupe.
- [x] Order state machine sem regressão para `novo`.

### Operação
- [x] Logs de Edge Functions.
- [x] Retry em webhook queue.
- [ ] Alertas proativos (🟡 recomendado antes do full launch).
- [ ] Rate limit global (🟡 hoje somente pontual).
- [x] LGPD (consents, notificações, timeline).

## Veredito

**Pode entrar em produção?** **SIM**, em modo soft launch.

Bloqueadores: nenhum.
Tempo para full launch: **3 a 5 dias úteis** para fechar os itens 🟡.
