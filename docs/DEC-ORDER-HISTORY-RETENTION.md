# DEC-ORDER-HISTORY-RETENTION — Historico e retencao operacional de pedidos

**Data:** 2026-08-31  
**Status:** Aprovada para implementacao

## Problema

Pedidos concluidos e cancelados nao devem permanecer indefinidamente no Kanban operacional. Ao mesmo tempo, registros financeiros, de pagamento, reembolso e auditoria nao podem ser descartados apenas porque o ticket deixou de ser util para a operacao diaria.

## Contexto

O painel de pedidos agrupava `concluido` em ENTREGUES e `cancelado`/terminais equivalentes em CANCELADOS, mantendo esses tickets visiveis junto ao fluxo operacional.

## Opcoes consideradas

1. Manter todos os tickets permanentemente no Kanban.
2. Excluir fisicamente pedidos apos um prazo curto.
3. Separar a visibilidade operacional da retencao de dados.

## Decisao

Adotar a opcao 3.

- Pedidos `concluido` e terminais de cancelamento deixam o fluxo operacional e passam ao Historico.
- O Historico operacional exibe ate 90 dias.
- Estados terminais de cancelamento considerados no Historico: `cancelado`, `rejeitado`, `reembolsado` e `chargeback`.
- Apos 90 dias, o pedido deixa a consulta operacional normal.
- Nesta fase nao ha exclusao fisica nem anonimizacao automatica.
- Registros financeiros, snapshots, pagamentos, split, ledger, reembolsos, IDs externos e trilhas de auditoria nao sao removidos por esta politica.

## Motivo

Manter o Kanban focado no trabalho ativo, reduzir ruido operacional e evitar que uma decisao de UX cause perda de evidencias financeiras ou de auditoria.

## Impacto

- Checkout: sem alteracao.
- OrderService/OrderOrchestrator: sem alteracao financeira.
- PricingEngine: sem alteracao.
- PaymentService/Mercado Pago: sem alteracao.
- Banco/RLS: nesta primeira etapa, sem exclusao e sem mudanca de permissao.
- Painel do parceiro: novo Historico de pedidos com janela de 90 dias; Kanban devera ocultar terminais ja encerrados.
- Admin/auditoria: dados permanecem preservados.

## Riscos

- Usar `updated_at` como data de encerramento pressupoe que pedidos terminais nao sofram atualizacoes operacionais posteriores que renovem indevidamente a janela. Antes de automatizar arquivamento definitivo, deve-se considerar um `closed_at`/`archived_at` autoritativo.
- Exclusao/anonimizacao futura exige politica especifica de LGPD, fiscal, financeira, antifraude e auditoria.

## Condicao para revisao

Revisar antes de implementar exclusao fisica, anonimizacao automatica ou mudanca do prazo de 90 dias.
