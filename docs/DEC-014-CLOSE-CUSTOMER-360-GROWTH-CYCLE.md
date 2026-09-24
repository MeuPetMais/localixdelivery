# DEC-014 — Encerramento do ciclo Customer 360 / Growth Engine

- **Data:** 2026-09-24
- **Status:** APROVADA
- **Escopo:** Localix Growth / Customer 360 / Customer Intelligence / Measurement / Campaign Automation
- **Tipo:** Decisão estrutural de arquitetura e produto
- **Gates consolidados:** GROWTH-0 a GROWTH-8

## 1. Problema

O Localix precisava evoluir de uma visão simples de clientes para um CRM comportamental capaz de:
- identificar recompra, recorrência, risco e inatividade;
- funcionar com clientes autenticados e guest;
- manter isolamento por parceiro;
- não assumir autoridade financeira;
- medir resultados;
- preparar automações sem disparos inseguros.

Antes deste ciclo havia fragmentação entre `public.customers`, `auth.users/customer_profiles`, serviços legados de Intelligence, comunicação e segmentação.

## 2. Contexto

O Documento Mestre estabelece como prioridade:
- recorrência de pedidos;
- clientes novos, recorrentes e frequência;
- retenção/churn;
- instrumentação de KPIs e eventos do funil;
- validação de recompra e fidelidade;
- automação progressiva sem comprometer segurança e unit economics.

O ciclo GROWTH foi executado entre GROWTH-0 e GROWTH-8 com validações de código, Vercel e Supabase.

## 3. Opções consideradas

### A. Criar um CRM paralelo com nova tabela de clientes
Rejeitada por duplicar identidade e fonte comportamental.

### B. Basear Growth apenas em `auth.users/customer_profiles`
Rejeitada por excluir clientes guest.

### C. Consolidar Customer 360 sobre `public.customers` + `orders`
Escolhida e implementada.

## 4. Decisão

### 4.1 Fonte canônica
`public.customers` é a raiz partner-scoped do Customer 360.

`public.orders` permanece a fonte transacional de verdade.

### 4.2 Lifecycle
O lifecycle canônico do Customer 360 é:
- NEW
- AWAITING_SECOND_PURCHASE
- RECURRING
- HIGH_VALUE
- LOYAL
- AT_RISK
- INACTIVE
- REACTIVATED

Thresholds são centralizados no domínio Customer 360 e não devem ser duplicados no frontend.

### 4.3 Customer Intelligence
A inteligência deve derivar do `Customer360ReadModel`.

O módulo legado de intelligence não é autoridade para lifecycle do novo Growth.

### 4.4 Measurement
O ledger `growth_measurement_events` registra de forma durável:
- OPPORTUNITY_VIEWED
- ACTION_SELECTED
- ACTION_EXECUTED
- ORDER_ATTRIBUTED

Ele é analítico e **não** é fonte de verdade financeira.

### 4.5 Campaign Automation
A automação de Growth usa:
- `customer_growth_marketing_consents`
- `growth_campaign_automation_jobs`

Clientes guest são suportados porque consentimento é ligado a `public.customers`.

Automações suportadas nesta fase:
- SECOND_PURCHASE
- AT_RISK
- INACTIVE
- REACTIVATED
- RECURRENCE

Bloqueios obrigatórios:
- BLOCKED_CONSENT
- BLOCKED_PROVIDER
- BLOCKED_FREQUENCY
- READY

### 4.6 Envio real
Nenhum sender real é considerado aprovado por esta decisão.

Jobs READY somente poderão ser enviados quando existir provider comprovado, observabilidade e integração idempotente.

### 4.7 Autoridade financeira
Growth continua proibido de se tornar fonte autoritativa de:
- preço;
- taxa;
- desconto financeiro;
- pagamento;
- split;
- saldo;
- reembolso;
- state machine do pedido.

## 5. Evidências consolidadas

- GROWTH-0: contrato e DEC-013.
- GROWTH-1: reparo de contratos de schema.
- GROWTH-2: Customer 360 read model server-side.
- GROWTH-3: integridade de métricas/lifecycle.
- GROWTH-4: segurança tenant-scoped.
- GROWTH-5: UI conectada ao read model.
- GROWTH-6: intelligence derivada do Customer 360.
- GROWTH-7: measurement ledger durável.
- GROWTH-8: consentimento partner-scoped e fila de automação controlada.

Produção e staging foram validados como READY/SUCCESS após os merges correspondentes.

## 6. Limitações e dívidas remanescentes

1. **Sender real não comprovado**
   - Não foi possível provar integração durável de WhatsApp, e-mail ou push para campanhas Growth.

2. **Sem consentimentos reais ainda**
   - As novas tabelas de consentimento e jobs foram implantadas vazias.

3. **Matriz E2E completa de RBAC**
   - Não foi possível provar todas as combinações de papéis/operações em produção.

4. **Atribuição não implica causalidade**
   - `ORDER_ATTRIBUTED` prova vínculo técnico com ação anterior, não prova causalidade econômica absoluta.

5. **Favorite category**
   - Continua fora da Fase 1 por falta de snapshot histórico autoritativo de categoria nos itens do pedido.

6. **Legado de comunicação**
   - `customer_communication_preferences/history` continuam ligados a `auth.users` e não devem ser promovidos automaticamente para o novo consentimento Growth.

7. **Dívidas de segurança preexistentes**
   - Permanecem fora deste ciclo os advisories já conhecidos de SECURITY DEFINER, RLS sem policy em outras tabelas, pg_net em public e leaked password protection desabilitado.

## 7. Impacto

### Produto
O parceiro passa a ter base técnica para um CRM comportamental real, não apenas uma lista de clientes.

### Growth
O sistema pode identificar segunda compra, recorrência, risco, inatividade e reativação com regras centralizadas.

### Operação
A automação futura poderá ser escalada gradualmente, com bloqueios explícitos e sem dependência de operação manual em cada cliente.

### Financeiro
Nenhuma autoridade financeira foi deslocada para Growth.

### Segurança
Leitura e escrita permanecem tenant-scoped e server-enforced.

## 8. Próxima fase

A próxima fase deixa de ser construção estrutural do Customer 360 e passa a ser **validação operacional**:

1. capturar consentimentos reais;
2. integrar e provar um provider por canal;
3. executar campanhas controladas;
4. medir segunda compra, recorrência e receita atribuída;
5. comparar coortes expostas vs. não expostas quando aplicável;
6. revisar cooldowns e regras com dados reais.

## 9. Condição para revisão

Revisar esta decisão se:
- a identidade partner-scoped deixar de ser suficiente;
- houver mudança jurídica de consentimento;
- um novo provider exigir outro modelo de entrega;
- atribuição precisar evoluir para experimentação causal;
- Growth passar a operar cross-partner;
- houver mudança na arquitetura de pedidos ou tenant.

## 10. Relação com o Documento Mestre

**Esta decisão deve atualizar o Documento Mestre.**

O Documento Mestre deve passar a registrar:
- Customer 360 sobre `public.customers`;
- `orders` como fonte transacional;
- lifecycle centralizado;
- Growth Intelligence como derivação;
- measurement ledger;
- consentimento partner-scoped;
- automação bloqueada por consentimento/provider/frequência;
- ausência de sender aprovado nesta fase;
- passagem da fase estrutural para validação operacional.
