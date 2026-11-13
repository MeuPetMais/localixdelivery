# Gate 4 — Matriz de homologação após aceite parcial da DEC-021

**Data:** 12/11/2026  
**Status:** PLANO DE HOMOLOGAÇÃO — NÃO autoriza implementação, merge, deploy, migration ou produção.  
**Decisão recebida:** aprovado exclusivamente o princípio de que pagamento bruto e recebível do parceiro não podem ser somados duas vezes na mesma base econômica. Contrato integral da DEC-021 permanece proposto. Issue #90 aberta; Gate Financeiro NO-GO.

## Matriz de cenários e oráculos

| ID | Cenário | Oráculo mínimo | Evidência atual | Estado |
|---|---|---|---|---|
| H-01 | Pedido com pagamento aprovado e recebível do parceiro | Evento bruto e recebível coexistem sem dupla contabilização do mesmo saldo | SQL sintético R$ 50,00/R$ 48,51/R$ 1,49 reproduziu netBalance legado R$ 97,02 | FAIL legado; correção bloqueada |
| H-02 | Subtotal elegível R$ 29,99, R$ 30,00, R$ 30,01 | Taxa Localix R$ 0,99/R$ 0,99/R$ 1,49 conforme DEC-015, em snapshot autoritativo | Não executado nesta fase | BLOCK |
| H-03 | `service_fee_payer` consumidor e parceiro | Sem descontar a taxa duas vezes; direito econômico definido por configuração e snapshot | Contrato de pagador não homologado | BLOCK |
| H-04 | PIX e cartão, pagamento aprovado/pendente/recusado | Pedido e pagamento coerentes; sem pagamento órfão | Teste de banco de idempotência, não E2E gateway | BLOCK |
| H-05 | Repetição sequencial de PAYMENT_APPROVED/FAILED, REFUND e CHARGEBACK | Uma identidade financeira, um lançamento protegido | Quatro casos sintéticos em staging com rollback | PASS restrito ao banco |
| H-06 | Concorrência de duas inserções do mesmo pagamento | Um lançamento confirmado, segundo não inserido | Duas operações SQL concorrentes; uma inserção, segunda zero | PASS restrito ao banco |
| H-07 | Webhooks simultâneos, fora de ordem e replay | Sem duplicar ledger, status de pedido ou benefícios | Não testado E2E | BLOCK |
| H-08 | Reembolso parcial, total e cumulativo | Reversão única, não superior à captura válida | Duplicidade de REFUND bloqueada no índice; não prova limite econômico | BLOCK |
| H-09 | Chargeback e reversões de disputa | Reconhecimento por estado financeiro confirmado, sem dupla reversão | Duplicidade de CHARGEBACK bloqueada no índice | BLOCK |
| H-10 | Tarifa Mercado Pago, `application_fee`, split e liquidação | Conciliar bruto, tarifa efetiva, receita Localix, obrigação parceiro e extrato | Sem comprovante/extrato gateway | BLOCK |
| H-11 | Localix Benefits e outros créditos | Sem concessão/resgate duplo; trilha financeira isolada | Não executado | BLOCK |
| H-12 | RLS multiempresa owner A/owner B/admin/anon | Acesso apenas autorizado; RPC invoker com JWTs distintos | JWTs e E2E não apresentados | BLOCK |
| H-13 | Histórico MP sem `ledger_idempotency_key` | Não assumir cobertura de índices parciais; plano prospectivo e histórico separados | Uma linha PAYMENT_PENDING R$ 9,49 sem chave em staging | RISCO aberto |
| H-14 | CI, migration remota e rollback | 4 jobs PASS no SHA final, versão RPC/migration conciliada, rollback documentado | CI anterior do PR #96 não valida automaticamente novos commits documentais | BLOCK |

## Critérios para cada evidência

Registrar ID, ambiente, data, versão de branch/commit e migration, identidade sintética, entrada, oráculo, observação, logs sanitizados, resultado PASS/FAIL/BLOCK e responsável. Sem segredos, tokens ou PII. Nenhuma classificação BLOCK deve ser promovida a PASS por inferência.

## Sequência de homologação permitida sem implementar

1. Revisão documental do contrato econômico: Merchant of Record, titularidade do recebível, incidência e pagador da taxa, tarifa gateway e momento de reconhecimento.
2. Conferência do Documento Mestre e DEC-010/DEC-015/DEC-021; registrar conflitos antes de qualquer mudança.
3. Preparar casos sintéticos e consultas **somente leitura** para H-01 a H-14; novas escritas em staging exigem plano de isolamento, cleanup e autorização contextual.
4. Coletar evidência real sanitizada de gateway e extrato, sob acesso autorizado, para H-10.
5. Aceite independente técnico, financeiro e contábil; decisão separada sobre autorização de implementação.
6. Somente depois: PR técnico isolado, revisão, testes, staging, rollback, aprovação específica de merge/produção.

**Não foi possível provar** o contrato econômico completo, conciliação externa, testes E2E de webhooks e RLS, ou liberação de produção. **Gate Financeiro: NO-GO.**

**Esta decisão deve atualizar o Documento Mestre** quando reconciliada e formalmente aprovada.
