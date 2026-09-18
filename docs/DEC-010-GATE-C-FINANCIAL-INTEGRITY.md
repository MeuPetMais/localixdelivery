# DEC-010 — Encerramento técnico do Gate C: integridade financeira Mercado Pago

## Problema

O Gate C da Fase A exigia comprovar, de forma controlada, os fluxos críticos de split, webhook, refund e idempotência do Mercado Pago antes de avançar para o Gate D.

Auditorias anteriores ainda classificavam parte desse escopo como não provado ou aberto, especialmente por:

- ausência de uso da tabela `payment_split`;
- ausência de reconciliação registrada em `payment_reconciliation`;
- refund sem prova suficiente de idempotência;
- ausência de tratamento idempotente por identidade estável de chargeback;
- `PAYMENT_FAILED` gravado por insert direto e sujeito a duplicidade;
- corrida entre expiração local e webhook de aprovação;
- transição interna via service role não reconhecida corretamente.

## Contexto

Entre 16/09/2026 e 18/09/2026 foram entregues e validados os seguintes hardenings:

- bloqueio de cancelamento silencioso de pagamento online aprovado;
- proteção contra corrida expiração × webhook;
- correção do ator system/cron;
- correção da detecção de service role em transições internas;
- hardening de escrita da tabela `payments`;
- refund por refund ID, com ledger idempotente;
- chargeback por case ID, com efeito financeiro somente em `charged_back + settled`;
- `PAYMENT_FAILED` por payment ID, usando o helper idempotente e índice único condicional.

O split efetivo do Mercado Pago é feito na criação do pagamento por `application_fee`/marketplace fee usando `order_pricing_snapshot.platform_fee`.

A produção contém pagamentos reais aprovados cujo payload persistido pelo Mercado Pago mostra:

- `fee_details.type = application_fee`;
- valor de `application_fee` compatível com o snapshot;
- `charges_details.accounts.to = marketplace_owner`.

Portanto, a ausência de linhas em `payment_split` não significa ausência de split real no Mercado Pago. A tabela `payment_split` pertence a um fluxo interno separado e não é a fonte autoritativa do split inline já executado pelo gateway.

## Opções consideradas

### Opção A — Manter o Gate C aberto até existir uso real de `payment_split` e `payment_reconciliation`

Rejeitada como critério do Gate C.

Essas tabelas fornecem orquestração/observabilidade interna, mas o split financeiro real já ocorre no gateway por `application_fee`. Exigir essas tabelas para provar o split misturaria o mecanismo financeiro efetivo com uma camada administrativa ainda não utilizada.

### Opção B — Encerrar o Gate C apenas com evidência de código

Rejeitada.

Código isolado não é evidência suficiente para um fluxo financeiro crítico.

### Opção C — Encerrar o Gate C com evidência combinada de produção, staging e controles de idempotência

Aprovada.

## Decisão

O **Gate C — split, webhook, refund e idempotência** passa para:

**PASS TÉCNICO CONTROLADO**

A evidência aceita é a combinação de:

1. split real histórico confirmado nos payloads de pagamentos Mercado Pago em produção;
2. idempotência de criação de pagamento via `X-Idempotency-Key`;
3. webhook com trust boundary e persistência de evento;
4. proteção contra corrida de expiração e aprovação;
5. refund idempotente por identidade de refund;
6. chargeback idempotente por case ID e somente após resultado financeiro `settled`;
7. `PAYMENT_FAILED` idempotente por payment ID;
8. índices únicos condicionais no `financial_ledger`;
9. testes de CI dos hotfixes;
10. validações controladas em staging antes dos deploys;
11. bundle final de produção conferido contra o candidato validado.

## Evidências consolidadas

### Split

Produção contém pagamentos aprovados com `application_fee` real e cobrança destinada ao `marketplace_owner`.

**Status: PASS**

### Webhook

O fluxo atual:

- persiste eventos;
- valida contexto contra a API do Mercado Pago;
- usa trust boundary;
- aplica transições pela state machine;
- possui tratamento idempotente no ledger;
- possui proteção para aprovação após expiração.

