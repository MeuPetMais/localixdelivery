# DEC-019 — Base estruturada da qualificação comercial

**Data:** 2026-10-02  
**Status:** Proposta técnica para validação.

## Problema

O CRM Comercial possui `fit_score` e `lead_class`, mas o preenchimento atual é manual. Para tornar a qualificação auditável, os dados objetivos que sustentam a avaliação precisam ser registrados separadamente antes de automatizar qualquer pontuação.

## Contexto

A tabela `partner_leads` já possui campos objetivos utilizáveis pela qualificação:

- `estimated_monthly_orders`;
- `is_decision_maker`;
- `current_channels`.

Há, porém, um conflito documental que impede codificar com segurança uma fórmula autoritativa de Fit Score: `docs/BUSINESS_DECISIONS.md` (BD-006) registra 600 pedidos/mês como elegibilidade mínima, enquanto materiais comerciais posteriores usados na operação consideraram referência de 200 pedidos/mês e uma matriz A/B/C diferente.

**Não foi possível provar.** qual dessas referências deve ser a regra autoritativa do novo cálculo automático.

## Opções consideradas

1. Automatizar agora o Fit Score usando uma das referências conflitantes.
2. Manter tudo manual.
3. Estruturar primeiro os dados objetivos e adiar apenas a fórmula automática até a decisão de negócio ser reconciliada.

## Decisão

Adotar a opção 3.

A Ficha Comercial passa a permitir o registro estruturado de volume estimado, confirmação de decisor e canais atuais. O `fit_score` existente não é recalculado automaticamente nesta etapa.

## Motivo

Evita cristalizar uma regra de qualificação potencialmente incorreta no código e preserva os dados necessários para automatização posterior.

## Impacto

- melhora a qualidade dos dados do CRM;
- não altera RLS, Claim, conversão ou atribuição;
- não concede autoridade sobre Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago ou Localix Benefits;
- prepara a próxima etapa de cálculo assistido/automático do Fit Score.

## Riscos

- Fit Score e classe A/B/C continuam podendo divergir dos dados objetivos até que a regra seja formalmente reconciliada.
- Canais atuais permanecem uma lista textual livre, sem taxonomia fechada.

## Condição para revisão

Revisar e substituir esta decisão quando a regra oficial de elegibilidade e os pesos da qualificação A/B/C forem formalmente aprovados e documentados.
