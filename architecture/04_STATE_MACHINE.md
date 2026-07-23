# ORDER STATE MACHINE

Projeto: Localix Delivery
Versão: RC2
Status: Em elaboração

---

# Objetivo

Definir oficialmente o ciclo de vida de um pedido.

Toda mudança de status deverá passar pela OrderStateMachine.

Nenhum componente poderá alterar status diretamente.

---

# Estados

NOVO

↓

AGUARDANDO_PAGAMENTO

↓

PAGO

↓

ACEITO

↓

EM_PREPARO

↓

PRONTO

↓

SAIU_PARA_ENTREGA

↓

ENTREGUE

↓

CONCLUÍDO

---

# Estados Cancelados

CANCELADO

REJEITADO

REEMBOLSADO

CHARGEBACK

São estados finais.

---

# Estados Terminais

Um estado terminal não pode sofrer novas transições.

São eles:

- concluido
- cancelado
- rejeitado
- reembolsado
- chargeback

---

# Fluxo Operacional

## Pedido em Dinheiro

novo

↓

aceito

↓

em_preparo

↓

pronto

↓

saiu_para_entrega

↓

entregue

↓

concluido

---

## Pedido Online

aguardando_pagamento

↓

pago

↓

aceito

↓

em_preparo

↓

pronto

↓

saiu_para_entrega

↓

entregue

↓

concluido

---

# Transições Permitidas

novo

→ aceito

→ cancelado

---

aguardando_pagamento

→ pago

→ cancelado

---

pago

→ aceito

---

aceito

→ em_preparo

→ cancelado

---

em_preparo

→ pronto

---

pronto

→ saiu_para_entrega

---

saiu_para_entrega

→ entregue

---

entregue

→ concluido

---

# Perguntas que a StateMachine responderá

canAccept()

canCancel()

canAdvance()

canRefund()

canReject()

next()

previous()

availableTransitions()

isTerminal()

isOperational()

isFinancial()

---

# Objetivo

Eliminar:

NEXT_BY_STATUS

ALLOWED_TRANSITIONS

TERMINAL_STATUS

e qualquer regra duplicada existente no sistema.