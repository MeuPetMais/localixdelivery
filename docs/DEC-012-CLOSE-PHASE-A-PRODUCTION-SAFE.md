# DEC-012 — Encerramento da Fase A e autorização para Piloto Controlado

## Problema

O Documento Mestre do Localix Delivery define a **Fase A — Produção Segura** com quatro critérios de saída:

1. concluir gates E2E de checkout e pagamentos;
2. confirmar a state machine e a integridade do status dos pedidos;
3. validar split, webhook, reembolso e idempotência;
4. fechar a auditoria de RLS/RBAC.

Após o fechamento formal dos Gates C e D, era necessário consolidar se a Fase A possuía evidência suficiente para transição ao piloto, sem reabrir hardenings já validados nem transformar dívida técnica preexistente em bloqueio artificial.

## Contexto

As evidências consolidadas disponíveis em código, staging, produção, CI e decisões anteriores incluem:

- checkout server-side com preço autoritativo e snapshot financeiro;
- E2E real de criação de pedido em staging após hardening de escrita de `orders`, com `orders`, `order_pricing_snapshot` e `order_payment` persistidos de forma coerente;
- state machine do domínio de pedidos consolidada e usada por fluxos internos, webhook e operações autenticadas;
- escrita direta pública de status/pedido restringida;
- guards para transições financeiras e cancelamento de pagamento online aprovado;
- tratamento explícito de ator autenticado, service role e system/cron;
- Gate C encerrado em `DEC-010` como **PASS TÉCNICO CONTROLADO**;
- Gate D encerrado em `DEC-011` como **PASS TÉCNICO CONTROLADO**;
- deploy funcional final do Gate D publicado em produção no commit `1fe680e7721eec6140b3c3ddcf6128b86f035abd` com estado READY;
- ausência de erros de runtime Vercel no intervalo imediatamente posterior ao deploy funcional auditado.

Não foram encontrados documentos separados intitulados “Gate A” e “Gate B”. Essa ausência é tratada como lacuna de governança documental, não como ausência automática de evidência técnica, porque os requisitos correspondentes possuem evidências distribuídas em validações e PRs anteriores.

## Opções consideradas

### Opção A — Reabrir toda a Fase A até criar e repetir Gates A e B formais

Rejeitada.

Repetir integralmente checkout, pagamentos e state machine apenas para produzir documentos com novos nomes adicionaria risco operacional e retrabalho sem atacar uma falha técnica comprovada.

### Opção B — Declarar produção irrestrita e Go Live completo

Rejeitada.

A evidência atual suporta um piloto controlado, mas não prova todas as combinações possíveis de papéis, dispositivos, integrações e operações em produção real.

### Opção C — Encerrar a Fase A como produção segura para piloto controlado

Aprovada.

Essa opção preserva as limitações conhecidas, mantém monitoramento reforçado e desloca o foco para ativação dos primeiros parceiros e coleta de métricas reais.

## Decisão

A **Fase A — Produção Segura** passa para:

**PASS TÉCNICO CONTROLADO — LIBERADA PARA FASE B / PILOTO CONTROLADO**

Isso não equivale a Go Live irrestrito.

A autorização vale para operação controlada com parceiros selecionados, volume acompanhado e capacidade de rollback/intervenção operacional.

## Consolidação dos critérios da Fase A

### 1. Checkout e pagamentos

**Status: PASS TÉCNICO CONTROLADO**

Evidências:

- preço autoritativo server-side;
- persistência coerente de pedido + snapshot + vínculo de pagamento;
- E2E real de criação de pedido em staging após hardening;
- fluxos PIX/cartão e split já validados em rodadas anteriores;
- criação financeira protegida por idempotência.

### 2. State machine e integridade dos pedidos

**Status: PASS TÉCNICO CONTROLADO**

Evidências:

- state machine consolidada no Order Domain;
- `order_apply_transition` como caminho controlado de transição;
- escrita direta pública restringida;
- atores autenticado, service role e system/cron tratados explicitamente;
- webhook utiliza transições controladas;
- guards financeiros preservados;
- histórico de status mantido.

