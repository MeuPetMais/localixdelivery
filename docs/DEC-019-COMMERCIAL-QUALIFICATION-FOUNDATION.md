# DEC-019 — Base estruturada da qualificação comercial

**Data:** 2026-10-02  
**Status:** Aprovada.

## Problema

O CRM Comercial possui `fit_score` e `lead_class`, mas o preenchimento atual é manual. Para tornar a qualificação auditável, os dados objetivos que sustentam a avaliação precisam ser registrados separadamente antes de automatizar qualquer pontuação.

## Contexto

A tabela `partner_leads` já possui campos objetivos utilizáveis pela qualificação:

- `estimated_monthly_orders`;
- `is_decision_maker`;
- `current_channels`.

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

Com volume (25) + decisor (15) + base própria/WhatsApp (15), o CRM passa a exibir uma pontuação parcial formalizada de até 55 pontos.

O `fit_score` total continua sem recálculo automático até que os demais componentes sejam formalizados.

## Motivo

Evita cristalizar uma regra de qualificação potencialmente incorreta no código e preserva os dados necessários para automatização posterior.

## Impacto

- melhora a qualidade dos dados do CRM;
- não altera RLS, Claim, conversão ou atribuição;
- não concede autoridade sobre Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago ou Localix Benefits;
- prepara a próxima etapa de cálculo assistido/automático do Fit Score.

## Riscos

- Fit Score e classe A/B/C ainda podem divergir dos dados objetivos porque apenas 55 dos 100 pontos estão formalizados.
- Canais atuais permanecem uma lista textual livre, sem taxonomia fechada.
- O frontend exibe a pontuação parcial de volume, mas não a grava como se fosse o Fit Score total.

## Condição para revisão

Revisar quando os demais componentes do Fit Score forem formalmente aprovados, quando houver mudança das faixas de volume ou quando o cálculo total passar a ser autoritativo no backend.
