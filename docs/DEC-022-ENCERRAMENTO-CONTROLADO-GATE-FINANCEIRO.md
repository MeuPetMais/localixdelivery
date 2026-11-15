# DEC-022 — Encerramento controlado do Gate Financeiro

**Data:** 2026-11-15  
**Status:** APROVADA (método de encerramento); Gate Financeiro **NO-GO**  
**Escopo:** Localix Delivery, Supabase financeiro isolado `gvozcqyjhogmvebrwzap`  
**Referências:** Documento Mestre v1.0, DEC-021, PR #100, PR #101, pedido sintético #1001.

## Problema
A homologação financeira acumulou rodadas redundantes de testes, enquanto o bloqueio concreto persistiu no pagamento TEST do Mercado Pago. É necessário concluir por evidência, sem confundir CI PASS com fluxo financeiro aprovado.

## Contexto
A chamada PIX no ambiente isolado retornou `user_allowed_only_in_test`. No banco, o pedido #1001 permaneceu `aguardando_pagamento`, `order_payment=PENDING`, `payment_id=NULL` e nenhum registro em `payments` vinculado ao pedido. Esses fatos **não provam ausência de transação no gateway**. A alteração no PR #101 propõe validação de e-mail `@testuser.com`, mas não comprova a causa exclusiva do erro externo nem o vínculo com o comprador real.

Documentação oficial Mercado Pago:
- Split 1:1 Checkout Transparente usa `application_fee` na API `/v1/payments` e OAuth do vendedor.
- Contas TEST participam da simulação, com regras próprias.
- Testes de Pix via API Orders usam `/v1/orders` e resultados simulados; não são equivalentes automaticamente ao fluxo integrado do Localix via `/v1/payments`.

## Opções consideradas
A. Repetir bateria geral de migrations, Docker, RLS, SQL e CI: rejeitada — sem relação direta com erro externo.
B. Contornar autenticação/ownership, forçar pagamento SQL ou trocar gateway/endpoints sem contrato: rejeitada — risco financeiro.
C. Encerrar por critérios de evidência e única rodada focal: **aprovada**.

## Decisão
1. Congelar evidências técnicas já aprovadas; não repetir testes sem alteração do respectivo componente.
2. Não tentar novo POST de pagamento enquanto o gateway não confirmar inexistência de transação para `external_reference=5d047914-5ae0-4bab-9549-465e5d376317` e idempotency key da tentativa.
3. Tratar PR #101 como **hipótese em Draft**, não correção homologada. Validar identidade do pagador e contrato TEST com documentação/retorno do gateway antes de aprovar allowlist ou deploy.
4. Uma única rodada direcionada: pagamento TEST corretamente autorizado → webhook autenticado → estado de pedido → split do gateway → ledger/reconciliação. Sem sucesso, emitir NO-GO fundamentado e interromper reiterações.
5. DEC-021 permanece aprovada somente no princípio de não dupla contagem; nenhuma nova fórmula ou migration contábil fica autorizada.
6. Proibido alterar Production/Staging, fazer merge/deploy, chamar gateway ou reprocessar eventos históricos sem revisão e autorização específica.

## Motivo
Reduzir complexidade, risco de cobrança duplicada e custo operacional, preservando integridade financeira.

## Impactos
Checkout, OrderService, PricingEngine, PaymentService, Mercado Pago, webhooks, RPCs, triggers, Supabase, RLS/RBAC, ledger, parceiros e clientes permanecem protegidos. Prospecção sem ativação financeira pode continuar separadamente; pagamentos de clientes reais continuam bloqueados.

## Riscos
Incompatibilidade entre credenciais de teste e OAuth seller, pagador não validado, split não comprovado, registros remotos sem persistência local, DEC-021 não homologada integralmente.

## Critérios de GO
Evidência rastreável de pagamento aprovado/recusado em ambiente apropriado, prevenção de duplicidade, webhook idempotente, valor e split conferidos no gateway, pedido e ledger reconciliados, fechamento contábil, aprovação de segurança e plano de rollback; GO de produção exige autorização distinta.

## Condição para revisão
Novo resultado verificável do Mercado Pago ou alteração relevante no contrato de checkout; não apenas nova repetição de smoke tests.

**Esta decisão deve atualizar o Documento Mestre.**