### 3. Split, webhook, refund e idempotência

**Status: PASS TÉCNICO CONTROLADO**

Fonte formal: `DEC-010 — Encerramento técnico do Gate C: integridade financeira Mercado Pago`.

### 4. RLS/RBAC

**Status: PASS TÉCNICO CONTROLADO**

Fonte formal: `DEC-011 — Encerramento técnico do Gate D: RLS, RBAC e superfície SECURITY DEFINER`.

## Limitações

Não foi executada uma matriz E2E completa, em produção, de todas as combinações entre:

- papéis RBAC;
- métodos de pagamento;
- tipos de entrega;
- cancelamento;
- refund;
- chargeback;
- falha de pagamento;
- dispositivos/navegadores;
- fluxos de parceiro, cliente e entregador.

**Não foi possível provar** todas essas combinações por comportamento real em produção.

Também permanecem:

- dívida global preexistente de lint/Prettier;
- observabilidade de conciliação financeira ainda incompleta;
- eventos financeiros raros ainda sem ocorrência real pós-deploy em produção;
- matriz E2E completa de autorização ainda pendente;
- limite diário de deployments do plano Vercel atingido na data do encerramento documental, sem impacto sobre o bundle funcional já publicado.

## Impacto

### Checkout / OrderService / PricingEngine

Nenhuma mudança de regra financeira. O cálculo server-side e o snapshot permanecem fontes autoritativas.

### PaymentService / Mercado Pago

Nenhuma mudança adicional. Permanecem os controles formalizados no Gate C.

### Pedidos / state machine

Nenhuma nova transição é criada. O piloto deve usar os contratos atuais.

### Supabase / Banco / RLS / RBAC

Nenhuma alteração adicional. Permanecem os controles formalizados no Gate D.

### Parceiros

A plataforma pode iniciar onboarding de parceiros selecionados em piloto, com acompanhamento de ativação e primeiro pedido.

### Clientes

Aquisição deve começar de forma controlada nos parceiros piloto, com observação de carrinho → pedido → recompra.

### Entregadores

Operação deve ser limitada aos fluxos já homologados e monitorados no piloto.

### Painel administrativo

Deve ser usado como instrumento de acompanhamento de pedidos, incidentes e métricas do piloto.

## Condições operacionais da Fase B

A Fase B deve priorizar, nesta ordem:

1. selecionar parceiros elegíveis;
2. executar onboarding completo;
3. medir tempo até ativação e primeiro pedido;
4. instrumentar KPIs do funil;
5. acompanhar incidentes e falhas de pagamento;
6. executar aquisição dos clientes dos parceiros;
7. medir segunda compra e recorrência.

O objetivo do piloto não é maximizar cadastro de estabelecimentos.

O funil prioritário é:

**parceiro cadastrado → parceiro ativado → primeiro pedido → pedidos recorrentes → retenção**

e, para consumidores:

**visitante → carrinho → pedido → segunda compra → recorrência**

## Critérios de reabertura da Fase A

Reabrir a Fase A imediatamente se ocorrer:

- cobrança duplicada;
- pagamento sem pedido;
- pedido pago sem persistência íntegra;
- split divergente do snapshot;
- refund duplicado ou incorreto;
- webhook causando regressão de status;
- bypass de RLS/RBAC;
- acesso cruzado entre restaurantes;
- transição de pedido fora da state machine;
- incidente crítico que exija rollback estrutural.

## Data

18/09/2026

## Status

**APROVADO — FASE A ENCERRADA COM PASS TÉCNICO CONTROLADO; FASE B LIBERADA PARA PILOTO CONTROLADO**

## Condição para revisão

Revisar esta decisão:

- após o primeiro ciclo real do piloto;
- após incidente crítico;
- antes de ampliar significativamente volume, parceiros ou regiões;
- antes de declarar Go Live irrestrito.