Eventos históricos não processados permanecem no banco e são anteriores aos hardenings recentes. Eles não devem ser apagados ou reprocessados automaticamente sem auditoria própria.

**Status: PASS TÉCNICO**

### Refund

Refund usa identidade:

`<payment_id>:refund:<refund_id>`

e grava `REFUND` idempotente no ledger.

Cenários de repetição, múltiplos refunds e identidade inválida foram validados em staging. O bundle foi publicado em produção sem alteração de secrets ou migrations não relacionadas.

**Status: PASS TÉCNICO**

### Chargeback

Chargeback usa:

- `reference_type = mp_chargeback`;
- `reference_id = <chargeback_case_id>`;
- efeito financeiro apenas quando `status=charged_back` e `status_detail=settled`.

`in_process` e `reimbursed` não geram débito de chargeback.

**Status: PASS TÉCNICO**

### PAYMENT_FAILED

`REJECTED`, `CANCELLED` e `EXPIRED` usam identidade:

`mp_payment:<payment_id>:PAYMENT_FAILED`

A produção mantém 17 linhas históricas para 11 identidades; essas duplicidades são anteriores ao novo helper e foram preservadas deliberadamente.

Novas linhas passam a usar `ledger_idempotency_key` e índices únicos condicionais.

**Status: PASS TÉCNICO**

### Idempotência

Proteções atuais cobrem:

- criação de pagamento;
- PAYMENT_PENDING;
- PAYMENT_APPROVED;
- PAYMENT_FAILED;
- REFUND;
- CHARGEBACK;
- eventos de webhook por event ID quando fornecido pelo provider.

**Status: PASS**

## Limitações e evidência ainda não observada

Não ocorreu, após os últimos deploys, um evento real controlado em produção para:

- refund;
- chargeback;
- novo PAYMENT_FAILED.

**Não foi possível provar** esses três cenários por ocorrência real pós-deploy em produção.

A decisão de fechamento técnico do Gate C se apoia na validação controlada em staging, no bundle idêntico publicado em produção e nas evidências históricas reais de split.

## payment_split e payment_reconciliation

As tabelas permanecem vazias em produção na data desta decisão.

Isso deve ser tratado como backlog separado de observabilidade/conciliação financeira e não como falha do split inline do Mercado Pago.

Nenhum dado deve ser fabricado apenas para preencher essas tabelas.

## Impacto

### Checkout / OrderService / PricingEngine

Sem mudança de fonte financeira: `order_pricing_snapshot` permanece autoritativo.

### PaymentService / Mercado Pago

Fluxos de erro, refund e chargeback agora possuem identidade financeira estável.

### Banco / Supabase

Índices condicionais reforçam idempotência sem reescrever duplicidades históricas.

### Pedidos / state machine

Eventos financeiros passam por transições controladas; cancelamento silencioso de pagamento online aprovado é bloqueado.

### Painel administrativo

`payment_split` e `payment_reconciliation` continuam disponíveis, mas não são fonte de verdade do split inline já realizado pelo gateway.

## Riscos residuais

- eventos históricos `payment_webhook_events.processed=false` ainda precisam de auditoria separada;
- duplicidades históricas do ledger não devem ser apagadas sem reconciliação externa;
- falta observabilidade automática de reconciliação financeira;
- ocorrência real de refund/chargeback/PAYMENT_FAILED pós-deploy ainda não foi observada;
- Gate D de RLS/RBAC permanece separado e não é encerrado por esta decisão.

## Data

18/09/2026

## Status

**APROVADO — GATE C PASS TÉCNICO CONTROLADO**

## Condição para revisão

Reabrir esta decisão se ocorrer qualquer um dos seguintes eventos:

- cobrança duplicada nova;
- ledger duplicado após os novos índices;
- refund duplicado ou divergente;
- chargeback financeiro criado em estado não-settled;
- pagamento aprovado terminando silenciosamente cancelado;
- divergência entre `application_fee` do gateway e `order_pricing_snapshot.platform_fee`;
- falha sistemática de webhooks reais após o rollout;
- mudança de arquitetura do split Mercado Pago.
