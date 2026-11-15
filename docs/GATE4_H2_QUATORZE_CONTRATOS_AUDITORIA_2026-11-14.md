# Gate 4 — Auditoria de fechamento dos 14 contratos H2 (2026-11-14)

**Ambientes:** referência Staging `dnotmvbhuqujvqdtgzav` (somente leitura); destino `localix-gate4-homologação` `gvozcqyjhogmvebrwzap` (somente leitura nesta auditoria). Produção não acessada para escrita.

## Evidência reproduzida

Foram executados diretamente no destino, por conexão SQL de leitura, os verificadores versionados:
- `scripts/gate4-h2-effective-contract-check.sql`: **25/33 PASS**, oito falhas;
- `scripts/gate4-h2-transitive-dependency-check.sql`: **15/21 PASS**, seis falhas.
- Total **40/54 PASS**, **14/54 BLOCK**. A tabela `orders` é contabilizada como um critério agregado de mínimos, não como objeto físico ausente.

### Oito critérios ausentes do verificador efetivo
1. `table:orders` (mínimo 9 triggers não satisfeito);
2. `trigger:orders.orders_snapshot_platform_fees`;
3. `trigger:orders.tg_orders_stock_status_transition`;
4. `trigger:orders.trg_order_notify_customer_ins`;
5. `trigger:orders.trg_order_notify_customer_upd`;
6. `trigger:orders.trg_orders_loyalty_status`;
7. `trigger:orders.trg_orders_upsert_customer`;
8. `trigger:orders.trg_rewards_enqueue_order_event`.

### Seis funções ausentes
1. `private.apply_order_stock_status_transition`;
2. `private.upsert_customer_from_order`;
3. `public.tg_order_notify_customer`;
4. `public.tg_orders_loyalty_status`;
5. `public.tg_orders_snapshot_platform_fees`;
6. `public.tg_rewards_enqueue_order_event`.

## Dependências reais adicionais faltantes, verificadas no catálogo PostgreSQL do destino

**Relações ausentes:** `public.customers`, `public.customer_notifications`, `public.loyalty_transactions`, `public.platform_settings`, `public.reward_order_event_queue`, `public.order_items`, `public.stock_movements`.

**Funções ausentes:** `private.consume_order_stock`, `private.reverse_order_stock`, `private.rebuild_customer_order_metrics`, `public.loyalty_apply`, `public.loyalty_rollback_reserve`.

**Colunas ausentes:** `public.orders.commission_rate`, `public.orders.loyalty_points_consumed`, `public.orders.loyalty_points_reserved`, `public.restaurants.loyalty_settings`.

As definições originais das seis funções e dos nove triggers de `orders` foram consultadas no Staging (catálogos `pg_proc` e `pg_trigger`); não foram inventados stubs. Dependências para `reward_order_event_queue`, estoque e fidelidade geram escrita/efeitos operacionais mesmo em testes de pedidos. O trigger `tg_orders_snapshot_platform_fees` usa `NEW.total` para escolher faixas e grava `platform_fee`, `fixed_fee`, `commission_rate`; sua base de cálculo requer reconciliação com PricingEngine/DEC-015 antes de instalação. Copiar este trigger sem provar a semântica pode alterar cobranças de checkout.

## Condição de implantação (não satisfeita)

1. Extrair, com hash e origem, o DDL final **efetivo** de todas as sete tabelas, cinco funções e quatro colunas dependentes, com todos os constraints, permissões, políticas e índices. Levantar dependências transitivas posteriores até ponto fixo (incluindo `private`, triggers, extensions).
2. Verificar que jobs `cron`, notificações e outros efeitos externos ficam isolados; não usar a cadeia histórica de 206 migrations sem revisão e remoção segura dos efeitos colaterais em cópias locais.
3. Comparar o comportamento da taxa no limite R$30,00/30,01 com PricingEngine, `order_pricing_snapshot` e `service_fee_payer`; não inferir que `NEW.total` é a base econômica aceita.
4. Gerar migration exclusivamente para `supabase/homologation`, com revisão estática e dry-run transacional descartável, **sem fake/stubs**. Não criar policies públicas para tabelas financeiras por conveniência.
5. Executar 33/33 + 21/21, testes por persona JWT real, checkout/estado dos pedidos, falha/rollback, isolamento RLS, idempotência e verificações de ausência de notificações/webhooks externos inadvertidos.
6. Somente após aprovação contábil DEC-021 e sandbox Mercado Pago TEST considerar GO global. Merge/produção/cron requerem autorização independente.

**Resultado desta auditoria:** os 14 itens foram identificados, mas **não instalados**. Uma migration parcial passaria falsamente parte da verificação nominal e exporia pedidos, estoques, benefícios e taxas a efeitos não homologados. **NO-GO preservado.**
