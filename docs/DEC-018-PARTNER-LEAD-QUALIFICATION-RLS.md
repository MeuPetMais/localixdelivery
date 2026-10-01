# DEC-018 — Qualificação segura de leads públicos assumidos

**Data:** 2026-10-01  
**Status:** Aprovada em Staging; promoção para Production pendente.

## Problema

A DEC-017 preserva `created_by = NULL` em leads originados da captura pública. A policy de UPDATE do comercial, porém, exigia `created_by = auth.uid()` no WITH CHECK. Assim, um lead público podia ser assumido via Claim e convertido, mas não qualificado por UPDATE normal.

## Evidência

Em Production, a policy foi inspecionada em modo read-only e o conflito foi comprovado. Em Staging, a correção foi aplicada e testada: o comercial responsável atualizou um lead público assumido de `new` para `qualified`, com Fit Score e classe; outro comercial não conseguiu atualizar lead atribuído ao primeiro; tentativa de alterar proveniência foi bloqueada com `LEAD_PROVENANCE_IMMUTABLE`.

## Opções consideradas

1. Preencher `created_by` durante o Claim — rejeitada porque destrói a proveniência da captura pública.
2. Remover indiscriminadamente as restrições da RLS — rejeitada por ampliar autoridade.
3. Autorizar UPDATE pelo ownership de `assigned_to`, mantendo restrições de não conversão e protegendo explicitamente a proveniência — escolhida.

## Decisão

O comercial pode atualizar lead não convertido quando `assigned_to = auth.uid()` e possui papel `comercial`. `created_by` pode ser o próprio usuário ou NULL. Os campos de proveniência/aquisição ficam imutáveis para usuários autenticados não-admin por trigger dedicada.

Campos protegidos incluem `created_by`, source/medium, UTMs, IDs Meta, `creative_code`, `external_ref` e `created_at`.

## Impacto

Fecha o gap operacional Captura pública → Claim → Qualificação, sem conceder autoridade sobre Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago, Localix Benefits ou receita.

## Riscos

A policy continua permitindo edição dos demais campos do lead atribuído; validações de domínio devem continuar no banco/UI quando aplicáveis. Admin permanece exceção à proteção de proveniência para operação controlada.

## Condição para revisão

Revisar se houver redistribuição de carteira, múltiplos responsáveis por lead, alteração do modelo de atribuição ou automação externa de CRM.
