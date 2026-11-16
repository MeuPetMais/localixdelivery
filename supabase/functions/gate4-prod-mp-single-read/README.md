# Consulta restrita — 1 pagamento PROD (Gate Financeiro)

**Estado:** código preparado no GitHub para revisão, **não implantado**, sem consulta ao gateway ainda.

## Escopo
- Somente `GET /v1/payments/174057974773` no Mercado Pago sob OAuth LIVE do vendedor `3625464467`, recuperado e descriptografado server-side a partir da conexão do restaurante `3714616d-7b69-4118-8ac3-57076a70212a`.
- Exige `verify_jwt=true` no deploy e **JWT do proprietário** do restaurante; valida proprietário novamente no servidor.
- Rejeita qualquer projeto diferente de `mvkfrwxgneqzvoabkaws` (Localix Production).
- Revalida antes do fetch que evento `6ae21bfe-20df-4763-9311-bd05fdb40e1a` ainda está pendente com `no_access_token` e vendedor informado igual ao OAuth ativo.
- Sem fallback de token global; exige token criptografado e modo LIVE. Valida que o retorno do gateway pertence ao mesmo `payment_id` e `collector_id`.
- Resposta reduzida a status, moeda, valor, hora e referência externa; sem expor segredo, comprador ou payload integral.
- Nenhum insert, update, delete, chamada para criação de pagamento, retry ou alteração de pedido/ledger.

## Gates antes do deploy
1. Revisar fonte, dependências e autenticação; executar testes negativos para usuário não proprietário, JWT ausente, vendedor divergente, payload do evento alterado, token não LIVE, pagamento remoto divergente e HTTP de erro.
2. Confirmar a autorização **específica para criar Edge Function temporária em Production**. Esta autorização não é concedida apenas pela permissão genérica de consulta.
3. Deploy exclusivamente da função `gate4-prod-mp-single-read` com `verify_jwt=true`, sem alterar funções existentes.
4. Fazer UMA consulta autenticada; registrar apenas resposta sanitizada; aposentar imediatamente a função com HTTP 410 e verificar o estado.
5. Se a função não conseguir executar, declarar inconclusivo. Não desbloquear reprocessamento nem pagar novamente.

**Nunca inserir tokens em issue/PR/chat/log.**
