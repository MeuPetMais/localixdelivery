# Atualização do Documento Mestre — Aquisição Comercial e Atribuição

**Data:** 2026-09-29  
**Origem:** DEC-015  
**Status:** Atualização estrutural obrigatória

## Trecho recomendado para incorporar ao Documento Mestre

### Aquisição comercial pré-parceiro

O Localix passa a possuir uma camada comercial dedicada ao período anterior à criação do parceiro.

A jornada estrutural é:

**Origem/campanha → lead → qualificação → demonstração → adesão → partner/restaurant → ativação → primeiro pedido → recorrência.**

A área autenticada `/comercial` é separada do painel do parceiro, Partner Growth e Admin. O acesso operacional é controlado por RBAC, incluindo o papel `comercial`.

`partner_leads` é a fonte de registro da oportunidade pré-parceiro e deve preservar, quando disponíveis, origem, medium, UTMs, identificadores Meta, creative code, responsável comercial, Fit Score, estágio e vínculo posterior com `restaurant_id`.

A captura autenticada utiliza uma Edge Function dedicada e contrato RPC restrito. O schema privado não é exposto anonimamente.

A aquisição comercial não possui autoridade sobre Checkout, Orders, OrderService, PricingEngine, PaymentService, Mercado Pago, Localix Benefits ou state machine financeira.

Após a conversão, pedidos e receita devem ser medidos a partir das fontes server-side autoritativas. Receita Localix atribuída não pode ser inferida apenas por quantidade de pedidos multiplicada por uma taxa nominal.

### North Star de aquisição

A principal métrica de mídia paga é **CAC por Parceiro Ativo**, complementada por:
- CAC por primeiro pedido;
- taxa lead → qualificado;
- taxa qualificado → demonstração;
- taxa demonstração → adesão;
- taxa adesão → ativação;
- taxa ativação → primeiro pedido;
- pedidos D30/D60/D90;
- receita Localix atribuída;
- retenção do parceiro.

### Estado comprovado em 2026-09-29

A captura manual autenticada em Production passou em E2E real:

**Browser → Edge Function → JWT → RPC pública → RPC privada/RBAC → partner_leads.**

A correção de privilégio mínimo do schema privado foi validada em Production e versionada no repositório.

### Limitações vigentes

- Captura pública automatizada de Meta Ads/WhatsApp ainda não foi implementada.
- A disponibilidade exata de metadados de atribuição do WhatsApp não foi possível provar.
- A definição operacional exata de “parceiro ativado” deve ser confirmada antes de automatizar o KPI.
- Pedido válido deve seguir a state machine oficial de pedidos.
- Receita atribuída deve usar a fonte financeira server-side autoritativa.
- Tráfego pago permanece condicionado à validação da cadeia completa de atribuição.
