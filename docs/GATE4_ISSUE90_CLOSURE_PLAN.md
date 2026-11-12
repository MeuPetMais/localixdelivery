# Gate 4 — Plano executável de encerramento da Issue #90

**Data:** 2026-11-12  
**Status:** PROPOSTA / BLOCK financeiro; sem autorização para mudar fórmulas, realizar merge ou deploy.  
**Base:** DEC-021; Issue #90; PRs #91, #92, #93 (stacked Drafts).

## Evidência e problema
O núcleo legado soma PAYMENT_APPROVED e RESTAURANT_RECEIVABLE como créditos na mesma base. Com PAYMENT_APPROVED 50, PLATFORM_FEE 1,49 e RESTAURANT_RECEIVABLE 48,51, computeBalance produz 97,02. Teste de caracterização do PR #91 demonstra o comportamento e o dashboard bloqueia a exposição do saldo ambíguo. Isso **não prova** duplicidade histórica de lançamentos em produção.

O PR #93 resolve integridade do snapshot, mas preserva signedAmount/computeBalance; portanto não encerra a semântica contábil. O PR #92 corrige contagem de pedidos, não receita. PRs #91/#92/#93 estão empilhados e não devem ser mergeados isoladamente sem revisar bases e dependências.

## Contrato por indicador — para aceite antes da implementação

| Indicador | Fato fonte | Regra de não duplicação | Estado |
|---|---|---|---|
| Valor esperado do pedido | order_pricing_snapshot autoritativo | Nunca tratar como caixa | Proposto na DEC-021 |
| Cobrança confirmada | captura confirmada no gateway, com identidade econômica | Não adicionar recebível como segunda cobrança | Aceite de identidade pendente |
| Receita Localix | direito econômico da plataforma conforme snapshot, pagador e liquidação | Não inferir receita do bruto integral | Aceite contábil/fiscal pendente |
| Recebível do parceiro | contrato de split/liquidação e comprovantes | Não somar ao bruto como mesma base | Aceite de titularidade pendente |
| Custo gateway | custo efetivo do provedor | Não presumir zero; não descontar duas vezes | Conciliação pendente |
| Repasse realizado | transferência/liquidação comprovada | payment_split COMPLETED isolado não prova repasse | Integração pendente |
| Saldo contábil | direitos/obrigações reconhecidos em base aprovada | Não reutilizar netBalance legado automaticamente | BLOCK |
| Saldo disponível | liquidação menos bloqueios/saídas conciliadas | Não inferir de PAYMENT_APPROVED | BLOCK |
| Caixa realizado | extrato efetivamente liquidado | Não inferir de recebível nem de split | BLOCK |
| Refund/chargeback | refund_id/case_id e estado confirmado | Limitar reversões, idempotência | Testes de integração pendentes |
| Benefits | ledger próprio e snapshot do pedido | Evitar concessão/resgate repetidos | Testes pendentes |

## Implementação controlada — ordem

1. **Aceite de domínio (obrigatório):** responsável financeiro e técnico definem Merchant of Record, titularidade, base de reconhecimento, pagador da taxa, taxa efetiva do gateway, semântica de ADJUSTMENT e regras de eventos mistos, parciais e históricos. Registrar adendo à DEC-021. **Sem esse aceite, não substituir 97,02 por 48,51 como saldo bancário.**
2. **Testes antes da correção:** matriz abaixo, isolada em branch, sem rede e sem dados reais; assegurar que dashboard, fluxo de caixa e saldo não confundam bases. Testes de caracterização que esperam 97,02 devem ser mantidos como diagnóstico ou revisados explicitamente após contrato aprovado, nunca apagados silenciosamente.
3. **Correção mínima:** introduzir classificação por fato econômico e cálculo específico por indicador em módulo puro; atualizar consumidores FinancialDashboardService e CashFlowService, preservando eventos e ledger append-only. Evitar modificar PricingEngine, OrderService, PaymentService, webhooks e registros históricos sem evidência de defeito. Falhar fechado para ambiguidades.
4. **Integridade técnica:** revalidar PR #93 (snapshot, RLS, tenant, completude, 50k), PR #92 (pedidos únicos) e dependências; conciliar migrations e grants Staging/arquivo antes de integrar.
5. **CI e revisão:** lint, typecheck, testes, build; revisão independente de diferenças financeiras e de segurança; sem merge automático.
6. **Staging/sandbox:** HTTP/PostgREST com JWT real de owner A, owner B e admin distintos; anon negado; concorrência e timeout; PIX/cartão, split/application_fee, idempotência de webhook, refund, chargeback, payout e Benefits; provar que os dados são sintéticos.
7. **Produção:** somente após aprovação explícita GO, plano de deploy/rollback, observabilidade e conciliação. Não migrar dados históricos retroativamente.

## Matriz mínima de testes

| ID | Cenário | Invariante exigida |
|---|---|---|
| FIN-01 | 50,00 aprovado + 48,51 recebível + 1,49 taxa | Não exibir 97,02 como saldo disponível, receita ou caixa |
| FIN-02 | Só PAYMENT_APPROVED | Cobrança confirmada não vira liquidação presumida |
| FIN-03 | Só RESTAURANT_RECEIVABLE | Recebível não vira cobrança adicional |
| FIN-04 | Bases mistas em pedidos distintos | Nenhuma soma de bases incompatíveis; bloqueio até classificação |
| FIN-05 | Pagamentos parciais mesmo order_id | Um pedido, múltiplas capturas com IDs próprios |
| FIN-06 | Mesmo webhook duas vezes / fora de ordem | No máximo um fato financeiro por identidade econômica |
| FIN-07 | Dois refunds parciais e repetição do mesmo refund_id | Total revertido não supera capturas; sem duplicação |
| FIN-08 | Chargeback aberto/revertido/confirmado | Efeito somente no estado confirmado pertinente |
| FIN-09 | Repasse parcial, pendente e concluído | Caixa somente com liquidação comprovada |
| FIN-10 | Owner A, owner B, admin e anon | Isolamento RLS e autorização por JWT real |
| FIN-11 | 501/1.201/12.001/50.000/50.001 lançamentos | Snapshot íntegro ou falha explícita, nunca soma truncada |
| FIN-12 | R$29,99/R$30,00/R$30,01, pagador cliente/parceiro | Snapshot autoritativo da taxa sem dupla dedução |
| FIN-13 | Multimoeda, tenant errado, referência ausente | Bloqueio controlado |
| FIN-14 | Benefits, reprocessamento e cancelamento | Sem crédito duplicado |
| FIN-15 | Concorrência entre inserção e leitura | Agregados do mesmo snapshot |
| FIN-16 | Dados legados e ajustes | Compatibilidade sem reescrita retroativa |

## Condições de GO

- [ ] Contrato contábil e fiscal aceito; DEC-021 atualizada.
- [ ] Issue #90 resolvida em indicadores **e** testes, não apenas mascarada.
- [ ] PRs empilhados revisados, CI 4/4 no SHA final e migrations reconciliadas.
- [ ] HTTP/JWT/RLS real em Staging validado.
- [ ] Gateway e liquidação conciliados com evidências auditáveis.
- [ ] Rollback, monitoramento, idempotência e revisão de segurança aprovados.
- [ ] Autorização específica de produção.

**Estado atual: NO-GO.** Este documento não autoriza mudanças financeiras em produção.

**Esta decisão deve atualizar o Documento Mestre.**
