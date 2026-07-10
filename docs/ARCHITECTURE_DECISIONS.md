# Architecture Decision Records (ADR) — Localix

- **Versão:** 1.0.0
- **Criado em:** 2026-07-10
- **Status:** Oficial
- **Escopo:** Referência arquitetural única e obrigatória da plataforma Localix.

Este documento consolida as decisões arquiteturais oficiais da plataforma.
Toda evolução técnica deve respeitar os ADRs abaixo. Alterações exigem
nova revisão registrada no **Histórico de Revisões**.

---

## Índice

- [ADR-001 — Modelo da Plataforma](#adr-001--modelo-da-plataforma)
- [ADR-002 — Motoboys](#adr-002--motoboys)
- [ADR-003 — Gateway de Pagamentos](#adr-003--gateway-de-pagamentos)
- [ADR-004 — Modelo Stripe](#adr-004--modelo-stripe)
- [ADR-005 — Order Domain](#adr-005--order-domain)
- [ADR-006 — Payment Domain](#adr-006--payment-domain)
- [ADR-007 — Delivery Domain](#adr-007--delivery-domain)
- [ADR-008 — Timeline](#adr-008--timeline)
- [ADR-009 — Auditoria](#adr-009--auditoria)
- [ADR-010 — Segurança](#adr-010--segurança)
- [ADR-011 — Realtime](#adr-011--realtime)
- [ADR-012 — RLS](#adr-012--rls)
- [ADR-013 — Delivery Drivers](#adr-013--delivery-drivers)
- [ADR-014 — Integração Orders ↔ Delivery](#adr-014--integração-orders--delivery)
- [ADR-015 — Padrão de Desenvolvimento](#adr-015--padrão-de-desenvolvimento)
- [Histórico de Revisões](#histórico-de-revisões)

---

## ADR-001 — Modelo da Plataforma

**Decisão:** A Localix é um **SaaS de Delivery Próprio**.

- Cada restaurante opera de forma independente dentro da plataforma.
- **Não é marketplace de restaurantes.**
- Não existe agregador público, ranking cruzado ou catálogo unificado.
- O cliente entra sempre pelo slug do restaurante (`/{slug}`).

---

## ADR-002 — Motoboys

**Decisão:** Cada motoboy pertence exclusivamente a **um único restaurante**.

- Não existe compartilhamento de motoboys entre restaurantes.
- Não existe concorrência (leilão/broadcast) entre motoboys.
- Não existe marketplace de entregadores.
- `restaurant_id` do motoboy é imutável e enforced por RLS.

---

## ADR-003 — Gateway de Pagamentos

**Decisão:** Gateway oficial é **Stripe**.

- **Mercado Pago:** removido.
- **Asaas:** não utilizado.
- Toda nova integração de pagamento deve ocorrer via Stripe.

---

## ADR-004 — Modelo Stripe

**Decisão:** **Destination Charges** com plataforma como Merchant of Record.

- Merchant of Record: **Plataforma Localix**.
- Split via:
  - `application_fee_amount`
  - `transfer_data.destination`
- **Sem `on_behalf_of`.**
- Restaurantes recebem via conta conectada (Stripe Connect Express).

---

## ADR-005 — Order Domain

**Decisão:** Order Domain é a **única fonte de verdade para pedidos**.

Toda alteração de status segue obrigatoriamente o fluxo:

```text
Server Function
      ↓
OrderOrchestrator
      ↓
OrderStateMachine
      ↓
RPC (order_apply_transition, CAS)
      ↓
Timeline
      ↓
Audit
      ↓
Realtime
      ↓
EventBus
```

- **Proibido:** `UPDATE` direto em `orders.status`.
- Toda transição valida ator, estado atual e regras de negócio.

---

## ADR-006 — Payment Domain

**Decisão:** Payment Domain é a **única fonte de verdade para pagamentos**.

Responsabilidades exclusivas:

- Split (application fee / destination).
- Ledger contábil.
- Snapshot financeiro do pedido.
- Recebimento e reconciliação de webhooks Stripe.

Outros domínios consomem pagamento apenas via contratos públicos.

---

## ADR-007 — Delivery Domain

**Decisão:** Delivery Domain é responsável **exclusivamente** por:

- Assignments (atribuição de entregas)
- Drivers (cadastro, presença, status)
- Timeline de entrega
- Tracking
- Realtime
- Audit

**Nunca** será responsável pelo ciclo de vida do pedido — isso é do Order Domain.

---

## ADR-008 — Timeline

**Decisão:** Cada domínio possui **exatamente uma timeline**.

- Orders → `order_timeline`
- Delivery → `delivery_timeline`
- Payments → `payment_timeline`
- **Proibido** persistir eventos duplicados em tabelas paralelas.
- `EventBus` é in-process e não substitui a timeline persistida.

---

## ADR-009 — Auditoria

**Decisão:** Todos os domínios utilizam padrão comum:

- **Correlation ID** (UUID) propagado ponta a ponta.
- **Metadata** estruturada em JSONB.
- **Audit log** append-only por domínio.
- **Realtime** para observabilidade de operações críticas.

---

## ADR-010 — Segurança

**Decisão:** Nenhum `UPDATE` direto em tabelas de domínio.

- Toda mutação de estado passa pelo **Orchestrator** correspondente.
- RLS impede escrita direta pelo cliente.
- Mutação privilegiada via `SECURITY DEFINER` + validação de ator.

---

## ADR-011 — Realtime

**Decisão:** Todo estado crítico utiliza **Realtime** do Supabase.

- Polling é permitido **apenas** quando tecnicamente inevitável
  (ex.: sistemas externos sem push).
- Canais são scoped por tenant/entidade (nunca globais).

---

## ADR-012 — RLS

**Decisão:** Todo acesso é **isolado por tenant** (`restaurant_id`).

- Nenhuma policy pode permitir acesso cruzado entre restaurantes.
- Toda nova tabela em `public` exige RLS + `GRANT` explícito.
- Papéis administrativos (`admin`) validados via `has_role()`
  (SECURITY DEFINER, tabela `user_roles`).

---

## ADR-013 — Delivery Drivers

**Decisão:** No MVP, um motoboy pode possuir **apenas uma entrega ativa**.

- Estados ativos: `ACEITO`, `COLETANDO`, `EM_ROTA`.
- Validação enforced no `DeliveryOrchestrator` antes de novo assignment.
- Capacidade > 1 fica postergada para versão futura, sob nova ADR.

---

## ADR-014 — Integração Orders ↔ Delivery

**Decisão:** Comunicação **exclusivamente por contratos públicos**.

- **Orders** é dono do ciclo de vida do pedido (`orders.status`).
- **Delivery** é dono do ciclo de vida da entrega (`delivery_assignments.status`).
- Orders → Delivery: evento `OrderReadyForDelivery`.
- Delivery → Orders: `order_apply_transition(...)` (função pública).
- **Proibido:** imports cruzados de módulos internos entre domínios.

---

## ADR-015 — Padrão de Desenvolvimento

**Decisão:** Todo novo domínio segue o pipeline oficial:

```text
RFC → Auditoria → Implementação → Certificação → Homologação → Produção
```

- **RFC:** documento arquitetural sem código.
- **Auditoria:** revisão da RFC contra ADRs vigentes.
- **Implementação:** código + migrations + testes.
- **Certificação:** auditoria pós-implementação (P0/P1/P2).
- **Homologação:** validação end-to-end em ambiente pré-produção.
- **Produção:** release controlado com feature flag e rollback plan.

---

## Histórico de Revisões

| Versão | Data       | Autor    | Mudanças                                                |
|--------|------------|----------|---------------------------------------------------------|
| 1.0.0  | 2026-07-10 | Localix  | Criação do documento; ADR-001 a ADR-015 consolidados.   |

---

> Este documento é a **referência arquitetural oficial** da plataforma Localix.
> Qualquer decisão futura que altere um ADR deve ser registrada aqui via nova
> versão e entrada no Histórico de Revisões.
