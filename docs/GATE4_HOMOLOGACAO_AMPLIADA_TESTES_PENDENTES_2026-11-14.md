# Gate Financeiro / Gate 4 — Homologação ampliada dos testes pendentes

**Data:** 2026-11-14  
**Alvo de execução:** Supabase exclusivamente isolado `gvozcqyjhogmvebrwzap`  
**Git:** `integration/gate4-financial-issue90`, PR #100 Draft  
**Fronteira:** somente SQL transacional descartável e leituras GitHub/Vercel/Supabase. **Sem novas migrations, deploy, merge, cron, Edge Function, pagamento Mercado Pago, alteração de Production ou Staging compartilhado nesta rodada.**

## 1. Resultado executivo

| Área | Resultado | Prova / limite |
|---|---|---|
| CI integrada | **PASS 5/5** | SHA `40aeaa07f51a7b39440c7404a3da49874ad7a0c9`, https://github.com/MeuPetMais/localixdelivery/actions/runs/43616044488 — Build, Lint, Typecheck, Tests, PostgreSQL concurrency |
| H2 contrato efetivo | **PASS 33/33** | Consulta SQL real repetida |
| H2 dependências | **PASS 21/21** | Consulta SQL real repetida |
| H2 profundidade | **PASS 29/29** | Consulta SQL real repetida |
| Checkout reentrante | **PASS** | Duas chamadas RPC: 1 pedido, 1 snapshot, 1 vínculo e 1 chave; mesmo ID, `reused=true` na segunda |
| Reutilização indevida de chave | **PASS** | Alteração do hash com mesma chave rejeitada por unique violation |
| Ledger MP e eventos duplicados | **PASS** | Índices únicos rejeitam repetição |
| Ledger parcial de refunds | **PASS SQL** | Dois IDs distintos: R$10 + R$5; repetição do primeiro rejeitada; **não comprova API MP nem valor máximo elegível** |
| Chargeback | **PASS SQL** | Lançamento único de R$20 por chargeback ID; duplicata rejeitada; **não comprova notificação/estorno externo** |
| Claim de fila e evento | **PASS sequencial SQL** | Primeira tentativa altera 1 linha, segunda 0, em `payment_event_queue` e `payment_webhook_events`. **Não é prova de duas sessões de worker remotas simultâneas** |
| Snapshot RLS por parceiro | **PASS SQL** | Próprio 1, outro 0, `complete=true`; claims `request.jwt.claim.sub` sintéticos |
| Leitura admin | **PASS SQL** | `has_role(admin)=true`, extrato visível para outro estabelecimento sob perfil administrativo |
| Volume 50.000 | **PASS** | `row_count=50000`, `complete=true`, `entries=50000` |
| Volume 50.001 | **PASS** | `row_count=50001`, `complete=false`, `entries=0`; fail-closed |
| Dois pagadores da taxa | **PASS SQL** | Subtotal R$30/cliente: total 30,99, fee 0,99; subtotal R$30,01/parceiro: total 30,01, fee 1,49, restaurante líquido 28,52. `orders.platform_fee` e `fixed_fee` coincidem com snapshot após RPC. **Dados fornecidos pelo teste à RPC, não prova PricingEngine E2E** |
| RBAC de acesso direto | **PASS grants** | `anon` não executa RPC de snapshot/checkout; `authenticated` executa snapshot, mas não checkout; `anon/authenticated` não inserem diretamente em orders/ledger/webhooks; `service_role` habilitada |
| Advisor health | **PASS** | Zero findings |
| Advisor security | **PENDÊNCIA** | WARN `has_role` + INFO para 3 tabelas service-only RLS sem policy; não abrir grants só para silenciar |
| Resíduos após rollback | **PASS** | zero auth users, restaurants, orders, pricing, order payments, payments, ledger, webhook events, queue e checkout keys; `platform_settings` singleton preservado |

**Todos os testes novos de banco envolveram dados sintéticos, transações `BEGIN/ROLLBACK` e nenhuma interação financeira externa.**

## 2. Achados negativos — defeitos reproduzidos, ainda não homologados

### SEC-01 — Enumeração de RBAC via `public.has_role`

**Fato:** usando o papel SQL `authenticated` e JWT claim sintético de usuário não-administrador, `public.has_role(id_de_outro_usuario,'admin')` retornou `true`. A função SQL SECURITY DEFINER verifica o argumento arbitrário em `user_roles`, em vez de restringir a consulta à identidade do solicitante. **Não prova acesso aos dados financeiros de outra loja**, mas comprova divulgação de papeis.

**Ensaio da mitigação:** dentro de `BEGIN/ROLLBACK`, substituição temporária por `_user_id = auth.uid() AND EXISTS (...)` passou: usuário não-admin não consulta papel alheio e admin continua identificando seu próprio papel. A versão original foi preservada após rollback. **Não migrar esta mudança sem auditoria de todos os consumidores de has_role**, especialmente administração de papéis e service_role.

### FIN-02 — `payments` permite pagamento aprovado sem pedido

**Fato:** INSERT sintético em `public.payments` com `order_id=NULL`, `status='approved'` e `amount=50` foi aceito sob executor privilegiado do ensaio. Autenticados comuns não têm INSERT nessa tabela. O ensaio **não prova que o webhook externo produza esse estado**, mas evidencia falta de restrição de integridade do banco neste caminho.

