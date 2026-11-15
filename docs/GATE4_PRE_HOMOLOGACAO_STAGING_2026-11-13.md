# Gate 4 — Pré-homologação final de Staging (somente leitura)
Data da inspeção: 2026-11-13. Escopo: Supabase Staging `dnotmvbhuqujvqdtgzav`; PR integrado #100.

## Auditoria realizada sem alterações
- `supabase_migrations.schema_migrations` inventariado por list_migrations: versão aplicada `20261111212209_gate4_consistent_financial_snapshot`; repositório PR #100 contém `20261111204106_gate4_consistent_financial_snapshot.sql`.
- O arquivo do repositório declara RPC `get_restaurant_financial_snapshot(uuid)` como `LANGUAGE sql STABLE SECURITY INVOKER`, snapshot de uma só declaração MVCC, limite de 50000 entries (+1 para completar flag), autenticação obrigatória e `GRANT EXECUTE` a `authenticated`.
- `pg_get_functiondef('public.get_restaurant_financial_snapshot(uuid)'::regprocedure)` em Staging: definição SQL estruturalmente compatível (mesmos filtros, ordenação, limite e JSON); `pg_proc.prosecdef=false` confirma invoker, `provolatile='s'` confirma STABLE. `has_function_privilege('authenticated', ...,'EXECUTE')=true`; para `anon`, false.
- Tabelas `financial_ledger`, `orders`, `order_payment`, `payments`, `payment_webhook_events` e `payment_event_queue` estão com RLS habilitada (`pg_class.relrowsecurity=true`).
- Políticas `financial_ledger` SELECT: administrador autenticado com role admin, ou proprietário autenticado de restaurante correspondente (confirmado em `pg_policies`).
- Índices presentes: `financial_ledger_mp_idempotency_uidx` parcial para eventos Mercado Pago PAYMENT_PENDING, PAYMENT_APPROVED, PAYMENT_FAILED, REFUND e CHARGEBACK com metadata `ledger_idempotency_key`; `financial_ledger_mp_payment_type_idempotency_uk`; UNIQUE parcial `payment_webhook_events(provider,event_id)`; índice `payment_event_queue(status,next_retry)`.
- Edge Function `mp-webhook` versão 32 ACTIVE; **nenhuma `mp-webhook-retry` implantada**.
- `payment_webhook_events`: 2 entradas, 1 pendente e 1 concluída. `payment_event_queue`: 1 entrada pendente, sem falhas/completos, com `next_retry` em 2026-08-12 18:22:13 UTC.

## Decisões de homologação
1. **A divergência de numeração de migration não foi resolvida por renomeação nem reaplicação.** A definição da RPC parece semanticamente equivalente, mas não foi possível provar equivalência criptográfica/byte-a-byte do histórico original. A partir daqui: não executar a migration de mesmo nome sem análise de drift e histórico. Registrar a versão aplicada em staging como fonte histórica e preparar eventual reconciliação documental, não duplicar `CREATE FUNCTION` em produção.
2. A presença de RLS, grants e índices confirma controles de estrutura, mas NÃO demonstra E2E de políticas com tokens de owner/manager/customer/anon, processamento de créditos, pagamentos ou captura no gateway.
3. NÃO reprocessar a fila legada; o evento de agosto requer conciliação com o Mercado Pago antes de qualquer tentativa de recuperação. Exigir `MP_WEBHOOK_RETRY_CUTOVER` aprovado.
4. PR #100 ainda Draft e sua CI aprovada 5/5 é condição necessária, mas insuficiente para GO financeiro.

## Sequência de homologação controlada, sem produção
- Fase H1 — Confirmar conta sandbox Mercado Pago e credenciais de vendedor de TESTE, criar *ambiente isolado* com schema/migrations versionados e dados 100% fictícios. Não copiar dados de clientes/segredos reais.
- Fase H2 — Aplicar e validar RLS/RBAC e contratos RPC reais, service-role restrito, assinatura externa e replay interno com segredo rotacionável. Comparar migrações antes de aplicar.
- Fase H3 — Executar PIX/cartão sandbox via checkout real do Localix no ambiente de teste: conferir **mesma identidade** de pedido, order_payment, payments, evento e ledger; validar um único efeito por referência e transição de pedido.
- Fase H4 — Injetar duplicata concorrente, timeout, parcialidade, refund, chargeback e falha de transição; exigir recuperação/alerta, idempotência e conciliação de cada operação com API Mercado Pago. Inspecionar logs sem dados sensíveis.
- Fase H5 — Validar cálculo econômico DEC-015: até R$30 taxa R$0,99; acima R$30 taxa R$1,49. A DEC-021 **não** possui autorização de fórmula definitiva: bloquear bases ambíguas até aprovação formal e registrar eventuais dados pré-existentes sem reescrita.
- Fase H6 — GO explícito financeiro/técnico e plano de rollback ANTES de merge, deploy, cron ou uso de credenciais reais.

## Bloqueios identificados
- Falta homologação E2E externa e ambiente financeiro isolado disponível para execução segura.
- Worker implantado no Staging: não.
- Divergência da versão numérica da migration: análise histórica pendente.
- Evento pendente antigo: conciliação MP não realizada.
- DEC-021: aprovado princípio contábil, não a implementação da fórmula.

**Conclusão:** PR #100 pronto para revisão funcional, Staging estruturalmente compatível nas superfícies inspecionadas. **Não foi possível provar GO financeiro.** Não houve escrita no banco, deploy, merge, processamento de eventos ou alterações de ambiente na inspeção.
