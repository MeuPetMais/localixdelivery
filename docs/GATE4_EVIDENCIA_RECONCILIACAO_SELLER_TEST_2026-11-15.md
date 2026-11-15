# Gate 4 — Evidência de reconciliação OAuth TEST do pedido #1001

**Data:** 2026-11-15  
**Status:** Consulta externa concluída no escopo do vendedor; Gate Financeiro **NO-GO**.

## Evidência comunicada pelo operador
O operador executou o cliente local autenticado da função `gate4-mp-reconcile` e forneceu somente o resultado sanitizado:

- `LOGIN TEST PASS — proprietário confirmado`
- `conclusion=NONE_FOUND_IN_THIS_SELLER_SCOPE`
- `search_scope=seller_oauth_test_only`
- `total=0`
- `complete=true`
- `retry_allowed=false`

Essa evidência significa **zero pagamentos retornados pela busca na conta OAuth TEST consultada**. Não comprova ausência absoluta no Mercado Pago nem autoriza repetir PIX. Não foram informados IDs de pagamentos porque não houve resultados.

## Evidência server-side independente (somente leitura)
Consulta ao banco isolado `gvozcqyjhogmvebrwzap`, `mercado_pago_accounts`, para restaurante fictício `1e271104-299c-44b6-98f5-d8effaef3f0a`, sem ler segredos:

- `connected=true`, `live_mode=false`, `mp_user_id=3845624814`
- `connected_at=2026-11-15 15:16:09.353+00`, anterior à tentativa PIX de 17:07:42.900 UTC
- token presente e criptografado (`v1:`)
- scope contém `payments`
- JSON de resposta OAuth salvo não possui campos `client_id` ou `application_id` capazes de provar o vínculo à aplicação MP.

A criação PIX anterior enviou `transaction_amount=30.99`, `application_fee=0.99` e `external_reference=5d047914-5ae0-4bab-9549-465e5d376317`, mas recebeu `user_allowed_only_in_test`. Pedido local permanece `aguardando_pagamento`, sem `payment_id`.

## Conclusão e limite
1. A conta vendedor TEST existe e é a mesma armazenada no banco. OAuth registrado antes da tentativa.
2. **Não foi possível provar** a identidade da aplicação MP (`MP_APP_ID`) associada ao token OAuth e à requisição original, nem a relação real do comprador TEST usada no PIX.
3. A busca vazia é restrita ao contexto do seller consultado. Nenhum pagamento deve ser repetido com base somente nesse resultado.
4. DEC-022 segue em vigor. Não reabrir auditorias gerais nem alterar PricingEngine, ledger, migrations ou Production/Staging.

## Próximo gate estritamente necessário
Conferir o application ID no ambiente isolado usando método seguro que não exponha secrets e comparar com aplicação Mercado Pago `8897984652446514`; confirmar contrato de comprador TEST, vendedor OAuth e Pix split. Caso comprovado, obter autorização para **uma única rodada E2E** seguindo DEC-022 e DEC-021.

## Retirada do diagnóstico
Após capturar esta evidência, desativar `gate4-mp-reconcile` no sandbox, mantendo histórico de deploy para auditoria. Isso não altera pagamentos existentes.

**Esta decisão deve atualizar o Documento Mestre.**
