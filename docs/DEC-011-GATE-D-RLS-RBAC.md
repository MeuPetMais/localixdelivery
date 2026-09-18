# DEC-011 — Encerramento técnico do Gate D: RLS, RBAC e superfície SECURITY DEFINER

## Problema

O Gate D da Fase A exige que a camada de autorização do Localix Delivery esteja tecnicamente controlada antes do piloto, cobrindo RLS, RBAC, privilégios de tabela, RPCs e funções `SECURITY DEFINER`.

A auditoria identificou que parte da segurança dependia corretamente de RLS, porém coexistia com grants amplos herdados por default e funções `SECURITY DEFINER` executáveis por papéis da API além do necessário.

Os principais riscos eram:

- `TRUNCATE` disponível para `anon`/`authenticated` em tabelas públicas, fora da proteção de RLS;
- funções internas de entregas executáveis diretamente por papéis da API;
- funções trigger-only com `EXECUTE` direto desnecessário;
- RPCs de loyalty capazes de alterar pontos sem isolamento adequado;
- helpers internos de suporte acessíveis por `anon`/`authenticated`;
- grants de escrita amplos em tabelas financeiras cuja política pública é somente leitura;
- default de `EXECUTE` em novas funções públicas;
- chamada de localização do entregador usando service role apesar de a RPC validar `auth.uid()`.

## Contexto

Em 18/09/2026 foram concluídos os seguintes hardenings:

1. remoção de `TRUNCATE` para `anon` e `authenticated` em todas as tabelas públicas;
2. hardening da superfície `SECURITY DEFINER` de entregas;
3. remoção de `EXECUTE` direto de funções trigger-only;
4. restrição das RPCs críticas de loyalty para `service_role`;
5. hardening dos helpers internos de suporte;
6. validação DB-side de ownership em `queue_next_driver`;
7. remoção de grants de escrita desnecessários em tabelas financeiras críticas;
8. remoção do default de `EXECUTE` para `PUBLIC`, `anon` e `authenticated` em novas funções criadas pelo owner `postgres`;
9. correção do caller de `upsert_driver_operational_location` para preservar o JWT do usuário autenticado.

A auditoria final em produção confirmou que todas as tabelas públicas estão com RLS habilitado.

## Opções consideradas

### Opção A — Manter grants amplos e depender exclusivamente de RLS

Rejeitada.

RLS não protege operações como `TRUNCATE`, e grants excessivos aumentam a superfície de erro e a dependência de policies perfeitas.

### Opção B — Revogar todos os RPCs de `anon`/`authenticated`

Rejeitada.

Parte das funções é contrato legítimo da aplicação ou helper necessário para policies RLS. Revogação em massa quebraria fluxos válidos sem ganho proporcional de segurança.

### Opção C — Least privilege seletivo com validação DB-side e contratos explícitos

Aprovada.

A abordagem preserva apenas as funções e grants necessários a fluxos legítimos, move helpers internos para `service_role`, mantém as validações sensíveis dentro do banco e exige grants explícitos para novas RPCs.

## Decisão

O **Gate D — RLS/RBAC** passa para:

**PASS TÉCNICO CONTROLADO**

A decisão se apoia nas seguintes evidências:

- todas as tabelas públicas de produção com RLS habilitado;
- `anon` e `authenticated` sem `TRUNCATE` em tabelas públicas;
- RPCs internas de loyalty, suporte e entregas restritas conforme o ator necessário;
- funções trigger-only sem execução direta por papéis da API;
- tabelas financeiras críticas com `anon` sem grants e `authenticated` somente leitura quando existe policy de leitura;
- default de novas funções do owner `postgres` sem `EXECUTE` automático para papéis públicos;
- funções de transição de pedido e entrega com validação de ator/ownership no banco;
- `queue_next_driver` validando owner/admin na própria RPC;
- `upsert_driver_operational_location` preservando `auth.uid()` pelo cliente autenticado;
- validações em staging antes de migrations críticas;
- deploy do código final de localização em produção pelo Vercel no commit `1fe680e7721eec6140b3c3ddcf6128b86f035abd`, estado `READY`;
- ausência de erros de runtime Vercel no intervalo imediatamente posterior ao deploy consultado.

## Evidências por área

### Tabelas públicas e RLS

A auditoria final não encontrou tabela pública com RLS desabilitado.

**Status: PASS**

### TRUNCATE

`anon` e `authenticated` possuem zero grants de `TRUNCATE` nas tabelas públicas atuais.

Os default privileges do owner `postgres` também não concedem `TRUNCATE` a esses papéis.

**Status: PASS**

### Pedidos e pagamentos

`orders` mantém leitura por policies autorizadas e não possui policy pública direta de escrita.

`payments`, `financial_ledger`, `order_payment`, `order_pricing_snapshot`, `payment_split`, `payment_reconciliation` e `payment_webhook_events` tiveram sua superfície de escrita reduzida ou mantida no ator server-side apropriado.

**Status: PASS**

### Loyalty / Localix Rewards

