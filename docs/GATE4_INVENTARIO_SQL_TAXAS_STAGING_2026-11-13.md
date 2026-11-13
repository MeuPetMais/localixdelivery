# Gate 4 — Inventário de views, RPCs e triggers de taxas no Staging

**Data:** 13/11/2026. **Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`. **Escopo:** SQL somente leitura em catálogos PostgreSQL `pg_proc`, `pg_views`, `pg_trigger`. **Gateway operacional:** Mercado Pago; Stripe excluído conforme confirmação do responsável.

## Funções encontradas no schema public

Busca textual em `pg_proc.prosrc` por `platform_fee` ou `fixed_fee` identificou:
- `create_order_with_snapshot_payment`: RPC que recebe componentes autoritativos e insere pedido/snapshot/pagamento/idempotência; insere `orders.total` e snapshot com `platform_fee`.
- `tg_orders_snapshot_platform_fees`: trigger BEFORE INSERT em `orders`, SECURITY DEFINER, escolhe taxa com `COALESCE(NEW.total,0) <= 30`, usando `platform_settings`; sobrescreve `NEW.platform_fee`, `NEW.fixed_fee`, `NEW.commission_rate=0`.
- `sync_order_platform_fee_from_snapshot`: trigger AFTER INSERT em `order_pricing_snapshot`; `UPDATE public.orders SET platform_fee=NEW.platform_fee, fixed_fee=NEW.platform_fee WHERE id=NEW.order_id`.

**Fato:** existem dois escritores de taxa no ciclo de criação, usando bases diferentes: total no primeiro, subtotal autoritativo no snapshot. A sincronização posterior prevalece na RPC principal quando o snapshot é inserido com sucesso. **Não foi possível provar** que todos os writers utilizam essa RPC.

## Views

Consulta `pg_views` no schema `public` com definição contendo `platform_fee` ou `fixed_fee` retornou zero linhas. Isso não abrange materialized views, schemas diferentes, queries em código, SQL dinâmico, APIs externas nem versões históricas.

## Triggers

No schema `public`, `orders` possui nove triggers não internos inspecionados; `order_pricing_snapshot` possui `trg_sync_order_platform_fee_from_snapshot` AFTER INSERT. Os triggers de status, notificações, estoque, fidelidade, CRM e recompensas podem ter efeitos colaterais; por isso não inserir fixtures no Staging compartilhado.

## Impacto e decisão provisória

A hipótese de correção isolada deve considerar que `orders` **não tem coluna `subtotal`**; trocar `NEW.total` por `NEW.subtotal` quebraria o insert. Remover o trigger BEFORE INSERT sem revisar writers legados e leituras anteriores ao snapshot também é arriscado.

**Recomendação:** inventariar writers diretos de pedidos e consultas em outros schemas/materialized views; depois projetar correção mínima e teste em PostgreSQL isolado, com rollback. Nenhuma mudança aprovada no código ou banco.

**Gate Financeiro: NO-GO. Issue #90 aberta. Sem merge, deploy, migration ou alteração de dados.**
