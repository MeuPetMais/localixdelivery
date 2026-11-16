# Localix Production — Forense financeira dirigida de 19 webhooks MP

**Data:** 2026-11-15
**Ambiente:** Supabase Production `mvkfrwxgneqzvoabkaws`
**Natureza:** investigação **somente leitura**, sem efeitos operacionais ou financeiros
**Status:** pendências delimitadas; liberação financeira de novos parceiros **NO-GO** até reconciliação dirigida.

## Inventário confirmado
- 2 contas Mercado Pago conectadas, ambas `live_mode=true`, token OAuth criptografado, não expirado no banco, com scope de pagamentos. Não foi feita verificação remota de validade do token.
- Edge Functions PROD `mp-payment-intent` ACTIVE v13 (JWT obrigatório), `mp-webhook` ACTIVE v12 (JWT desligado para recepção; código contém validação da assinatura HMAC). Valores de segredo efetivos e assinatura de notificações não foram lidos ou testados nesta sessão.
- 100 `payment_webhook_events` do MP: **81 processed, 19 unprocessed**.
- 6 `payment_event_queue` pending, sem locks, com `next_retry` vencido e `retry_count=0`, todos associados aos 19 não processados.
- `payments`: 29 entradas do MP; `order_payment`: 117 entradas. Essas tabelas representam registros distintos; não somar como transações únicas.

## Classificação dos 19 eventos (confronto por recurso da notificação)

### Grupo A — 14 com correspondência local e estado final
- 13 erros `trust_boundary:missing_mp_user_id`: correspondência `payments.status=cancelled`, `order_payment.status=CANCELLED`.
- 1 erro `missing_mp_user_id`: correspondência `payments.status=rejected`, `order_payment.status=REJECTED`.
- Todos os 14: correspondência de `payment_id/external_id`, pedido e referência no `financial_ledger`.
- Pedidos: 12 `cancelado` e 2 `falha_pagamento` (contagem por eventos; verificar identidade por pedido antes de ação).
- Lançamentos de ledger associados aos pedidos: 17 `PAYMENT_FAILED/FAILED`, 13 `PAYMENT_PENDING/PENDING`, zero `POSTED` na inspeção. Observação: a linha `PAYMENT_PENDING` persistente pode representar histórico append-only; não alterar ou compensar sem reconciliação contábil.
- 13 eventos sem item de fila; 1 na fila pending.
- **Limite:** estados finais locais não comprovam, isoladamente, o estado remoto atual, chargeback, settlement ou origem do evento. Não marcar eventos como processados automaticamente.

### Grupo B — 5 sem correspondência local
- Erro `no_access_token`.
- 0 correspondências na tabela `payments`, `order_payment`, `financial_ledger` por `resource_id/reference_id`, ou logs verificados por `data.external_id`.
- 5 itens em `payment_event_queue` com `pending` vencido e `retry_count=0`.
- Todos possuem `resource_id` numérico. Data: julho/agosto de 2026.
- **Impacto financeiro desconhecido**: sem extrato remoto MP, é impossível comprovar se são pagamentos legítimos, testes históricos ou notificações alheias à operação.

## Contexto dos erros
- O código implantado do webhook inclui `resolveMercadoPagoWebhookToken` por `webhookUserId`, sem fallback genérico configurado no trecho inspecionado; ausência de identidade confiável produz bloqueio fechado. Isso é comportamento de segurança e **não deve ser relaxado** só para reduzir pendências.
- Os 14 `missing_mp_user_id` não são, por si sós, prova de erro financeiro de produção; os estados associados são cancelados/rejeitados.
- O erro `user_allowed_only_in_test` foi observado em sandbox isolado e **não apareceu nesta classificação dos 19 eventos de Production**.

## Decisão operacional recomendada
1. **Não** executar `payment_event_queue` worker em massa; não alterar `processed`, saldos, ledger ou status por SQL.
2. Tratar Grupo A como **histórico local com status final**, sujeito a conferência de status remoto e a política de encerramento de eventos. Não atribuir GO financeiro integral.
3. Priorizar **somente os 5 IDs de recurso do Grupo B**: executar leitura autenticada `GET /v1/payments/{id}` sob contexto de seller correto, com checagens de identidade e referência externa. Token somente dentro do backend seguro, não exportar; sem usar fallback global.
4. Se pagamento for encontrado, confrontar `external_reference`, `collector_id`, valor/status e pedido/autorização, verificando também idempotência e ledger. Se não houver vínculo identificável, não criar pedido ou pagamento retroativo por dedução.
5. Depois da reconciliação, preparar decisão de encerramento histórico/granular (com revisão e autorização distinta), com trilha de auditoria e plano de rollback.
6. Habilitar monitoramento de `unprocessed` recentes e verificar se worker de retry está desativado; não agendar reprocessamento sem validação do contrato.

## Declarações de evidência
**Fato:** 19 unprocessed; 14 têm estados locais finalizados e ledger sem `POSTED`; 5 não possuem vínculo local e 6 estão em fila vencida.
**Hipótese:** os 5 eventos são registros de integrações antigas ou testes; **não foi possível provar**.
**Recomendação:** leitura externa direcionada dos 5 e nenhum write.
**Decisão existente:** DEC-021 protege contra dupla contabilização; DEC-022 restringe repetição de testes e exige prova financeira.

**Esta decisão deve atualizar o Documento Mestre**, após aprovação e reconciliação.
