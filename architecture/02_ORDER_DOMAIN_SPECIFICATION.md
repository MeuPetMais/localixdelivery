# ORDER DOMAIN SPECIFICATION

Projeto: Localix Delivery
Versão: RC2
Status: Em elaboração

---

# Objetivo

Centralizar toda a regra de negócio relacionada aos pedidos do Localix.

Este domínio será a única fonte de verdade para decisões relacionadas ao ciclo de vida de um pedido.

---

# Responsabilidades

O Order Domain será responsável por:

- determinar a coluna do Kanban;
- validar transições de estado;
- aplicar políticas de pagamento;
- definir ações disponíveis;
- validar regras operacionais;
- expor regras para Dashboard;
- expor regras para Motoboy;
- expor regras para Checkout.

---

# Fora do Escopo

Este domínio NÃO será responsável por:

- React
- Componentes
- UI
- Supabase
- Realtime
- API
- HTTP
- Navegação
- Toasts
- Dialogs

---

# Módulos

## OrderColumnResolver

Responsável por determinar em qual coluna um pedido deve aparecer.

---

## OrderPaymentPolicy

Responsável pelas regras de pagamento.

---

## OrderStateMachine

Responsável pelo fluxo operacional do pedido.

---

## OrderActions

Responsável por determinar quais ações estão disponíveis.

---

# Objetivo Final

Todos os módulos do sistema deverão consultar o Order Domain antes de tomar qualquer decisão relacionada aos pedidos.