As RPCs que alteram saldo, reserva, commit, rollback e expiração estão restritas a `service_role`.

A vulnerabilidade comprovada em staging que permitia criação arbitrária de pontos via `anon` não está mais presente em produção.

**Status: PASS**

### Entregadores

As funções internas de autoatribuição e mutação operacional foram reduzidas a `service_role` quando apropriado.

As RPCs destinadas ao usuário autenticado validam ownership/membership no banco.

O caller de localização passou a usar o cliente autenticado, preservando `auth.uid()`.

**Status: PASS TÉCNICO**

### Suporte

Helpers internos que geram notificações, processam SLA ou expõem IDs internos estão restritos a `service_role`.

Helpers usados diretamente em policies permanecem executáveis conforme necessidade do RLS.

**Status: PASS TÉCNICO**

### Funções futuras

Novas funções criadas pelo owner `postgres` no schema `public` não recebem mais `EXECUTE` automaticamente para `PUBLIC`, `anon` ou `authenticated`.

Toda nova RPC de aplicação deve conceder `EXECUTE` explicitamente aos papéis necessários.

**Status: PASS**

## Funções SECURITY DEFINER ainda acessíveis

A auditoria final encontrou funções ainda acessíveis a `authenticated` ou `anon` por desenho.

Elas se dividem em:

- RPCs de aplicação com validação interna de ator/ownership;
- funções de leitura de Partner Growth com checagem de role;
- helpers de RLS/RBAC, como `has_role`, `is_support_manager`, `is_support_staff` e `can_access_support_category`;
- RPC de sincronização de sabores do Builder, protegida por `auth.uid()` e ownership do restaurante.

Essas funções não foram revogadas em massa porque fazem parte de contratos válidos ou dependências de policies.

Qualquer alteração futura nessa superfície exige auditoria de callers e policies antes de mudar grants.

## CI e dívida preexistente

O PR da correção de localização passou no CI scoped antes do merge.

O workflow executado depois do merge em `main` falhou por dívida global preexistente de lint/Prettier no repositório, com aproximadamente 13 mil ocorrências fora do escopo do Gate D.

Essa falha global não foi causada pela correção do Gate D, mas permanece dívida técnica separada.

Ela não deve ser confundida com regressão dos testes scoped usados como evidência desta decisão.

## Limitações

Não foi executada uma matriz E2E completa em produção com contas reais de todos os papéis RBAC tentando todas as operações permitidas e negadas.

**Não foi possível provar** todas as combinações possíveis de autorização por comportamento real de usuário em produção.

O fechamento técnico se baseia em:

- definição real das policies e funções em produção;
- grants efetivos consultados no banco;
- testes controlados em staging;
- testes scoped no CI;
- verificação dos deploys e migrations aplicados.

## Impacto

### Checkout / Pedidos / OrderService

Sem alteração de cálculo financeiro ou fluxo de criação de pedido. A proteção de transições permanece server-side.

### PricingEngine / PaymentService / Mercado Pago

Nenhuma mudança na fonte autoritativa de preço ou movimentação do gateway. O hardening reduz acesso direto às tabelas financeiras.

### Supabase / Banco / RLS / RBAC

A superfície pública passa a operar com menor privilégio e contratos de RPC mais explícitos.

### Localix Benefits / Rewards

Saldo e mutações permanecem server-side por `service_role`.

### Parceiros

Leituras autorizadas permanecem disponíveis; gravações financeiras diretas continuam bloqueadas.

### Clientes

Fluxos públicos não financeiros permanecem inalterados pelas migrations do Gate D.

### Entregadores

A ingestão de localização passa a preservar corretamente a identidade autenticada usada pela RPC.

### Painel administrativo

Acesso administrativo continua condicionado às roles/policies existentes.

## Riscos residuais

- helpers de RLS `SECURITY DEFINER` continuam expostos quando necessários a policies;
- default ACL do role `supabase_admin` permanece fora do controle do owner `postgres`, embora nenhuma tabela pública atual seja de propriedade desse role;
- futuras migrations podem reintroduzir grants amplos se não seguirem o padrão explícito;
- a matriz completa de autorização deve fazer parte dos testes de regressão do piloto;
- a dívida global de lint do repositório permanece aberta e independente do Gate D.

## Data

18/09/2026

## Status

**APROVADO — GATE D PASS TÉCNICO CONTROLADO**

## Condição para revisão

Reabrir esta decisão se ocorrer qualquer um dos seguintes eventos:

- nova tabela pública criada sem RLS;
- nova RPC `SECURITY DEFINER` criada com `EXECUTE` público sem justificativa;
- bypass de ownership ou role em pedido, pagamento, loyalty, suporte ou entregas;
- concessão de escrita financeira a `anon`/`authenticated` sem policy e caso de uso aprovados;
- alteração estrutural do RBAC;
- mudança relevante no modelo de autenticação Supabase;
- incidente de acesso cruzado entre restaurantes;
- evidência de que um helper de RLS expõe dados sensíveis ou permite enumeração indevida.
