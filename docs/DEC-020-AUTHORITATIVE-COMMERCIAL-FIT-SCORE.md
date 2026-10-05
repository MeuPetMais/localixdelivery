# DEC-020 — Fit Score autoritativo no backend

**Data:** 2026-10-05  
**Status:** Aprovada.

## Problema

Os 100 pontos do Fit Score comercial já estão formalizados, mas `fit_score` e `lead_class` ainda podiam ser editados manualmente no frontend. Isso permitia divergência entre os critérios objetivos da ficha e a classificação persistida.

## Contexto

A DEC-019 formalizou a matriz completa:

- volume mensal: até 25 pontos;
- decisor identificado: 15 pontos;
- base própria / WhatsApp: 15 pontos;
- clientes recorrentes: 15 pontos;
- interesse em canal próprio: 10 pontos;
- estrutura operacional: 10 pontos;
- marketing / Instagram ativo: 5 pontos;
- compromisso com divulgação: 5 pontos.

Classificação:

- A: 70–100;
- B: 50–69;
- C: abaixo de 50.

Os estados "não" e "não confirmado" valem 0 nos componentes booleanos.

## Opções consideradas

1. Continuar calculando e persistindo o score no frontend.
2. Criar uma RPC específica e exigir que todos os fluxos a utilizem.
3. Tornar o banco a autoridade, recalculando score e classe em trigger para qualquer INSERT ou UPDATE de `partner_leads`.

## Decisão

Adotar a opção 3.

Uma função de trigger no banco calcula `fit_score` exclusivamente a partir dos campos objetivos da DEC-019 e deriva `lead_class` do resultado.

O trigger roda em todo INSERT ou UPDATE de `partner_leads`. Assim, tentativas de gravar `fit_score` ou `lead_class` diretamente são sobrescritas pelo valor calculado a partir dos critérios objetivos.

O painel `/comercial` deixa de editar manualmente score e classe e passa a tratá-los como campos somente leitura.

A migration executa backfill dos leads existentes para eliminar divergências históricas entre critérios objetivos e score persistido.

## Motivo

O banco passa a ser a fonte de verdade da qualificação comercial, evitando divergência entre frontend, integrações e futuros fluxos de automação.

## Impacto

- `fit_score` e `lead_class` passam a ser derivados server-side;
- qualquer atualização dos critérios objetivos recalcula score e classe na mesma transação;
- classificação A/B/C fica consistente com o score persistido;
- não altera Claim, atribuição, proveniência ou regras de conversão;
- não altera Checkout, Pedidos, OrderService, PricingEngine, PaymentService, Mercado Pago ou Localix Benefits;
- leads existentes são recalculados com os dados objetivos atualmente disponíveis.

## Riscos

- critérios ainda não preenchidos valem 0, portanto leads incompletamente qualificados podem aparecer temporariamente como classe C;
- o backfill substitui scores manuais anteriores pela matriz objetiva vigente;
- qualquer alteração futura da matriz exige migration coordenada da função autoritativa e atualização documental.

## Rollback

Remover o trigger `trg_partner_leads_apply_fit_score` restaura a possibilidade técnica de edição manual, mas não recupera automaticamente scores manuais substituídos pelo backfill. Um rollback de regra deve ser tratado como decisão explícita e acompanhado de plano de dados.

## Condição para revisão

Revisar quando a matriz de pontuação, os limites A/B/C ou a política para critérios não confirmados mudar.
