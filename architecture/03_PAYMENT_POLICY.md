# PAYMENT POLICY

Projeto: Localix Delivery
Versão: RC2
Status: Em elaboração

---

# Objetivo

Centralizar todas as regras relacionadas aos meios de pagamento do Localix.

Nenhum componente da aplicação poderá implementar regras de pagamento diretamente.

Todas as decisões deverão utilizar o OrderPaymentPolicy.

---

# Princípios

- Separar pagamento do fluxo operacional.
- Evitar lógica duplicada.
- Facilitar novos meios de pagamento.
- Facilitar testes.
- Manter compatibilidade.

---

# Métodos de Pagamento

## Dinheiro

Código:

cash

Características:

- pagamento presencial
- restaurante pode aceitar imediatamente
- pedido pode entrar em preparo antes do pagamento
- pagamento confirmado na entrega

---

## PIX

Código:

pix

Características:

- pagamento online
- restaurante aguarda confirmação
- não inicia preparo antes da aprovação

---

## Cartão

Código:

credit_card

debit_card

Características:

- pagamento online
- necessita confirmação
- preparo somente após aprovação

---

# Classificação

## Offline

- cash

## Online

- pix
- credit_card
- debit_card
- google_pay
- apple_pay

---

# Regras Gerais

## Pedido em dinheiro

Pode:

- aceitar
- preparar
- cancelar

Não precisa:

- confirmação online

---

## Pedido online

Precisa:

- pagamento aprovado

Antes disso:

- restaurante não prepara

---

# Responsabilidades do OrderPaymentPolicy

Determinar:

- isCash()
- isPix()
- isCard()
- isOnline()
- isOffline()
- requiresPaymentConfirmation()
- restaurantCanAccept()
- restaurantCanPrepare()

---

# Futuras Expansões

- Vale-refeição
- Carteiras digitais
- PIX automático
- Split avançado
- Pagamento híbrido