# DEC-017 — Claim e conversão controlada de leads públicos

**Data:** 2026-09-30  
**Status:** Aprovada em Staging; promoção para Production pendente

## Problema

A captura pública definida na DEC-016 cria leads sem `assigned_to` e `created_by`, preservando a origem server-side. O fluxo comercial exige ownership antes de qualificação e conversão. A conversão existente rejeita corretamente um lead não atribuído com `LEAD_NOT_ASSIGNED`.

## Contexto

Não é aceitável resolver o problema por UPDATE administrativo direto, elevação artificial para admin ou relaxamento de RLS/RBAC. O ownership precisa ser adquirido de forma explícita, concorrente-segura e auditável.

## Opções consideradas

1. Relaxar a conversão para aceitar leads sem responsável — rejeitada.
2. Atribuir leads por SQL operacional — rejeitada.
3. Criar Claim autenticado, preservando a função privada de conversão como autoridade — escolhida.

## Decisão

Criar `private.claim_partner_lead(uuid)` como SECURITY DEFINER com `search_path` fixo e autorização exclusiva para `admin` ou `comercial`. O Claim usa bloqueio de linha, atribui somente leads sem responsável, é idempotente para o mesmo usuário e rejeita outro responsável com `LEAD_ALREADY_ASSIGNED`.

Expor somente wrappers `public.*` SECURITY INVOKER para PostgREST autenticado. `anon` não recebe EXECUTE.

A conversão continua sendo decidida por `private.convert_partner_lead`; o wrapper público não altera suas regras de ownership, existência do restaurante, idempotência ou unicidade.

`created_by` permanece nulo nos leads originados da captura pública; Claim altera somente `assigned_to` e `updated_at`.

## Evidência

Em Staging foi comprovado E2E:

- primeiro Claim por comercial: sucesso;
- repetição pelo mesmo comercial: sucesso idempotente, sem regravação;
- tentativa por outro usuário autorizado: `LEAD_ALREADY_ASSIGNED`;
- conversão pelo comercial proprietário: sucesso;
- atribuição Meta/UTM permaneceu preservada;
- lead convertido para restaurante controlado sem criação de pedido artificial.

## Motivo

Preservar separação de responsabilidades, provenance da aquisição, RBAC e concorrência segura sem conceder autoridade comercial sobre Checkout, Orders, PricingEngine, PaymentService, Mercado Pago, Benefits ou estado financeiro.

## Impacto

O funil técnico passa a suportar:

`captura pública → lead sem responsável → Claim → responsável comercial → conversão → restaurant_id`.

## Riscos

- A UI comercial ainda precisa provar que consegue qualificar/atualizar leads públicos após Claim; a policy atual baseada em `created_by` pode impedir UPDATE direto.
- Primeiro pedido e receita reconhecida ainda não foram comprovados E2E a partir do lead convertido.
- Promoção para Production depende de revisão, migration versionada e teste controlado.

## Condição para revisão

Revisar se houver distribuição automática de leads, transferência entre vendedores, alteração de RBAC, mudança da regra de conversão ou autoridade financeira/comercial.

## Sistemas não alterados

Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago, Localix Benefits e cálculo financeiro não são alterados por esta decisão.
