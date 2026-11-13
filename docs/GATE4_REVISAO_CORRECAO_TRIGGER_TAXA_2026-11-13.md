# Gate 4 — Revisão da correção isolada do trigger de taxa (proposta, NÃO aplicada)

**Data:** 13/11/2026  
**Ambiente inspecionado:** Supabase Staging `dnotmvbhuqujvqdtgzav`, somente leitura  
**Status:** análise concluída; implementação e homologação bloqueadas; Issue #90 / Gate Financeiro NO-GO.

## Evidências confirmadas

1. `orders_snapshot_platform_fees` é trigger `BEFORE INSERT ON public.orders`, executa `public.tg_orders_snapshot_platform_fees()` (`SECURITY DEFINER`, `search_path=public`).
2. A função lê `platform_settings.platform_fee_until_30` e `platform_fee_above_30`, aplica `COALESCE(NEW.total,0) <= 30`, sobrescreve `NEW.platform_fee`, `NEW.fixed_fee` e define `NEW.commission_rate := 0`.
3. `public.orders` **não possui coluna `subtotal`**. Possui `total` (numeric NOT NULL DEFAULT 0), `platform_fee`, `fixed_fee` e `commission_rate`.
4. `PricingEngine.computePricing` seleciona a faixa usando `subtotal <= 30`.
5. Migração existente `20260911160337_sync_orders_platform_fee_from_pricing_snapshot.sql` cria `AFTER INSERT` em `order_pricing_snapshot`, atualizando `orders.platform_fee` e `orders.fixed_fee` a partir de `NEW.platform_fee`.
6. Em Staging, auditoria anterior identificou 6 de 16 pares `orders`/snapshot com divergência em `orders.platform_fee` (1,46 versus 0,99), apesar de `fixed_fee` coincidir com o snapshot. **Não foi possível provar** a origem de todos os writers, nem que o sync cobre todos os caminhos de escrita.

## Alternativas

- **A — Trocar `NEW.total` por `NEW.subtotal`: REJEITADA.** Coluna inexistente em `orders`; falharia em runtime.
- **B — Remover cálculo do trigger BEFORE INSERT e depender exclusivamente do snapshot: CANDIDATA, NÃO APROVADA.** Exige verificar se `orders.platform_fee`, `fixed_fee` ou `commission_rate` são lidos antes da criação do snapshot; se todos os fluxos sempre criam snapshot na mesma transação; se existem writers legados que criam pedidos sem snapshot; e se AFTER UPDATE gera efeitos colaterais. Também avaliar nulidade/default e contratos de RPC.
- **C — Persistir subtotal autoritativo no contrato de criação de pedidos: CANDIDATA DE MAIOR ESCOPO.** Exigiria migration de schema, mudanças em OrderService/RPC/Checkout, autorização e testes adicionais; não recomendada sem evidência de necessidade.

## Proposta de implementação controlada (sem SQL executável aprovado)

1. Auditar writers de `orders` e `order_pricing_snapshot`, chamadas de checkout, `OrderService`, `PaymentService`, RPCs e consumidores de `platform_fee`/`fixed_fee`/`commission_rate`.
2. Estabelecer contrato de atomicidade pedido + snapshot; definir comportamento explícito para pedido sem snapshot.
3. Investigar writer que grava `platform_fee=1.46` e divergência histórica antes de considerar o sync como suficiente.
4. Preparar migração mínima apenas depois da análise de dependências, com testes de rollback e cenários 29,99/30,00/30,01, pagador customer/restaurant, frete, desconto, retries, webhook duplicado, fidelidade e Rewards.
5. Homologar em PostgreSQL isolado; CI Vitest não substitui triggers reais.
6. Revisão de segurança de `SECURITY DEFINER`, RLS/RBAC, observabilidade e rollback. Sem deploy ou produção sem nova aprovação.

## Impactos a avaliar

Checkout, pedidos, OrderService, PricingEngine, PaymentService, Supabase, banco, RLS/RBAC, RPCs, triggers, webhooks, Mercado Pago, Benefits, parceiros, clientes, entregadores e painel administrativo.

**Conclusão:** a causa da divergência de fórmula foi comprovada; **não foi possível provar** ainda uma correção isolada segura. Nenhuma migração, alteração de banco, merge, deploy ou produção autorizada por este relatório.
