# Gate 4 — Parecer documental sobre PIX com Split 1:1 (2026-11-15)

**Status:** escopo geral de suporte esclarecido; erro de sandbox `user_allowed_only_in_test` ainda **não comprovado**; Gate Financeiro **NO-GO**.

## Evidências oficiais

1. A documentação do Mercado Pago para Split 1:1 com Checkout Transparente instrui a usar o OAuth do vendedor e `application_fee` no POST `/v1/payments`: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
2. Material oficial publicado pelo Mercado Pago informa compatibilidade geral do split com Pix, cartões e boleto no Checkout Transparente, condicionado aos produtos e contas elegíveis: https://www.mercadopago.com.br/blog/split-pagamento-marketplace-servicos-beleza
3. A documentação de migração Payments → Orders destaca que `application_fee` **não possui equivalente documentado na Orders API** e orienta evitar migração de marketplace/split sem validação do fornecedor: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders
4. As instruções de contas de teste do Split 1:1 descrevem User ID, **username**, senha e código de verificação, mas não comprovam automaticamente um e-mail efetivo da conta compradora: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/additional-content/your-integrations/test/accounts

## Evidência interna anterior preservada
- `MP_APP_ID: MATCH` comparado ao aplicativo `8897984652446514`; vendedor OAuth TEST `3845624814` conectado antes da tentativa; comprador TEST `3845624812` existe no Brasil.
- Pedido #1001, `external_reference=5d047914-5ae0-4bab-9549-465e5d376317`, `transaction_amount=30.99`, `application_fee=0.99`.
- Retorno remoto `user_allowed_only_in_test`, sem classificação causal inequívoca pelo gateway.
- Busca de pagamentos `NONE_FOUND_IN_THIS_SELLER_SCOPE`, `total=0`, `complete=true`, `retry_allowed=false`. Ausência no escopo consultado **não autoriza repetir**.

## Conclusão
**Fato:** o produto Split 1:1 é descrito como compatível com Pix e o caminho `/v1/payments` + OAuth + `application_fee` segue o contrato documentado em termos gerais.

**Não foi possível provar:** que a aplicação e contas específicas permitem simular o mesmo cenário usando o token OAuth TEST e o e-mail do comprador presentes na tentativa, nem a causa exclusiva de `user_allowed_only_in_test`.

**Recomendação:** não trocar para Orders API, não relaxar validação de identidade/token nem criar e-mail presumido. Encaminhar ao suporte de integração do Mercado Pago os IDs públicos, o timestamp, o erro sanitizado e o contrato de teste, solicitando: (a) confirmação de suporte a Pix com split 1:1 **em TEST** por OAuth do vendedor; (b) formato ou origem correta do `payer.email`; (c) interpretação e correção de `user_allowed_only_in_test`; (d) confirmação de vínculo do OAuth ao aplicativo; (e) orientação sobre busca de cobrança e reuso seguro de idempotência.

**Ação posterior:** uma única rodada E2E autorizada após esclarecimento e reconciliação, registrando webhook/split/ledger. Manter Gate NO-GO.

**Esta decisão deve atualizar o Documento Mestre.**
