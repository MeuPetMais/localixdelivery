# Gate 4 / DEC-021 — Encerramento da auditoria estática dos writers Mercado Pago
Data: 2026-11-13
Status: AUDITORIA ESTÁTICA ENCERRADA; CORREÇÃO/HOMOLOGAÇÃO E2E PENDENTES; FINANCEIRO NO-GO
Referências: Issue #90; PRs #93/#95/#96/#97; branch de leitura audit/gate4-issue90-regression-tests.
Escopo: arquivos mp-webhook/index.ts, ledger-idempotency.ts, refund-ledger.ts, chargeback-ledger.ts, mp-payment-intent/index.ts; índices e ACL em Staging somente leitura. Sem escrita financeira, webhook real, migration ou deploy.

## A. Matriz de writers e invariantes
| Fluxo | Identidade usada | Proteção observada | Resultado |
|---|---|---|---|
| PAYMENT_PENDING/APPROVED/FAILED | reference_type + reference_id + transaction_type; metadata.ledger_idempotency_key | consulta anterior e INSERT com tratamento 23505; índices parciais MP | Proteção condicionada a preenchimento de metadados e identidade correta; concorrência E2E não provada |
| REFUND | mp_refund; payment_id:refund:refund_id | lookup por provider/reference/type, chave em metadata e índice único parcial | Proteção contra duplicidade para referências completas; múltiplos refunds, captura acumulada e concorrência E2E ainda não provados |
| CHARGEBACK | mp_chargeback; chargeback case ID | lookup, chave e índice único parcial | Proteção contra duplicidade para referências completas; status/efeito financeiro confirmado e reentrância ainda exigem E2E |
| payment_webhook_events | (provider,event_id) | índice único parcial com event_id not null | Evento com event_id nulo não é coberto pelo índice |
| PIX/cartão no mp-payment-intent | chaves de requisição idempotentes para criação/reembolso | X-Idempotency-Key no gateway, código de identidade distinto por ação | Não comprova equivalência entre gateway, pedido, ledger e conciliação |

## B. P1/P0 candidatos identificados no fluxo de recebimento (código)
1. `mp-webhook/index.ts` (aprox. 205–245): pesquisa por `(provider,event_id)` e, se encontra qualquer registro, retorna `{ok:true, duplicated:true}` **sem inspecionar `processed`**, apesar de solicitar a coluna no SELECT. Assim uma nova entrega de evento anteriormente persistido com `processed=false` não tenta reprocessamento por esse caminho.
2. Há fila de recuperação para exceções no bloco catch, mas retorno `refund_incomplete` (aprox. 638–658) marca `processed=false`, responde HTTP 200 e não enfileira nessa rota específica. Não foi possível provar recuperação integral por worker externo, agenda ou processos não inspecionados.
3. Se duas entregas concorrentes consultarem evento ausente, a segunda pode enfrentar UNIQUE 23505 no INSERT de `payment_webhook_events`. O erro de inserção atualmente retorna HTTP 500; não reconsulta o evento persistido. Isso não duplica necessariamente o ledger (há outras barreiras), mas é uma lacuna de comportamento idempotente do receiver.
4. `recordMercadoPagoLedger` e writers de refund/chargeback usam lookup antes de INSERT e ignoram SQLSTATE 23505. O índice único é a barreira transacional efetiva, **somente** em lançamentos que satisfaçam a cláusula parcial (ex.: `metadata ? 'ledger_idempotency_key'`). Como há histórico sem a chave, não afirmar cobertura universal.
5. `recordPaymentRefunds` incrementa `recorded` após `recordRefundLedger` retornar, inclusive quando esta encontra registro prévio ou ignora conflito. O contador não é estritamente número de linhas novas inseridas; não usá-lo como evidência de novos refunds no Ledger.

## C. Evidência de banco Staging, SELECT
- `payment_webhook_events_provider_eventid_uk`: índice UNIQUE (provider,event_id) WHERE event_id IS NOT NULL.
- `financial_ledger_mp_idempotency_uidx`: UNIQUE (provider,reference_type,reference_id,transaction_type) para provider mercado_pago, referência não nula, metadata com ledger_idempotency_key e tipos PAYMENT_PENDING, PAYMENT_APPROVED, PAYMENT_FAILED, REFUND, CHARGEBACK.
- `financial_ledger_mp_payment_type_idempotency_uk`: UNIQUE metadata.ledger_idempotency_key para mp_payment com tipos PAYMENT_PENDING/APPROVED/FAILED, condicionado à existência da chave.
- São salvaguardas comprovadas de schema, **não teste de webhook simultâneo/fora de ordem**.

## D. Correção mínima recomendada, ainda NÃO implementada
1. Separar estados `processed=true` (ack de duplicata concluída) e `processed=false` (reprocessamento com lease/claim atômico ou requeue idempotente). Nunca transformar falha pendente em sucesso silencioso; exigir autenticação/verificação de origem antes de mutações financeiras.
2. Para UNIQUE 23505 no registro de evento, reler estado de `(provider,event_id)` e seguir contrato de duplicata/retentativa; proteger contra dois workers aplicarem simultaneamente o mesmo evento.
3. Verificar fluxo de `refund_incomplete`: enfileiramento confiável e recuperação monitorada, sem loop de duplicidade. Validar `processing_attempts` monotônico e alertas para pendentes duradouros.
4. Expor resultado real `inserted` do writer de refund e separar `existing`, `recorded` e `incomplete`, preservando regra de tratamento de refund já conciliado.
5. Provar no banco isolado: retries de evento processed=false, deliveries simultâneas, webhook fora de ordem, gateway indisponível, refund parcial/total, chargeback, reversões e tenant; comparar pedido, order_payment, ledger, gateway e queue.
6. Não modificar tabelas históricas, índices, RPC, PricingEngine, OrderService, webhooks ou produção sem diff, testes e homologação; autorização de produção separada.

## E. Parecer e encerramento
AUDITORIA DOS WRITERS: CONCLUÍDA no escopo acima. Existem barreiras de idempotência relevantes, mas **NÃO FOI POSSÍVEL PROVAR** idempotência end-to-end do receiver nem recuperação integral de eventos incompletos. Classificar o caminho de duplicate processed=false como defeito de fluxo provável, sujeito a teste de caracterização e validação do worker de fila.

Gate Financeiro NO-GO. PR #95 Draft. Issue #90 aberta. Sem alterações financeiras, sem CI nova exigível para este relatório apenas documental, sem merge/migration/deploy. Próximo bloco: correção isolada do tratamento de retries em branch e banco isolados, depois homologação B3 com CI 4/4. DEC-021 contábil integral continua pendente de aceite.
Esta decisão deve atualizar o Documento Mestre somente após reconciliação formal.
