# Gate 4 — Provisionamento de ambiente isolado: bloqueio de custo

**Data:** 12/11/2026  
**Projeto de origem:** Supabase Staging `dnotmvbhuqujvqdtgzav`  
**Branch pretendida:** `gate4-financial-isolated-tests`  
**Estado:** BLOCKED — custo e autorização pendentes.

## Evidências operacionais

1. `list_branches` no projeto de Staging retornou lista vazia.
2. Foi solicitada a criação de branch isolada. A operação **não foi executada**: o serviço retornou `This client needs a cost confirmation ID: call get_cost, tell the user the cost, call confirm_cost once they agree, then retry ...`.
3. `get_cost` requer o identificador da organização Supabase, que precisa ser confirmado pelo usuário.
4. Nenhuma branch, projeto, migration, fixture, pedido, pagamento, trigger, webhook ou worker foi criado ou executado.

## Escopo aprovado tecnicamente para a futura branch

- Ambiente separado com schema derivado das migrations e **sem cópia de dados de produção**.
- Fixtures inteiramente sintéticas: restaurante, cliente, cardápio, itens, carrinho e pedidos.
- Integrações externas desligadas: Mercado Pago, webhooks, push, e-mail, WhatsApp e consumidores assíncronos de filas.
- Testes de fronteira do subtotal R$ 29,99 / R$ 30,00 / R$ 30,01 e pagador cliente/restaurante.
- Testes de atomicidade de RPC e sincronização `orders.platform_fee`/`fixed_fee`/`order_pricing_snapshot.platform_fee`.
- Testes separados de transições, loyalty, Rewards e Benefits, com assertions de idempotência, reversão e isolamento por tenant.
- Sem deploy, merge ou produção. Não executar efeitos externos, nem mesmo em transação com rollback.

## Próximo desbloqueio

Solicitar ao usuário o **organization ID** da organização Supabase que contém Staging. Consultar `get_cost(type=branch)`, informar o valor exato e obter autorização expressa de eventual cobrança. Só então confirmar custo e provisionar branch.

**Gate Financeiro NO-GO.** DEC-021 segue aprovada apenas no princípio contábil.
