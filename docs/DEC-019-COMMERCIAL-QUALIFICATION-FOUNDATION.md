# DEC-019 — Base estruturada da qualificação comercial

**Data:** 2026-10-02  
**Status:** Aprovada.

## Problema

O CRM Comercial possui `fit_score` e `lead_class`, mas o preenchimento atual é manual. Para tornar a qualificação auditável, os dados objetivos que sustentam a avaliação precisam ser registrados separadamente antes de automatizar qualquer pontuação.

## Contexto

A tabela `partner_leads` já possui campos objetivos utilizáveis pela qualificação:

- `estimated_monthly_orders`;
- `is_decision_maker`;
- `current_channels`;
- `has_structured_operation`;
- `has_active_marketing`;
- `committed_to_promotion`.

O conflito documental sobre volume foi resolvido em 2026-10-02 com uma regra ascendente, usando 150 pedidos/mês como início da pontuação e 600+ como faixa máxima.

## Opções consideradas

1. Automatizar agora o Fit Score usando uma das referências conflitantes.
2. Manter tudo manual.
3. Estruturar primeiro os dados objetivos e adiar apenas a fórmula automática até a decisão de negócio ser reconciliada.

## Decisão

A Ficha Comercial registra volume estimado, confirmação de decisor e canais atuais.

O componente **Volume mensal** do Fit Score vale até 25 pontos e segue a regra:

| Pedidos estimados/mês | Pontos |
| ---: | ---: |
| abaixo de 150 | 0 |
| 150–249 | 5 |
| 250–349 | 10 |
| 350–449 | 15 |
| 450–599 | 20 |
| 600 ou mais | 25 |

A regra é ascendente. Estar abaixo de 150 não desqualifica automaticamente o lead; apenas atribui 0 ponto neste componente.

O componente **Decisor identificado** vale 15 pontos: contato confirmado como decisor recebe 15 pontos; "não" ou "não confirmado" recebem 0. A ausência de confirmação não desqualifica automaticamente o lead.

O componente **Base própria / WhatsApp** vale 15 pontos: "sim" recebe 15 pontos; "não" ou "não confirmado" recebem 0. A ausência de base própria não desqualifica automaticamente o lead.

O componente **Clientes recorrentes** vale 15 pontos: "sim" recebe 15 pontos; "não" ou "não confirmado" recebem 0. A ausência de recorrência não desqualifica automaticamente o lead.

O componente **Interesse em canal próprio** vale 10 pontos: "sim" recebe 10 pontos; "não" ou "não confirmado" recebem 0. A ausência de interesse não desqualifica automaticamente o lead.

O componente **Estrutura operacional** vale 10 pontos: "sim" recebe 10 pontos; "não" ou "não confirmado" recebem 0.

O componente **Marketing / Instagram ativo** vale 5 pontos: "sim" recebe 5 pontos; "não" ou "não confirmado" recebem 0.

O componente **Compromisso com divulgação** vale 5 pontos: "sim" recebe 5 pontos; "não" ou "não confirmado" recebem 0.

Com isso, os componentes do Fit Score passam a totalizar 100 pontos: volume (25) + decisor (15) + base própria/WhatsApp (15) + clientes recorrentes (15) + interesse em canal próprio (10) + estrutura operacional (10) + marketing ativo (5) + compromisso com divulgação (5).

O `fit_score` total permanece manual nesta etapa. A automatização do valor total deverá ser feita em etapa própria, com cálculo autoritativo no backend e classificação A/B/C derivada do score.

## Motivo

Evita cristalizar uma regra de qualificação potencialmente incorreta no código e preserva os dados necessários para automatização posterior.

## Impacto

- melhora a qualidade dos dados do CRM;
- não altera RLS, Claim, conversão ou atribuição;
- não concede autoridade sobre Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago ou Localix Benefits;
- prepara a próxima etapa de cálculo assistido/automático do Fit Score.

## Riscos

- Fit Score e classe A/B/C ainda podem divergir dos dados objetivos porque o total permanece manual apesar de os 100 pontos já estarem formalizados.
- Canais atuais permanecem uma lista textual livre, sem taxonomia fechada.
- O frontend exibe a pontuação parcial de volume, mas não a grava como se fosse o Fit Score total.

## Condição para revisão

Revisar quando houver mudança nas regras de pontuação ou quando o cálculo total passar a ser autoritativo no backend.
