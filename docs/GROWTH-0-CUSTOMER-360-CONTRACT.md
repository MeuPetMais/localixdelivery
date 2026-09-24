# GROWTH-0 — Contrato Técnico do Customer 360

- **Data:** 2026-09-24
- **Status:** PROPOSTA
- **Dependência:** DEC-013
- **Modo:** arquitetura/contrato; sem implementação

## 1. Objetivo do Gate

Definir, antes de código novo, o contrato mínimo para a Fase 1 — Customer 360.

O Gate GROWTH-0 termina somente quando identidade, métricas, fontes, isolamento e critérios de aceite estiverem formalmente definidos.

## 2. Princípios

1. `orders` é a fonte transacional.
2. `customers` é a projeção partner-scoped do cliente.
3. Growth não recalcula preço nem estado financeiro.
4. Somente vendas elegíveis entram nas métricas realizadas.
5. Métricas são calculadas server-side ou em SQL/RPC server-enforced.
6. Nenhuma tela é considerada prova de funcionalidade.
7. Nenhum novo schema será criado sem gap comprovado.

## 3. Identidade do Customer 360

### 3.1 Chave canônica

```text
customer360_key = customers.id
tenant_key      = customers.restaurant_id
```

A projeção de `customers` permanece sustentada por:

```text
restaurant_id + telefone normalizado
```

### 3.2 Cliente guest

Pedidos sem `orders.customer_id` podem alimentar Customer 360 quando houver:

- `restaurant_id`;
- `customer_phone` normalizável;
- `customer_name`;
- pedido elegível para métrica realizada.

### 3.3 Cliente autenticado

Quando existir `orders.customer_id`, o UUID autenticado poderá ser utilizado como referência complementar, mas não substitui automaticamente `customers.id`.

### 3.4 Merge de identidade

Fora do escopo da Fase 1.

Nenhum merge automático por e-mail/telefone será implementado até existir política formal de reconciliação.

## 4. Contrato de venda realizada

Fonte:

`src/lib/orders/order-metrics-contract.ts`

### Incluídos

- `entregue`
- `concluido`

### Excluídos

- `novo`
- `aguardando_pagamento`
- `pago`
- `falha_pagamento`
- `aceito`
- `rejeitado`
- `em_preparo`
- `pronto`
- `saiu_para_entrega`
- `cancelado`
- `reembolsado`
- `chargeback`

O Gate não altera a state machine.

## 5. Métricas obrigatórias da Fase 1

| Métrica | Definição | Fonte |
|---|---|---|
| total_orders | quantidade de pedidos realizados elegíveis | `customers.total_orders` / validação em `orders` |
| total_spent | soma de `orders.total` dos pedidos elegíveis | `customers.total_spent` |
| avg_ticket | total_spent / total_orders | `customers.avg_ticket` |
| first_order_at | menor `created_at` elegível | `orders` |
| last_order_at | maior `created_at` elegível | `customers.last_order_at` |
| days_since_last_order | diferença entre referência temporal e last_order_at | derivado |
| avg_days_between_orders | média dos intervalos entre compras elegíveis consecutivas | `orders` |
| frequency_per_30d | pedidos elegíveis normalizados por janela/tenure | derivado |
| favorite_products | produtos por quantidade comprada | `orders.items` |
| predominant_weekday | dia da semana com maior frequência | `orders.created_at` |
| predominant_hour | faixa/horário mais frequente | `orders.created_at` |
| coupon_usage_count | pedidos elegíveis com `coupon_id` | `orders` |
| promotion_usage | usos vinculados ao cliente/pedido quando comprováveis | `promotion_usage` |
| cancellations | pedidos cancelados do mesmo cliente partner-scoped | `orders` |
| refunds | pedidos reembolsados | `orders` |
| chargebacks | pedidos em chargeback | `orders` |

### 5.1 Categoria favorita

Não será tratada como métrica histórica autoritativa na Fase 1.

O snapshot atual de `orders.items` não contém categoria comprovadamente estável.

Pode ser exposta futuramente como:
- categoria atual aproximada; ou
- categoria histórica após snapshot dedicado.

## 6. Lifecycle mínimo

Os nomes abaixo são contratos de produto; thresholds finais devem ser parametrizados e testados antes de automação.

### NEW
Cliente com exatamente 1 compra realizada.

### AWAITING_SECOND_PURCHASE
Cliente com exatamente 1 compra realizada e dentro da janela definida para tentativa de segunda compra.

### RECURRING
Cliente com 2 ou mais compras realizadas.

### HIGH_VALUE
Cliente que ultrapassa threshold de gasto/ticket definido por política do Growth.

### LOYAL
Cliente recorrente que também satisfaz critérios de frequência/tenure definidos pelo Growth.

### AT_RISK
Cliente previamente recorrente cuja recência excede seu comportamento esperado ou threshold configurado.

### INACTIVE
Cliente sem compra por janela de inatividade definida.

### REACTIVATED
Cliente que realiza nova compra após ter cumprido critério de INACTIVE.

