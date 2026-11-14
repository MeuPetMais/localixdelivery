# Gate 4 — Parecer formal de encerramento da rodada H2 (14/11/2026)

**Projeto:** Localix Delivery  
**Escopo:** fechamento técnico H2 no Supabase de homologação `gvozcqyjhogmvebrwzap`.  
**Estado da rodada:** ENCERRADA COM BLOQUEIO TÉCNICO (NO-GO).  
**Estado do Gate Financeiro global:** ABERTO / NÃO HOMOLOGADO.  
**PR:** #100 Draft, branch `integration/gate4-financial-issue90`; sem merge ou publicação em produção.

## Evidências verificadas nesta rodada

- O Supabase isolado contém oito migrations registradas, incluindo `20261114160326_gate4_h2_columns_compatibility`.
- O verificador oficial `scripts/gate4-h2-effective-contract-check.sql` retornou **25/33**.
- O verificador oficial `scripts/gate4-h2-transitive-dependency-check.sql` retornou **15/21**.
- Total H2: **40/54**, sem alteração em relação ao último registro.
- O verificador profundo `scripts/gate4-h2-deep-dependency-check.sql` retornou **4/29**. Faltam **14 relações auxiliares e 11 funções**.
- As quatro colunas de compatibilidade H2 foram previamente instaladas no banco isolado; não substituem os gatilhos operacionais.
- Nenhuma migration adicional foi aplicada nesta rodada.

## Falhas do contrato H2 (14 critérios)

1. Critério agregado `table:orders` (mínimo de triggers não satisfeito).
2. `orders_snapshot_platform_fees`.
3. `tg_orders_stock_status_transition`.
4. `trg_order_notify_customer_ins`.
5. `trg_order_notify_customer_upd`.
6. `trg_orders_loyalty_status`.
7. `trg_orders_upsert_customer`.
8. `trg_rewards_enqueue_order_event`.
9. `private.apply_order_stock_status_transition`.
10. `private.upsert_customer_from_order`.
11. `public.tg_order_notify_customer`.
12. `public.tg_orders_loyalty_status`.
13. `public.tg_orders_snapshot_platform_fees`.
14. `public.tg_rewards_enqueue_order_event`.

## Motivo decisivo do NO-GO

As funções e triggers originais possuem dependências transitivas em tabelas, tipos, FKs, permissões e funções que executam efeitos sobre estoque, pontos, notificações, clientes e rewards. O trigger de taxa utiliza a base `NEW.total`, ainda não reconciliada com o cálculo server-side do PricingEngine sob a DEC-015. Instalação apenas nominal desses objetos geraria aprovação falsa do verificador, risco de falha em pedidos e de cálculo incorreto de taxas. A implantação plena requer extrair o DDL efetivo e fechar integralmente esse grafo de dependências, seguido de ensaio real e rollback validado.

## Condições objetivas para liberar

1. Montar e revisar a migration H2 completa e rastreável, incluindo 14 relações e 11 funções dependentes, FK, enums, policies e triggers de cada objeto.
2. Verificar side-effects e cortar integrações externas no ambiente isolado sem alterar o comportamento de negócio.
3. Confirmar e testar qual valor é base da taxa DEC-015 no limiar R$30/R$30,01.
4. Provar atualização de status com estoque, clientes, fidelidade, notificações e rewards em ensaio descartável e sem duplicidade.
5. Aplicar pacote aprovado **somente** no Supabase isolado; exigir 33/33 e 21/21, e testes E2E com JWT real.
6. Homologar Mercado Pago TEST, recebíveis, split, refund, chargeback, payout e reconciliação.
7. Obter aprovação contábil da fórmula DEC-021; não liberar bloqueio conservador de bases mistas antes disso.

## Decisão operacional

**Não executar** migration transitiva incompleta, desabilitar triggers de negócio, criar stubs fictícios, desativar verificação de saldo ambíguo, mesclar PR #100 ou implantar em produção. A solicitação de finalizar esta etapa não constitui evidência de homologação nem autorização contábil de uma fórmula final. A rodada está concluída como **BLOCK documentado**; o Gate Financeiro permanece NO-GO até cumprimento demonstrado dos critérios acima.

**Não foi possível provar fechamento integral.** Produção e Staging compartilhado preservados. Após aprovação da implantação efetiva e decisão contábil, **esta decisão deve atualizar o Documento Mestre**.
