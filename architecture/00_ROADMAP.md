# LOCALIX RC2 — ROADMAP DE REFATORAÇÃO DO ORDER DOMAIN

**Versão:** RC2
**Status:** Em Planejamento
**Responsável:** RNG Digital
**Data de início:** 23/07/2026

---

# Objetivo

Refatorar toda a arquitetura do domínio de pedidos (Order Domain), centralizando regras de negócio, eliminando lógica duplicada e preparando o sistema para evolução futura sem quebrar funcionalidades existentes.

A refatoração será incremental, garantindo que o sistema permaneça operacional durante todas as etapas.

---

# Princípios

Durante esta refatoração, seguiremos os seguintes princípios:

- Nenhuma regra de negócio ficará dentro das telas.
- Nenhuma regra será duplicada.
- Toda decisão deverá existir em apenas um lugar.
- Cada operação deverá ser pequena e reversível.
- Todo código novo deverá ser testável.
- Toda alteração deverá preservar compatibilidade com a versão atual.

---

# Objetivos Técnicos

Ao final da RC2 teremos:

- Order Domain centralizado.
- Máquina de estados única.
- Política de pagamento centralizada.
- Resolver único para o Kanban.
- Separação entre fluxo operacional e fluxo financeiro.
- Código desacoplado da interface.
- Base preparada para novos meios de pagamento.

---

# Escopo

Esta RC2 contempla exclusivamente:

- Order Domain
- Kanban
- Fluxo operacional
- Fluxo de pagamento
- Estados dos pedidos
- Regras de transição

Não faz parte desta RC:

- Loyalty
- Marketplace
- IA
- Relatórios
- Analytics

---

# Estratégia

A migração será dividida em pequenas operações.

Cada operação deverá:

- possuir objetivo claro;
- possuir critérios de aceite;
- possuir plano de rollback;
- ser concluída antes da próxima iniciar.

---

# Fases

## Fase 1

Fundação

Status:

⬜ Não iniciada

---

## Fase 2

Migração do Kanban

Status:

⬜ Não iniciada

---

## Fase 3

Máquina de Estados

Status:

⬜ Não iniciada

---

## Fase 4

Política de Pagamentos

Status:

⬜ Não iniciada

---

## Fase 5

Dashboard

Status:

⬜ Não iniciada

---

## Fase 6

Motoboy

Status:

⬜ Não iniciada

---

## Fase 7

Limpeza do código legado

Status:

⬜ Não iniciada

---

# Critério de Conclusão

A RC2 será considerada concluída quando:

- Toda regra de pedidos estiver centralizada.
- Não existir lógica de negócio dentro da interface.
- Todos os módulos utilizarem o Order Domain.
- Toda a suíte de testes estiver aprovada.
- Não existirem dependências do código legado.

---

# Histórico

| Data | Evento |
|-------|--------|
|23/07/2026|Início da RC2|