# Gate 4 — Investigação dirigida de notificações MP restantes e divergência #1079
**Data:** 2026-11-15. **Ambiente:** Localix Production `mvkfrwxgneqzvoabkaws`. **Execução:** somente consultas de leitura e documentação no branch Draft. Nenhum evento reprocessado ou atualizado.

## Correção do inventário dos cinco eventos `no_access_token`

A análise anterior considerava **5 notificações sem vínculo local**, mas há só **3 IDs remotos distintos**:

| resource_id | Nº de notificações | Perfil de origem e próximos passos |
|---|---:|---|
| `174057974773` | 2 | Mesmo pagamento remoto já reconciliado em 15/11: `rejected`, `cc_rejected_high_risk`, vendedor `3625464467`, pedido Localix #1079 cancelado. Uma notificação usa formato `resource/topic` sem `user_id`; a outra usa `data.id` com vendedor identificado. Ambas permanecem `processed=false` por política de não mutação. |
| `123456` | 2 | Uma notificação sem vendedor; outra com `user_id=455773879`, `live_mode=false`. Sem conta OAuth desse vendedor entre as duas atualmente conectadas em Production. ID curto compatível com exemplo/sintético, mas **não provado**. Não consultar usando credencial de terceiro. |
| `171452090634` | 1 | `user_id=1608601443`, `live_mode=true`. Esse vendedor não consta entre conexões OAuth atuais; sem pedido nem pagamento local por ID do recurso. Não consultar usando credencial de terceiro. |

Das cinco notificações, uma já tinha sido reconciliada; **a segunda do mesmo pagamento também pode ser correlacionada à evidência externa pelo resource_id idêntico**. Portanto restam **2 recursos remotos distintos** com situação desconhecida, representados por **3 notificações**.

Além desses cinco eventos, outros 14 `missing_mp_user_id` foram classificados previamente: 13 cancelados, 1 rejeitado, todos com estados locais finais. O banco ainda preserva os **19** registros não processados, sem marcação administrativa.

## Diferença de R$0,99 no pedido #1079

- `orders.id=7126fec9-aed1-4d77-aee3-db886c448a4f`, `order_number=1079`, método cartão, `status=cancelado`, total **5.99**, platform_fee **0.99**.
- Snapshot `order_pricing_snapshot`: `subtotal=5.00`, `delivery_fee=0.00`, `platform_fee=0.99`, `customer_total=5.99`, `service_fee_payer=customer`, gateway_fee 0, desconto 0.
- `order_payment.transaction_amount=5.99`, `status=CANCELLED`, último erro de cancelamento pelo consumidor antes do pagamento.
- Gateway Mercado Pago remoto `payment_id=174057974773`: `amount=5.00`, `status=rejected`, `status_detail=cc_rejected_high_risk`, referência externa equivalente ao ID do pedido.
- O valor enviado à API foi numericamente igual ao subtotal e não ao `customer_total` autoritativo. **Fato:** divergência de R$ 0,99 entre valor do gateway e valor do checkout/snapshot.
- **Hipótese (não provada):** taxa de plataforma não incluída no `transaction_amount` enviado no fluxo histórico de cartão.
- Código `mp-payment-intent` atualmente implantado (v13) tem caminhos que usam `order_pricing_snapshot.customer_total` e definem `application_fee`; não basta para concluir que esse era o código/payload em 21/08/2026. Não foi recuperado payload integral histórico da requisição. **Não foi possível provar a causa raiz**.
- `payment_reconciliation` e `payment_split`: nenhuma linha para o pedido/pagamento consultados; `financial_ledger`: sem lançamento correspondente. Transação externa rejeitada, portanto nenhuma cobrança aprovada demonstrada neste episódio.

## Riscos e decisões

**Fato:** 3 eventos ainda sem confirmação remota, organizados em 2 recursos remotos não identificados por OAuth atual. **Não foi possível provar** o efeito financeiro de `171452090634`, nem que `123456` é definitivamente sintético.

**Recomendação:**
1. Preservar os eventos, bloquear retry automático e não forçar `processed=true`.
2. Para `171452090634`, recuperar vínculo legítimo do seller antigo `1608601443` ou solicitar rastreamento ao MP com seu User ID e resource ID. Sem credencial atual do vendedor, não executar busca autenticada indevida.
3. Para `123456`, recuperar evidência histórica/externa ou resposta de rastreamento MP antes de encerrar como fictício.
4. Verificar retrospectivamente a versão implantada do fluxo de cartão em 21/08, confrontar com snapshot e testes com `customer_total`, e somente preparar correção isolada se a divergência for reproduzível; sem criar nova cobrança.
5. Avaliar decisão formal `DEC-023` para encerramento administrativo *com trilha de evidência e estado contábil neutro*, após demais confirmações. Nenhuma migration/merge/produção autorizados nesta etapa.

**Gate Financeiro:** NO-GO. **Esta decisão deve atualizar o Documento Mestre**, após aprovação.