**Ensaio da mitigação:** CHECK condicional temporário `lower(status) NOT IN ('approved','paid') OR order_id IS NOT NULL`, dentro de BEGIN/ROLLBACK, rejeitou pagamento órfão aprovado e permitiu pendente sem pedido. Não foi aplicado, pois é necessário auditar fluxos legítimos legados e compatibilidade com Payments/PaymentService.

### FIN-03 — Trigger legado recalcula faixa a partir de `orders.total`

**Fato:** INSERT direto em `orders` com `total=R$30,99`, sem snapshot, produziu fee de R$1,49. Quando o subtotal econômico era R$30,00 e cliente pagava R$0,99 extra, a faixa autoritativa seria R$0,99. O ensaio confirma a regressão já caracterizada pelo `gate4-fee-boundary-characterization.test.ts`.

**Mitigação observada:** a RPC atômica grava snapshot em seguida e o trigger de sincronização restaura tanto `platform_fee` quanto `fixed_fee`; os dois cenários de pagador passaram. **Risco residual:** writers que gravem pedidos sem snapshot ou contornem o fluxo autoritativo. Revisar OrderService, escritores alternativos, triggers de pedido e PricingEngine antes de liberar.

## 3. Fluxos MP/worker cobertos na CI por adaptadores simulados

Em `supabase/functions/mp-webhook-retry/financial-flow.integration.test.ts` há cobertura de pagamento aprovado, duplicata idempotente, refund, chargeback, falha na persistência em `order_payment` e `payments`, falha de marcação de evento, transição de pedido recusada e divergência de valor.  
`worker-handler.integration.test.ts` cobre recuperação, replay falho, caller não autenticado, cutover histórico, evento não-financeiro e impossibilidade de consultar pagamento no gateway.  
`queue-lease-db.test.ts` caracteriza claim, recuperação de lease antigo e unicidade do Ledger em PostgreSQL embarcado. CI inclui teste de concorrência PostgreSQL real, porém sobre estrutura de fixture — **não sobre dois workers implantados em Supabase com Mercado Pago TEST**.

## 4. Dependências externas objetivas que continuam BLOQUEADAS

1. **Auth/JWT HTTP real:** Supabase isolado está com 0 usuários Auth persistentes após limpeza e não há no escopo conectado três sessões test reais (owner, outro owner, admin) para `GET /auth/v1/user` e `POST /rest/v1/rpc`. O teste via claims SQL NÃO substitui Auth/PostgREST. Script seguro existente: `scripts/gate4-staging-rpc-smoke.mjs`, porém aponta ao Staging compartilhado; requer versão explicitamente isolada/contas sintéticas antes de executar.
2. **Mercado Pago TEST:** `list_edge_functions` no projeto isolado retornou `[]`; sem receiver `mp-webhook` e worker `mp-webhook-retry` implantados, sem confirmação de segredos MP TEST/OAuth vendedor e webhook externo. A inspeção não leu nem expôs secrets. Vercel staging contém marcador `MP_ENVIRONMENT` e URLs de Supabase, mas isso NÃO prova sandbox isolado nem credenciais TEST. **Não implantar receiver/worker com fallback inseguro ou com credenciais reais sem preflight e autenticação completa**.
3. **Ponta a ponta financeiro:** PIX/cartão via API Mercado Pago TEST, OAuth/split entre contas de teste, reembolso parcial/total, chargeback real, payout confirmado e reconciliação com valores de gateway, títulos de recebível, taxas e status não puderam ser executados. Testes SQL de identidades não fornecem essa prova.
4. **DEC-021:** o usuário aprovou princípio de não contar pagamento bruto e recebível duas vezes e modelo conceitual de contas segregadas. Fórmula de saldo/reconciliação/pagadores/migração contábil NÃO aprovada. Guard contra saldo ambíguo segue obrigatório.
5. **Segurança:** SEC-01 requer correção compatível com RBAC; FIN-02 e FIN-03 requerem revisão de escritores e testes de regressão; nenhuma correção de produção autorizada nesta etapa.

## 5. Decisão de gate e condições para próximo GO

- **H2 técnico de banco:** PASS 54/54 + 29/29, encerrado antes e reconfirmado.
- **Homologação ampliada de PostgreSQL / CI:** cenários positivos **PASS** e três riscos negativos **reproduzidos**; rodada executada, documentada e sem resíduos.
- **Homologação financeira E2E Mercado Pago e segurança de liberação:** **BLOCK / NO-GO**. Não foi possível provar.
- **PR #100:** permanece Draft, não fazer merge ou produção.
- **Ações ainda exigidas:** revisar e corrigir SEC-01/FIN-02/FIN-03 em PRs de mínimo escopo com regressões; preparar usuários Auth reais e JWTs TEST em homologação, receiver + worker com secrets TEST e agendamento desligado; executar matrizes E2E por persona e pagamento; fechar contrato contábil DEC-021; obter aceite separado para deploy/GO.

**Esta decisão deve atualizar o Documento Mestre** quando as correções de segurança, contrato de saldo e regras de produção forem formalmente aceitas. Este relatório não registra aprovação de implantação.
