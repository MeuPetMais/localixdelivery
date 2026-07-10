# Localix Roadmap

- **Versão:** 1.0
- **Status:** Em Desenvolvimento
- **Última atualização:** 2026-07-10

Referência arquitetural obrigatória: [`docs/ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md).
Nenhuma release pode contrariar uma ADR aprovada. Caso necessário, criar
uma nova ADR antes de iniciar a release.

---

## Índice

- [Visão](#visão)
- [Releases Concluídas](#releases-concluídas)
- [Em Desenvolvimento](#em-desenvolvimento)
- [Próximas Releases](#próximas-releases)
- [Versão 1.0 — Checklist](#versão-10--checklist)
- [Princípios](#princípios)
- [Processo Oficial](#processo-oficial)
- [Métricas](#métricas)
- [Roadmap Visual](#roadmap-visual)
- [Histórico de Revisões](#histórico-de-revisões)

---

## Visão

A **Localix** é uma plataforma **SaaS de Delivery Próprio** (não é
marketplace). Cada restaurante opera de forma independente, com seu
próprio slug, cardápio, pedidos, motoboys e financeiro.

**Pilares oficiais:**

- Cardápio
- Pedidos
- Pagamentos
- Delivery
- Fidelidade
- Financeiro
- IA
- Analytics
- Marketplace de parceiros

---

## Releases Concluídas

### RC1 — Arquitetura Base
- **Status:** ✅ Concluído
- Multi-tenant, RLS, autenticação, base de domínios.

### RC2 — Payment Domain
- **Status:** ✅ Concluído
- Pricing Engine, Ledger append-only, Split, Stripe Connect Express.

### RC3 — Checkout
- **Status:** ✅ Concluído
- OrderService, Checkout Unificado (Stripe + PIX + Cash + MP).

### RC4 — Order Domain
- **Status:** ✅ Concluído
- State Machine, Timeline, Audit, EventBus, Kanban, Webhook idempotente.

### RC5.1 — Delivery Drivers
- **Status:** ✅ Concluído
- Auth, Realtime, RLS hardening (RC5.1.3), Audit, presença.

---

## Em Desenvolvimento

### RC5.2 — Delivery Assignment
- **Status:** 🟡 Em andamento
- Planejamento, Arquitetura, Assignment, Delivery State Machine,
  Delivery Timeline, DeliveryOrchestrator.

---

## Próximas Releases

### RC5.3 — Tracking
Localização em tempo real (cliente, motoboy, restaurante), Realtime.

### RC5.4 — Delivery Operations
Notificações operacionais, painéis de operação, gestão de fila.

### RC6 — Financeiro Operacional
Repasses, extratos, conciliação Stripe ↔ Ledger, saques.

### RC7 — Inteligência Artificial
Atendimento assistido, automações, insights, recomendações.

### RC8 — Observabilidade
Logs estruturados, tracing, health check, performance, alertas proativos.

---

## Versão 1.0 — Checklist

- ☑ Checkout
- ☑ Stripe
- ☐ PIX (quando liberado pela Stripe)
- ☐ Delivery
- ☐ Fidelidade
- ☑ Financeiro
- ☑ Painel Restaurante
- ☑ Painel Cliente
- ☐ Painel Motoboy
- ☑ Realtime
- ☑ Auditoria
- ☐ Observabilidade
- ☐ Soft Launch
- ☐ Go Live

---

## Princípios

- Toda release deve respeitar `docs/ARCHITECTURE_DECISIONS.md`.
- Nenhuma release pode contrariar uma ADR aprovada.
- Alterações arquiteturais exigem nova ADR registrada no histórico.
- SOLID, DDD, Clean Architecture e isolamento por domínio são
  obrigatórios.

---

## Processo Oficial

Todo novo módulo segue o pipeline:

```text
RFC
 ↓
Auditoria da RFC
 ↓
Implementação
 ↓
Auditoria Técnica
 ↓
Correções
 ↓
Certificação
 ↓
Homologação
 ↓
Produção
```

---

## Métricas

| Release | Status         | Data        | Responsável | Certificação |
|---------|----------------|-------------|-------------|--------------|
| RC1     | ✅ Concluído   | 2026-05     | Localix     | Aprovada     |
| RC2     | ✅ Concluído   | 2026-05     | Localix     | Aprovada     |
| RC3     | ✅ Concluído   | 2026-06     | Localix     | Aprovada     |
| RC4     | ✅ Concluído   | 2026-06     | Localix     | Aprovada     |
| RC5.1   | ✅ Concluído   | 2026-07-09  | Localix     | Aprovada     |
| RC5.2   | 🟡 Em andamento| —           | Localix     | Pendente     |
| RC5.3   | ⏳ Planejada   | —           | Localix     | Pendente     |
| RC5.4   | ⏳ Planejada   | —           | Localix     | Pendente     |
| RC6     | ⏳ Planejada   | —           | Localix     | Pendente     |
| RC7     | ⏳ Planejada   | —           | Localix     | Pendente     |
| RC8     | ⏳ Planejada   | —           | Localix     | Pendente     |

---

## Roadmap Visual

```text
┌────────────────────────── CONCLUÍDO ──────────────────────────┐
│                                                               │
│   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌───────┐           │
│   │ RC1 │ → │ RC2 │ → │ RC3 │ → │ RC4 │ → │ RC5.1 │           │
│   └─────┘   └─────┘   └─────┘   └─────┘   └───┬───┘           │
│    Base    Payment   Checkout   Orders    Drivers             │
└───────────────────────────────────────────────┼───────────────┘
                                                │
                                                ▼
┌───────────────────── EM DESENVOLVIMENTO ──────────────────────┐
│                        ┌─────────┐                            │
│                        │  RC5.2  │  Assignment                │
│                        └────┬────┘                            │
└─────────────────────────────┼─────────────────────────────────┘
                              │
                              ▼
┌────────────────────────── PLANEJADO ──────────────────────────┐
│                                                               │
│   ┌───────┐   ┌───────┐   ┌─────┐   ┌─────┐   ┌─────┐         │
│   │ RC5.3 │ → │ RC5.4 │ → │ RC6 │ → │ RC7 │ → │ RC8 │         │
│   └───────┘   └───────┘   └─────┘   └─────┘   └─────┘         │
│   Tracking   Delivery    Finance     IA      Observ.          │
│              Operations                                       │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Localix v1.0    │
                    │   Go Live oficial │
                    └───────────────────┘
```

---

## Histórico de Revisões

| Versão | Data       | Autor    | Mudanças                              |
|--------|------------|----------|---------------------------------------|
| 1.0    | 2026-07-10 | Localix  | Criação do roadmap oficial da plataforma. |

---

> Este é o **roadmap oficial** da plataforma Localix e a referência
> obrigatória para planejamento de releases. Alterações exigem nova
> versão registrada no Histórico de Revisões.
