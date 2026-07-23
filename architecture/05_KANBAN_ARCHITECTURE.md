# KANBAN ARCHITECTURE

Projeto: Localix Delivery

Versão: RC2

Status: Em elaboração

---

# Objetivo

Centralizar toda a lógica responsável por determinar em qual coluna um pedido deverá aparecer.

Nenhuma tela deverá decidir isso diretamente.

Toda decisão deverá passar pelo OrderColumnResolver.

---

# Problema Atual

Hoje a coluna é determinada apenas pelo status.

Exemplo:

status

↓

STATUS_TO_COLUMN

↓

Coluna

Esse modelo é insuficiente.

---

# Problema Encontrado

Pedido:

status = novo

payment_method = cash

Resultado esperado:

Coluna

Pago

Resultado atual:

Aguardando pagamento

Motivo:

O sistema ignora o método de pagamento.

---

# Nova Arquitetura

A coluna será determinada utilizando múltiplos fatores.

Exemplo:

Pedido

↓

OrderColumnResolver

↓

Status

↓

Método de pagamento

↓

Pagamento confirmado

↓

Regras operacionais

↓

Coluna

---

# Responsabilidades

O resolver deverá conhecer:

- status
- payment_method
- payment_status
- delivery_type (futuro)
- agendamento (futuro)

---

# Colunas

Pending Payment

Paid

Preparing

Ready

Delivering

Delivered

Cancelled

---

# Regras

Pedido:

cash

+

novo

↓

Paid

---

Pedido:

pix

+

aguardando_pagamento

↓

Pending Payment

---

Pedido:

pix

+

pago

↓

Paid

---

Pedido:

aceito

↓

Preparing

---

Pedido:

em_preparo

↓

Preparing

---

Pedido:

pronto

↓

Ready

---

Pedido:

saiu_para_entrega

↓

Delivering

---

Pedido:

entregue

↓

Delivered

---

Pedido:

cancelado

↓

Cancelled

---

# Objetivo Final

Eliminar completamente:

STATUS_TO_COLUMN

columnOf()

Qualquer decisão espalhada na interface.

Toda decisão deverá ser tomada pelo:

OrderColumnResolver