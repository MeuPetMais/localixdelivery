# ARCHITECTURE DECISIONS (ADR)

## ADR-001

Data: 23/07/2026

Título:
Separar fluxo operacional do fluxo financeiro.

Problema:

O Kanban utilizava apenas o status para determinar a coluna.

Consequência:

Pedidos em dinheiro apareciam aguardando pagamento.

Decisão:

Criar OrderColumnResolver utilizando:

- status
- payment_method
- payment_status

Status:

Aceito.

---

## ADR-002

Título:

Toda regra de pedido deverá ficar no Order Domain.

Status:

Aceito.