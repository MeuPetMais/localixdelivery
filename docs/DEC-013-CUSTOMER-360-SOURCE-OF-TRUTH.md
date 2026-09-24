# DEC-013 — Fonte canônica e arquitetura do Customer 360

- **Data:** 2026-09-24
- **Status:** PROPOSTA — aguardando aprovação/merge
- **Escopo:** Localix Growth / Customer Intelligence / Customer 360
- **Tipo:** Decisão arquitetural
- **Gate:** GROWTH-0

## 1. Problema

O Localix possui dois modelos de identidade de cliente:

1. `public.customers` — projeção por restaurante, alimentada deterministicamente por `orders`, identificada por `restaurant_id + telefone normalizado`, inclusive para pedidos sem cadastro.
2. `auth.users` / `public.customer_profiles` — identidade global autenticada, referenciada opcionalmente por `orders.customer_id`.

O Customer Intelligence existente consulta predominantemente `orders.customer_id`, enquanto a projeção `customers` cobre uma parcela maior da base comportamental, incluindo clientes guest.

Sem uma fonte canônica explícita, a evolução do Growth pode:
- excluir clientes sem cadastro;
- duplicar identidades;
- criar nova tabela desnecessária;
- misturar verdade comportamental com identidade de autenticação;
- introduzir inconsistências entre parceiros.

## 2. Contexto

A auditoria read-only do Growth confirmou em produção:

- trigger `trg_orders_upsert_customer` em INSERT/UPDATE de `orders`;
- função `private.upsert_customer_from_order()`;
- função `private.rebuild_customer_order_metrics()`;
- índice único `customers_restaurant_normalized_phone_uidx`;
- métricas em `customers`: `total_orders`, `total_spent`, `avg_ticket`, `last_order_at`;
- somente `entregue` e `concluido` são elegíveis para métricas realizadas de Growth;
- RLS de `customers` é tenant-scoped por restaurante;
- Partner Growth possui carteira e RPCs próprios;
- Customer Intelligence, segmentos e insights existem parcialmente, mas não estão operacionalmente completos em produção.

Também foram encontradas divergências entre código e schema em componentes de Customer Intelligence. Elas devem ser corrigidas antes de a camada passar a ser fonte operacional.

## 3. Opções consideradas

### Opção A — Criar nova tabela `crm_customers` / `customer_360`
**Rejeitada.**

Duplicaria `customers`, criaria uma segunda projeção do mesmo fato comportamental e aumentaria risco de divergência.

### Opção B — Usar `customer_profiles` como raiz do Customer 360
**Rejeitada.**

Excluiria clientes guest e acoplaria inteligência comercial ao cadastro/autenticação global.

### Opção C — Usar `customers` como raiz partner-scoped e `orders` como verdade transacional
**Escolhida.**

Preserva a projeção já existente, cobre guest e autenticado, mantém isolamento por restaurante e minimiza mudanças.

## 4. Decisão

### 4.1 Fonte canônica do Customer 360

A raiz do Customer 360 será:

```text
public.customers
tenant key: restaurant_id
behavioral identity: customers.id
projection key: restaurant_id + telefone normalizado
```

`public.orders` continua sendo a fonte transacional de verdade para comportamento de compra.

### 4.2 Identidade autenticada

`auth.users` e `customer_profiles` continuam representando a identidade global autenticada.

Eles **não substituem** `customers`.

O vínculo entre cliente partner-scoped e identidade autenticada deverá ter contrato próprio antes de qualquer merge automático.

### 4.3 Venda válida para Growth

Growth deverá consumir o contrato existente em:

`src/lib/orders/order-metrics-contract.ts`

Estados válidos para venda realizada:

- `entregue`
- `concluido`

Todos os demais estados permanecem excluídos das métricas realizadas.

### 4.4 Autoridade financeira

Growth é consumidor de dados financeiros e transacionais já consolidados.

Growth **não pode** tornar-se fonte autoritativa de:

- preço;
- taxa;
- desconto financeiro;
- pagamento;
- split;
- saldo;
- reembolso;
- status financeiro;
- state machine do pedido.

Para valores financeiros autoritativos, os domínios de Pricing/Payment e snapshots financeiros permanecem responsáveis.

### 4.5 Primeira implementação

A Fase 1 — Customer 360 deverá nascer como **read model server-side**, sem alterar:

- Checkout;
- OrderService;
- PricingEngine;
- PaymentService;
- Mercado Pago;
- webhooks;
- state machine;
- fluxo de criação do pedido.

Nenhuma nova tabela de cliente deverá ser criada apenas para o Customer 360.

## 5. Motivo

Esta opção:

- reutiliza infraestrutura comprovada;
- preserva clientes guest;
- mantém tenant isolation;
- reduz migrations;
- evita duplicidade de fontes;
- diminui risco sobre Checkout e pagamentos;
- permite evolução incremental e testável.

## 6. Impacto

### Positivo
- Customer 360 pode ser construído majoritariamente por leitura.
- Métricas comportamentais podem reutilizar histórico já existente.
- Segmentação e insights podem ser conectados posteriormente sem recriar clientes.
- Benefits, Rewards, promoções e cupons podem enriquecer o perfil sem assumir autoridade financeira.

### Restrição
O Customer Intelligence atual não deve ser considerado operacionalmente completo enquanto continuar dependente apenas de `orders.customer_id` e enquanto persistirem incompatibilidades com o schema real.

## 7. Riscos

### ALTO
- tratar `customer_profiles` como universo completo de clientes;
- segmentar apenas clientes autenticados;
- usar services de Intelligence com contratos de schema desatualizados.

### MÉDIO
- mudança posterior de telefone em pedidos históricos;
- ausência de snapshot histórico de categoria no item do pedido;
- duplicidade conceitual de preferências/opt-in.

## 8. Segurança

Toda leitura do Customer 360 deve ser tenant-scoped e server-enforced.

Regra mínima:

```text
partner/owner -> somente restaurant_id próprio
partner_growth -> somente restaurantes atribuídos e ativos
admin -> acesso explícito por RBAC
customer -> apenas dados próprios quando aplicável
```

RLS/RBAC não poderá ser substituído por filtragem somente no frontend.

## 9. Condição para revisão

Revisar esta decisão se:

- a identidade por telefone deixar de ser suficiente para a projeção partner-scoped;
- houver necessidade comprovada de resolver múltiplas identidades por pessoa;
- pedidos passarem a exigir outro identificador canônico;
- o Customer 360 precisar operar cross-partner por motivo jurídico/estratégico aprovado;
- a arquitetura de tenant mudar.

## 10. Relação com o Documento Mestre

**Esta decisão deve atualizar o Documento Mestre.**

A atualização deverá registrar que:

- `customers` é a raiz partner-scoped do Customer 360;
- `orders` permanece fonte transacional;
- Growth é consumidor, não autoridade financeira;
- Customer 360 começa read-only;
- isolamento entre parceiros é obrigatório no servidor/banco.

## 11. Conflito documental identificado

Durante a preparação desta DEC foi identificado que `docs/ARCHITECTURE_DECISIONS.md` ainda declara Stripe como gateway oficial, enquanto decisões e implementação posteriores do projeto utilizam Mercado Pago.

Este conflito **não é resolvido pela DEC-013** e deve ser tratado separadamente como dívida documental, para evitar ampliar o escopo do Gate GROWTH-0.
