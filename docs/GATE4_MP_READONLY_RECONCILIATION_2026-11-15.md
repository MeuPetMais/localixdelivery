# Gate 4 — Reconciliação MP somente leitura (preparação)

Data: 2026-11-15. **Estado: preparada em GitHub, não implantada e não executada contra Mercado Pago. Gate Financeiro NO-GO.**

## Escopo
Função `gate4-mp-reconcile`, restrita a:
- Supabase `gvozcqyjhogmvebrwzap`, `MP_ENVIRONMENT=test`;
- vendedor OAuth TEST `3845624814`, loja fictícia fechada `1e271104-299c-44b6-98f5-d8effaef3f0a`;
- pedido sintético #1001 `5d047914-5ae0-4bab-9549-465e5d376317`, R$30,99;
- chamada POST **ao endpoint da função** autenticada por JWT do owner (com `verify_jwt=true`), que faz **apenas GET** para `https://api.mercadopago.com/v1/payments/search`, usando OAuth TEST criptografado em repouso;
- sem endpoint genérico, sem corpo parametrizável, sem SQL write, sem novo pagamento, sem expor token ou payload bruto.

O resultado do gateway é sanitizado; `complete=false` se paginação exceder 200 itens ou ficar inconsistente. Mesmo com `total=0` e `complete=true`, a conclusão permanece **somente no escopo do vendedor OAuth consultado**, sem autorizar replay ou pagamento. `retry_allowed=false` sempre.

## Pré-deploy (requer autorização específica posterior)
1. Revisar PR, autenticação/RLS, contrato MP, testes e código compartilhado.
2. Confirmar que `SUPABASE_URL` e `MP_ENVIRONMENT` apontam ao sandbox, e `MP_TEST_SELLER_USER_ID` ao vendedor correto; `MP_TOKEN_ENC_KEY` deve existir no sandbox via secret manager, não no chat.
3. Confirmar `verify_jwt=true` no deploy; não usar `--no-verify-jwt`.
4. Implantar **somente no sandbox** e chamar uma única vez com JWT real do owner por ferramenta confiável, sem imprimir JWT em logs.
5. Comparar `results` com a tentativa original; em caso de gateway 4xx/5xx, resposta incompleta, outro ambiente ou seller diferente, manter bloqueio.
6. Retirar a função após produzir a evidência; nenhum acionamento de cobrança é autorizado por esse procedimento.

## Rollback
Remover somente a função `gate4-mp-reconcile` do sandbox após reconciliação; não alterar `mp-payment-intent`, webhook, ledger, migrations nem dados contábeis.

## Limitações
O resultado vazio do `GET /v1/payments/search` não prova inexistência absoluta da transação em outros contextos/contas, nem garante exclusão de propagação atrasada. Não confirma uso de mesma application/OAuth no momento da tentativa anterior. GO só com evidências da DEC-022 e DEC-021.

**Esta decisão deve atualizar o Documento Mestre** quando aprovada a evidência final.
