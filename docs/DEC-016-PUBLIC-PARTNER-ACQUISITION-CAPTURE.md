# DEC-016 — Captura pública de aquisição pré-parceiro

**Data:** 2026-09-30  
**Status:** Aprovada para implementação controlada; validada em Staging; promoção a Production pendente de gate final.

## Problema

A DEC-015 isolou a aquisição comercial pré-parceiro em `partner_leads`, porém o fluxo inicial dependia de usuário autenticado com papel `comercial`. Campanhas pagas e landing pages precisam registrar leads antes de autenticação sem conceder acesso público direto à tabela ou aos RPCs privilegiados.

## Contexto

O funil comercial precisa preservar origem, campanha, criativo e identificadores Meta até a conversão em parceiro. `partner_leads` permanece a camada pré-parceiro. Checkout, pedidos e finanças continuam fora da autoridade deste fluxo.

## Opções consideradas

1. Conceder INSERT anônimo diretamente em `partner_leads`: rejeitada por ampliar a superfície de escrita pública e contornar controles server-side.
2. Reutilizar o endpoint autenticado: rejeitada porque visitantes de campanhas ainda não possuem sessão Localix.
3. Edge Function pública com privilégios server-side mínimos, validação, antiabuso e RPC idempotente: escolhida.

## Decisão

Criar o endpoint público `partner-lead-public-capture`, com `verify_jwt = false`, sem expor `service_role` ao navegador. A Edge Function valida origem e payload, aplica honeypot e rate limit e chama wrappers/RPCs executáveis somente por `service_role`.

A idempotência usa `(source, external_ref)`. Se o mesmo par já existir, o registro existente é retornado sem UPDATE, preservando o First Touch. Leads públicos entram com `status = new`, `assigned_to = null` e `created_by = null`.

Origens permitidas ficam restritas ao domínio de Production e ao padrão controlado de previews do projeto Staging da Vercel, evitando dependência de um único hash de preview.

## Motivo

Permitir aquisição pública mensurável sem transformar `partner_leads` em uma tabela de escrita anônima e sem misturar aquisição com as autoridades transacional e financeira.

## Impacto

Fluxo resultante:

`Campanha/Landing → Edge pública → rate limit → RPC service-role-only → partner_leads → qualificação comercial → conversão em restaurant/partner`.

Não altera Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago, Localix Benefits nem a state machine financeira. Receita atribuída após conversão deve continuar vindo de fonte financeira autoritativa server-side.

## Riscos

- `external_ref` é recebido do cliente; variações deliberadas podem contornar a idempotência, embora o rate limit reduza abuso.
- `source` também é recebido do cliente e participa da chave de idempotência; mudança de source com o mesmo external_ref pode gerar outro lead.
- A confiabilidade do IP obtido por headers da infraestrutura para resistência a spoofing não foi provada. **Não foi possível provar.**
- Honeypot + rate limit não equivalem a CAPTCHA/WAF; proteção adicional poderá ser necessária conforme volume e abuso real.
- A captura pública aumenta obrigações de privacidade/LGPD na landing e no tratamento dos dados do lead.

## Evidência

Em Staging foi comprovado browser → Edge → rate limit → RPC → `partner_leads`, com HTTP 200, preservação de UTMs/Meta IDs e repetição do mesmo `source + external_ref` sem criar segundo registro nem alterar timestamps. O CI do PR de versionamento também passou antes do ajuste final de CORS; o gate deve ser reexecutado após esta alteração.

## Condição para revisão

Revisar esta decisão se houver mudança na chave de idempotência, novo provedor de mídia/formulário, CAPTCHA/WAF, alteração de CORS, escrita pública direta, mudança de RBAC, ou qualquer alteração que dê ao fluxo de aquisição autoridade sobre pedidos, preços, pagamentos ou receita.
