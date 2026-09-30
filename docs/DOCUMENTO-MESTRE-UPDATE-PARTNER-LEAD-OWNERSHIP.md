# Atualização do Documento Mestre — Ownership e conversão de leads públicos

**Data:** 2026-09-30  
**Origem:** DEC-017  
**Status:** atualização estrutural obrigatória

A aquisição comercial pré-parceiro passa a incluir explicitamente a etapa de ownership:

**Origem/campanha → captura pública → lead não atribuído → Claim → comercial responsável → qualificação → conversão → partner/restaurant → ativação → primeiro pedido → recorrência.**

## Regras

- Leads públicos nascem com `assigned_to = NULL` e `created_by = NULL`.
- Somente usuário autenticado com papel `comercial` ou `admin` pode executar Claim.
- O primeiro Claim válido atribui o lead ao usuário.
- Repetição pelo mesmo usuário é idempotente.
- Outro usuário não pode assumir silenciosamente um lead já atribuído.
- Leads `converted`, `lost` ou `disqualified` não são claimable.
- Claim não altera a provenance pública em `created_by`.
- Conversão por comercial continua exigindo ownership.
- Wrappers públicos são apenas interfaces PostgREST autenticadas; a autoridade permanece nas funções privadas com RBAC.
- A camada comercial não recebe autoridade sobre pedidos, preços, pagamentos, split, benefícios ou receita.
- Receita atribuída ao funil deverá usar fonte financeira autoritativa server-side, incluindo `order_pricing_snapshot.realized_platform_revenue`, nunca multiplicação nominal de pedidos por taxa.

## Evidência atual

Staging comprovou captura pública → Claim → proteção contra segundo responsável → conversão para restaurante, preservando Meta/UTM.

Ainda não foi comprovado E2E o trecho convertido → primeiro pedido válido → receita reconhecida atribuída à campanha.

## Gate

Tráfego pago permanece **NO-GO** até validação do encadeamento completo de atribuição e receita.