## 7. Regra de thresholds

Na Fase 1:

- thresholds devem ficar fora da UI;
- thresholds não podem ser hardcoded em múltiplos componentes;
- qualquer regra inicial deve possuir teste de contrato;
- thresholds não alteram dados financeiros.

## 8. Produtos e comportamento

`orders.items` é o snapshot histórico disponível.

Chaves comprovadas no histórico:

- `id`
- `productId`
- `name`
- `price`
- `qty`
- `total`
- `kind`
- `builderId`
- `selections`
- `addons`
- `notes`

A Fase 1 deve aceitar variações históricas de shape sem falhar o perfil inteiro.

## 9. Benefits, Rewards, cupons e promoções

Podem enriquecer Customer 360 apenas como leitura.

Fontes existentes incluem:

- `coupons`
- `promotions`
- `promotion_usage`
- `benefit_campaigns`
- `customer_benefit_credits`
- `benefit_credit_ledger`
- `benefit_reservations`
- `reward_programs`
- `customer_reward_progress`
- `reward_progress_events`

Customer 360 não escreve saldo, crédito ou benefício durante a Fase 1.

## 10. Comunicação e LGPD

Fontes existentes:

- `customer_consents`
- `customer_preferences`
- `customer_communication_preferences`
- `customer_communication_history`

A Fase 1 pode exibir estado de consentimento quando a identidade autenticada estiver comprovadamente vinculada.

Ela não deve inferir consentimento de marketing apenas pela existência de telefone/e-mail.

Campanhas automáticas permanecem fora do escopo.

## 11. Segurança

### 11.1 Owner/Partner

Toda consulta deve ficar restrita ao restaurante do usuário autenticado.

### 11.2 Partner Growth

Acesso somente aos restaurantes ativos atribuídos em `partner_growth_assignments`, validado por `private.has_partner_growth_restaurant()` ou contrato equivalente server-side.

### 11.3 Admin

Acesso somente após RBAC administrativo explícito.

### 11.4 Frontend

Filtros no frontend nunca são barreira de segurança.

## 12. Incompatibilidades obrigatórias antes do Customer 360 operacional

### GROWTH-1.1 — Segmentos

Código atual referencia `customer_segments.primary_segment`.

Schema real possui `customer_segments.segment`.

Deve existir um único contrato.

### GROWTH-1.2 — Loyalty

`CustomerIntelligenceService` consulta colunas que não correspondem ao schema atual de `customer_loyalty`.

O contrato deverá ser alinhado ao schema real antes do uso.

### GROWTH-1.3 — Base guest

`CustomerAnalyticsService.forCustomer()` depende de `orders.customer_id`.

O Customer 360 deverá operar a partir da identidade partner-scoped de `customers` e incluir pedidos guest por telefone normalizado.

## 13. Interface mínima esperada

A futura camada deverá oferecer semanticamente operações equivalentes a:

```ts
getCustomer360(restaurantId, customerId)
listCustomer360(restaurantId, filters)
```

A implementação concreta poderá ser service server-side, RPC ou composição controlada, desde que:

- RLS/RBAC permaneça efetivo;
- não exista acesso cross-tenant;
- métricas usem o contrato de venda realizada;
- não exista cálculo financeiro autoritativo dentro do Growth.

## 14. Critérios de aceite do Gate GROWTH-0

O Gate é PASS quando:

- [ ] DEC-013 aprovada;
- [ ] identidade canônica aceita;
- [ ] contrato guest/auth definido;
- [ ] estados elegíveis documentados;
- [ ] catálogo de métricas definido;
- [ ] lifecycle inicial definido;
- [ ] isolamento de acesso especificado;
- [ ] incompatibilidades GROWTH-1 registradas;
- [ ] impactos nos módulos críticos declarados;
- [ ] nenhuma migration/código de Fase 1 executada neste gate.

## 15. Gates seguintes

### GROWTH-1 — Contract Repair
Correções isoladas de incompatibilidades comprovadas.

### GROWTH-2 — Customer 360 Read Model
Implementação server-side read-only.

### GROWTH-3 — Metric Integrity
Testes determinísticos com fixtures.

### GROWTH-4 — Tenant Security
Matriz E2E cross-tenant/RBAC.

### GROWTH-5 — Customer 360 UI
UI consumindo somente contratos validados.

### GROWTH-6 — Customer Intelligence
Segmentação, score, oportunidades e insights.

### GROWTH-7 — Measurement
Ação → novo pedido → resultado.

### GROWTH-8 — Campaign Automation
Somente após consentimento, persistência, opt-out, atribuição e auditoria.

## 16. Fora do escopo

GROWTH-0 e a Fase 1 não autorizam:

- alteração de Checkout;
- alteração de OrderService;
- alteração de PricingEngine;
- alteração de PaymentService;
- alteração de Mercado Pago;
- alteração da state machine;
- automação de campanha;
- IA;
- criação de novo customer master;
- merge automático de identidades;
- alteração de saldos/benefícios;
- mudança de RLS nesta etapa.
