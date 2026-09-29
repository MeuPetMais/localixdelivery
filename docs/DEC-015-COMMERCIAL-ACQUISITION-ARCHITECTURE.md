# DEC-015 — Aquisição comercial pré-parceiro isolada

**Data:** 2026-09-29  
**Status:** Aprovada / comprovada em Production

## Problema
O Localix precisava captar e acompanhar oportunidades comerciais antes da existência de um parceiro/restaurant sem misturar esse estágio com o painel do parceiro, Growth, Admin ou fluxos financeiros.

## Contexto
A aquisição paga exige preservar a cadeia de origem do lead até a futura conversão em parceiro e, depois, permitir mensuração por pedidos e receita. Antes desta decisão não havia uma camada pré-parceiro adequada para esse vínculo.

## Opções consideradas
1. Reutilizar Partner Growth.
2. Reutilizar o painel Admin.
3. Criar uma camada comercial pré-parceiro dedicada.

## Decisão
Adotar uma camada dedicada de aquisição pré-parceiro:

`/comercial → autenticação → role comercial → partner-lead-capture → public.create_partner_lead_manual → private.create_partner_lead_manual → partner_leads`.

`partner_leads` preserva dados comerciais e de atribuição antes da criação do `restaurant_id`. A conversão para parceiro deve manter o vínculo histórico entre lead e restaurante.

O domínio comercial não recebe autoridade sobre Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago, Localix Benefits ou state machine financeira.

A receita atribuída ao parceiro deve ser derivada posteriormente da fonte financeira server-side autoritativa, e não de cálculos no frontend.

## Motivo
Separar responsabilidades, preservar rastreabilidade do funil e impedir que aquisição comercial amplie desnecessariamente a superfície dos domínios operacional, Growth e financeiro.

## Impacto
- nova área autenticada `/comercial`;
- estrutura `partner_leads`;
- Edge Function `partner-lead-capture`;
- RPC pública estreita delegando para autoridade privada;
- RBAC para `comercial`;
- base para UTM/Meta IDs/creative code e futura atribuição até pedidos/receita.

## Segurança
- captura manual exige usuário autenticado e papel autorizado;
- `anon` permanece sem acesso ao schema `private` e sem EXECUTE das RPCs de captura;
- `authenticated` possui apenas o acesso necessário para resolver/executar o contrato autorizado;
- RLS continua ativa em `partner_leads`.

## Evidência
E2E real em Production comprovou:
Browser → Edge Function → JWT → RPC pública → RPC privada/RBAC → `partner_leads`.

O teste criou um lead real de validação e os POSTs da Edge Function e RPC retornaram HTTP 200.

## Riscos
- futuras capturas server-side atribuídas a vendedores podem exigir revisão da policy de UPDATE baseada em `created_by`;
- captura pública de Meta/WhatsApp ainda não está implementada;
- definição exata de ativação e pedido válido deve continuar alinhada às regras oficiais;
- atribuição não deve confundir correlação de campanha com causalidade econômica.

## Condição para revisão
Revisar quando houver captura pública automatizada, mudança de RBAC comercial, novo modelo de atribuição ou alteração da autoridade financeira usada para receita atribuída.
