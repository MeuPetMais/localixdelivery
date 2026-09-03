# DEC-011 — Eventos financeiros de Rewards usam fila durável no banco

**Data:** 03/09/2026  
**Status:** Aprovada em staging; produção condicionada ao gate de release.

## Problema
O `OrderEventBus` atual é in-process. Isso não oferece evidência suficiente de entrega durável para efeitos que podem gerar ou revogar crédito financeiro.

## Contexto
Localix Rewards reage a `concluido`, `reembolsado`, `chargeback` e `cancelado`. Perder um evento pode gerar pedido sem progresso/reversão; executar o mesmo evento mais de uma vez pode gerar duplicidade financeira.

## Opções consideradas
1. Usar somente o EventBus JavaScript em memória.
2. Executar Rewards diretamente dentro da transição de status do pedido.
3. Persistir o evento no banco e processá-lo de forma assíncrona e idempotente.

## Decisão
Adotar a opção 3.

A alteração de `orders.status` apenas enfileira um evento em `reward_order_event_queue`. Um worker server-side processa a fila com `FOR UPDATE SKIP LOCKED`, retry persistente, backoff e RPCs idempotentes de Rewards/Benefits.

O trigger não concede nem revoga valor financeiro dentro da transação do pedido.

O EventBus in-process pode continuar sendo usado para efeitos não financeiros, mas não é fonte autoritativa para efeitos econômicos de Rewards.

## Motivo
- desacopla disponibilidade de Rewards da state machine do pedido;
- evita que falha em benefício impeça a conclusão do pedido;
- permite retry observável;
- reduz risco de duplicidade via unicidade + idempotência + locks;
- preserva trilha operacional para diagnóstico.

## Impacto
- nova tabela `reward_order_event_queue`;
- trigger leve em `orders`;
- worker `rewards_process_order_event_queue`;
- cron de staging a cada minuto;
- nenhuma alteração em Checkout, PricingEngine, PaymentService ou Mercado Pago nesta fase.

## Riscos
- fila parada ou acumulada;
- eventos em FAILED atingirem `max_attempts` sem ação operacional;
- dependência de observabilidade/alerta para backlog e falhas permanentes;
- necessidade de política administrativa para `CLAWBACK_PENDING`.

## Condição para revisão
Revisar se a plataforma adotar uma infraestrutura geral de outbox/event streaming que ofereça entrega durável, retry, idempotência e observabilidade equivalentes ou superiores.