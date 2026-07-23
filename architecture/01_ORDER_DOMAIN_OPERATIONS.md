# ORDER DOMAIN RC2 - OPERAÇÕES

**Projeto:** Localix Delivery

**Objetivo**

Este documento controla toda a execução da refatoração do Order Domain.

Cada operação deve:

- possuir objetivo;
- possuir escopo;
- possuir critérios de aceite;
- possuir rollback;
- possuir validação;
- ser concluída antes da próxima iniciar.

---

# Status Geral

| Operação | Nome | Status |
|----------|------|--------|
|001|Fundação do Order Domain|⬜ Não iniciada|
|002|Migração das Constantes|⬜ Não iniciada|
|003|Order Column Resolver|⬜ Não iniciada|
|004|Correção do Fluxo Dinheiro|⬜ Não iniciada|
|005|Order State Machine|⬜ Não iniciada|
|006|Order Actions|⬜ Não iniciada|
|007|Migração do Kanban|⬜ Não iniciada|
|008|Dashboard|⬜ Não iniciada|
|009|Checkout|⬜ Não iniciada|
|010|Motoboy|⬜ Não iniciada|
|011|Remoção do Código Legado|⬜ Não iniciada|

---

# OPERAÇÃO 001

## Nome

Fundação do Order Domain

---

## Objetivo

Criar toda a estrutura do domínio de pedidos sem alterar qualquer comportamento do sistema.

Esta operação é exclusivamente estrutural.

---

## Escopo

Criar:

src/lib/orders/

Criar:

src/lib/orders/domain/

Criar:

types.ts

constants.ts

helpers.ts

index.ts

README.md

Criar:

order-column-resolver.ts

order-payment-policy.ts

order-state-machine.ts

order-actions.ts

---

## Arquivos Alterados

Nenhum.

Somente criação de arquivos.

---

## Dependências

Nenhuma.

---

## Riscos

Baixíssimo.

Não altera código existente.

---

## Critério de Aceite

✓ Projeto continua compilando

✓ Nenhum comportamento alterado

✓ Nenhum teste quebrado

✓ Nenhuma tela alterada

---

## Rollback

Excluir a pasta:

src/lib/orders/

---

## Resultado Esperado

A estrutura do domínio existe.

Ainda não existe lógica nova.

Nenhum arquivo do sistema utiliza o novo domínio.

---

## Status

⬜ Não iniciada

---

# LOG DE EXECUÇÃO

(Data, responsável, observações e resultados serão registrados aqui durante a execução.)