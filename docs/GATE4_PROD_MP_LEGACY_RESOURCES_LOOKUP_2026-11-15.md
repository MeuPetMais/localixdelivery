# Gate 4 — Consulta final de rastreamento, recursos MP não identificados

**Data:** 2026-11-15. **Ambiente:** Localix Production `mvkfrwxgneqzvoabkaws`.
**Natureza:** leitura no Supabase e verificação de contrato público da API Mercado Pago. **Nenhum GET remoto com credencial foi realizado**, por inexistência de OAuth legítimo dos vendedores históricos.

## Evidência local
- **Recurso `123456`**, 2 notificações em 30/07/2026. Uma sem user_id; outra `user_id=455773879`, `live_mode=false`. Não há seller OAuth desse usuário em `mercado_pago_accounts`. É plausível que seja notificação de teste, mas não está provado.
- **Recurso `171452090634`**, 1 notificação em 31/07/2026, `user_id=1608601443`, `live_mode=true`. Esse seller não corresponde a nenhuma das contas OAuth conectadas.
- Ambos anteriores à primeira conexão atualmente registrada entre as duas contas OAuth existentes (17/08/2026); esse intervalo não prova inexistência de contas anteriores.
- Contagens para os 2 recursos: `webhook_events` 0, `payment_reconciliation` 0, `payment_split` 0, `financial_ledger.reference_id` 0; `mercado_pago_accounts` 2 (0 desconectadas, 0 com os dois seller IDs históricos).
- A presença de notificações no banco não prova pagamento recebido ou disponibilidade de recurso no escopo de outro vendedor.

## Limite técnico / segurança
A documentação oficial exige um Access Token autorizado para `GET /v1/payments/{id}`. Não podemos empregar OAuth de vendedores atualmente conectados para acessar um pagamento cujo vínculo pertence a outro seller, nem tomar `MP_ACCESS_TOKEN` global como fallback. Fonte: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/get-payment/get

**Não foi possível provar** o status remoto dos recursos `123456` ou `171452090634` com a evidência disponível. Nenhuma notificação foi marcada como processada e não houve reprocessamento, alteração de pedido, pagamento ou saldo.

## Encaminhamento mínimo ao suporte autorizado do MP
Solicitar rastreamento administrativo sem compartilhar tokens:
1. `resource_id=123456` — user_id histórico `455773879`, live_mode false, notificações `payment.updated` em 30/07/2026.
2. `resource_id=171452090634` — user_id histórico `1608601443`, live_mode true, notificação `payment.created` em 31/07/2026.
3. Confirmar se cada recurso existe, seller/ambiente, status, `external_reference`, valor, possibilidade de impacto financeiro; se a resposta exigir autorização do titular, indicar o procedimento.
4. Se comprovadamente sintéticos/irrelevantes, registrar fundamento antes do encerramento administrativo; caso sejam pagamentos válidos, reconciliar somente após prova de titularidade/status e aprovação de processo contábil idempotente.

**Gate Financeiro:** NO-GO; não executar tentativa de pagamento para resolver eventos antigos.

**Esta decisão deve atualizar o Documento Mestre** quando houver decisão formal sobre o encerramento histórico.
