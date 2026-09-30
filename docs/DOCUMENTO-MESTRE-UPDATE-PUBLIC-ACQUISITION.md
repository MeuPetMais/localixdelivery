# Atualização do Documento Mestre — Captura pública de aquisição

**Data:** 2026-09-30  
**Origem:** DEC-016 — Captura pública de aquisição pré-parceiro  
**Status:** atualização estrutural obrigatória

## Atualização

A arquitetura comercial pré-parceiro passa a admitir captura pública controlada para campanhas e landing pages.

Fluxo oficial:

`Origem/Campanha → endpoint público de aquisição → partner_leads → qualificação → demonstração → adesão → partner/restaurant → ativação → primeiro pedido → recorrência`.

O endpoint público não concede escrita anônima direta em `partner_leads`. A entrada passa por Edge Function com validação de origem/payload, honeypot, rate limit e RPC idempotente restrito ao contexto server-side.

A chave atual de idempotência é `source + external_ref`. Repetições do mesmo par retornam o registro existente sem atualizar a atribuição original, preservando First Touch.

Leads públicos entram sem vendedor atribuído e sem usuário criador; a atribuição comercial ocorre posteriormente dentro do fluxo autorizado.

## Limites de autoridade

A camada de aquisição não possui autoridade sobre Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago, Localix Benefits ou state machine financeira. Após a conversão do lead, pedidos e receita atribuída devem ser obtidos das fontes transacionais e financeiras autoritativas server-side.

## Métrica

A North Star de mídia continua sendo **CAC por Parceiro Ativo**, complementada por CAC até primeiro pedido, pedidos D30 e receita Localix reconhecida. CPL isolado não define sucesso.

## Gate operacional

A existência do endpoint não autoriza ativação de mídia paga. Paid media permanece condicionada à validação completa do caminho de atribuição, segurança, privacidade/LGPD, observabilidade e promoção controlada a Production.

## Riscos registrados

A robustez contra spoofing do header de IP não foi comprovada; `external_ref` e `source` ainda são entradas públicas; e honeypot/rate limit podem precisar de reforço conforme abuso observado. **Não foi possível provar** proteção suficiente contra todos os padrões de automação maliciosa.
