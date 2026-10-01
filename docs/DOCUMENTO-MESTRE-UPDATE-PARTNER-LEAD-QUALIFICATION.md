# Atualização do Documento Mestre — Qualificação de leads públicos

**Data:** 2026-10-01  
**Origem:** DEC-017 + DEC-018

O fluxo comercial passa a considerar:

**Origem/campanha → captura pública → lead não atribuído → Claim → comercial responsável → qualificação → conversão → partner/restaurant → ativação → primeiro pedido → recorrência**

## Regras de ownership e qualificação

- Leads públicos preservam `created_by = NULL`.
- O Claim define `assigned_to` sem reescrever a proveniência.
- O comercial responsável pode qualificar e atualizar o lead não convertido usando o ownership de `assigned_to`.
- Outro comercial não pode atualizar lead que não esteja atribuído a ele.
- Campos de aquisição/proveniência não podem ser reescritos por usuário autenticado não-admin.
- Conversão continua submetida ao fluxo controlado da DEC-017.
- A área comercial não recebe autoridade sobre pedidos, preços, pagamentos, split, benefícios ou receita.

## Evidência

Staging: PASS TÉCNICO CONTROLADO para qualificação do próprio lead público assumido, bloqueio de atualização por outro comercial e proteção da proveniência.

Production: promoção desta alteração ainda pendente.

A atribuição financeira posterior continua usando a receita autoritativa server-side, incluindo `order_pricing_snapshot.realized_platform_revenue`, e não multiplicação nominal de pedidos por taxa.

Paid Media permanece NO-GO até a cadeia completa de primeiro pedido e receita reconhecida estar validada.
