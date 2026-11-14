# Gate 4 — Seis pendências, execução controlada e posição de GO (2026-11-14)

**Ambiente de execução:** `gvozcqyjhogmvebrwzap` Supabase isolado. **PR:** #100 `integration/gate4-financial-issue90` Draft. **Produção/Staging compartilhado:** sem alterações. **Gateway principal:** Mercado Pago; Stripe fora de escopo.

## Matriz real de seis pendências

| Pendência anterior | Status verificado | Resultado |
|---|---|---|
| 1 — Auth real/JWT HTTP (dono A/B/admin) | **BLOQUEADA** | Script segregado `scripts/gate4-homologation-auth-rpc-smoke.mjs` criado. Ele exige três usuários Auth reais, JWTs válidos, UUID da loja de teste e chave publicável. Ainda não executado; o projeto isolado tem **0 usuários Auth persistentes**, sem sessões reais para o HTTP. Claims simulados em SQL não substituem Auth |
| 2 — Receiver + worker Mercado Pago TEST | **BLOQUEADA** | `list_edge_functions` confirmou **0 funções** no projeto isolado. Nenhum segredo, OAuth vendedor ou token MP TEST verificado. Deploy de webhook sem segredo e autenticação validada não seria homologação real |
| 3 — Transações E2E PIX/cartão/split/refund/chargeback/payout/conciliação | **BLOQUEADA** | CI e SQL isolado passaram testes simulados de idempotência, refund/chargeback/CAS; não há transações confirmadas pelo MP TEST, nem conciliação real de repasse |
| 4 — Segurança `public.has_role` | **CORRIGIDA NO SANDBOX, NÃO PROMOVIDA** | Função `SECURITY DEFINER` agora somente responde para `_user_id=auth.uid()`. Teste SQL em transação: non-admin não enumera papel admin alheio, admin vê próprio papel e policies RLS por identidade continuam passando. O advisor ainda mostra WARN estático por execução de função definer; a exploração reproduzida foi eliminada no cenário testado. Necessário auditar consumidores de service-role e rodar JWT/Auth real antes de Staging/Production |
| 5 — Integridade de pagamentos e taxa | **PARCIAL — UMA LACUNA CORRIGIDA** | CHECK `payments_completed_requires_order` impede `approved/paid` sem `order_id` no sandbox. Teste negativo aprovou (rejeição), `pending` sem order permaneceu permitido; checkout/snapshot/RLS reexecutados PASS. O trigger legado de taxa que usa `orders.total` permanece possível em inserts diretos service-role sem snapshot; não há prova de todos os writers do OrderService/PricingEngine. Não bloquear novos pedidos offline sem contrato |
| 6 — DEC-021, classificação econômica e fórmula de saldo | **BLOQUEADA POR APROVAÇÃO/PROVA** | Modelo C de subledgers segregados só aprovado em princípio; fórmula final, regra de titularidade da taxa, cash/receivables, split, liquidação e migração histórica NÃO aprovadas. Guard fail-closed de base mista continua intacto. Precisa evidência MP e aceite explícito do contrato contábil antes de implementação |

## Mudanças realmente executadas

- Migration **`gate4_security_payment_orphan_guard_isolated`**, registrada no projeto isolado em `20261114165532`; fonte versionada em `supabase/homologation/gate4_security_payment_orphan_guard.sql`.
- Script de regressão **`scripts/gate4-h4-security-payment-guard-rollback.sql`**, executado com PASS.
- Script de smoke Auth segregado **`scripts/gate4-homologation-auth-rpc-smoke.mjs`**, preparado **mas NÃO executado** por ausência das sessões exigidas.
- Reexecutados no PostgreSQL isolado: checkout idempotente, conflito de hash, RLS do parceiro, RLS admin. **PASS**.
- Verificação pós-testes: zero usuários, restaurantes, pedidos, pagamentos, ledger, snapshots, vínculos, eventos, fila e chaves de checkout; CHECK e proteção `has_role` persistidos.
- Sem deploy de Edge Function, cron, secrets, merge, alterações em Production/Staging ou operações Mercado Pago.

## Motivos impeditivos que não podem ser removidos apenas com SQL de auditoria

1. **JWT real** depende de três identidades Auth test no Supabase isolado, sessão legítima por usuário e acesso HTTP. Não usar JWT inventado; não copiar credenciais ou usuários reais do Staging/Production.
2. **Mercado Pago TEST** depende de contas de teste vendedor/comprador e credenciais por ambiente, OAuth e webhook assinatura, configurados via canal de segredos do projeto isolado. Ausência de deployment e segredos significa que retorno 200 simulado NÃO certifica o fluxo.
3. **Contabilidade** depende da decisão explícita do modelo econômico final, evidência de captura, descontos, fee, split e repasse. O projeto mantém veto anterior a implementar DEC-021 sem autorização contábil específica.

## Próximos critérios de aceitação (não realizados)

- Preencher as 5 variáveis `GATE4_HOMO_*` por canal seguro, 3 JWTs autenticados via Auth, restaurante fixture sintético com ledger; executar o novo smoke contra o isolado; 401/403 para anon e 1/0/1 entradas para owner/outro/admin.
- Implantar no isolado `mp-webhook` e `mp-webhook-retry` SOMENTE depois de confirmar TEST secrets, assinatura HMAC, API token de vendedor de teste, worker secret/replay secret/cutover, funções não apontando produção; iniciar sem cron. Testar estados aprovado, pendente, recusado, duplicatas, refund parcial/total, chargeback, erro de gateway, replay e estorno em nome de duas lojas.
- Com MP TEST, conciliar pedido/PaymentService/OrderService/Ledger/snapshot, gateway fee, platform revenue e recebíveis por pagador sob regras DEC-015.
- Validar todos os caminhos legítimos de gravação de `orders` e `payments` com o novo CHECK e a guarda `has_role`; só depois promover.
- Formalizar DEC-021 — contas separadas, classificação de cada lançamento, preço autorizado, reconciliação de liquidação, reversões e testes; obter aceite explícito antes de migration financeira.
- GO somente após esses resultados, decisão contábil e verificação integral de CI no SHA final.

**Conclusão honesta:** duas correções técnicas foram aplicadas no sandbox, porém **as seis pendências não estão integralmente encerradas**. Gate Financeiro permanece **NO-GO**. Não foi possível provar E2E MP e JWT, nem contrato contábil final. Preservar PR Draft e bloqueios conservadores. **Esta decisão deve atualizar o Documento Mestre** quando formalmente aprovada e promovida.
