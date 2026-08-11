# Mercado Pago staging financeiro

Este roteiro prepara uma validacao financeira controlada sem reutilizar producao.

## Ambientes obrigatorios

Cada runtime deve declarar explicitamente:

- `LOCALIX_ENV`: `development`, `staging` ou `production`.
- `LOCALIX_SUPABASE_ENVIRONMENT`: mesmo valor de `LOCALIX_ENV`.
- `MP_ENVIRONMENT`: `sandbox` para `development`/`staging`, `production` apenas para producao.
- `LOCALIX_SUPABASE_FUNCTIONS_BASE_URL`: base publica das Edge Functions do ambiente, sem barra final.
- `APP_BASE_URL`: base publica do frontend do ambiente.

Em `staging`, configure tambem referencias nao secretas de producao:

- `PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL`
- `PRODUCTION_APP_BASE_URL`

Se staging apontar para as referencias de producao, as funcoes Mercado Pago falham fechadas com
`mercadopago_environment_not_configured`.

## Secrets server-side

Configurar somente no runtime server-side/Supabase Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MP_APP_ID`
- `MP_CLIENT_SECRET`
- `MP_WEBHOOK_SECRET`
- `MP_TOKEN_ENCRYPTION_KEY`

Nao preencher secrets reais em arquivos versionados.

## Checklist Supabase staging

- Criar um projeto Supabase separado para staging.
- Aplicar todas as migrations atuais.
- Publicar as Edge Functions `mp-oauth`, `mp-oauth-callback`, `mp-payment-intent`, `mp-webhook`, `mp-audit-payment` e `mp-audit-preference`.
- Configurar Auth proprio do projeto staging.
- Configurar banco proprio, sem conexao com o banco de producao.
- Configurar secrets proprios de staging.
- Definir `LOCALIX_SUPABASE_FUNCTIONS_BASE_URL=https://dnotmvbhuqujvqdtgzav.supabase.co/functions/v1`.
- Definir `LOCALIX_SUPABASE_ENVIRONMENT=staging`.
- Definir `LOCALIX_ENV=staging`.
- Definir `MP_ENVIRONMENT=sandbox`.
- Definir `PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL=https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1`.
- Confirmar que `PRODUCTION_LOCALIX_SUPABASE_FUNCTIONS_BASE_URL` nao e igual a URL de staging.

## Checklist Mercado Pago staging/test

Conforme a documentacao oficial do Mercado Pago, as credenciais de teste ficam separadas das credenciais
de producao, webhooks podem ter URL de teste, e OAuth exige `redirect_uri` estatico igual ao cadastrado
na aplicacao.

- Criar uma aplicacao Mercado Pago exclusiva para staging/test.
- Usar App ID e Client Secret proprios dessa aplicacao.
- Cadastrar redirect URI exatamente como:
  `https://<staging-project-ref>.supabase.co/functions/v1/mp-oauth-callback`
- Cadastrar webhook URL exatamente como:
  `https://<staging-project-ref>.supabase.co/functions/v1/mp-webhook`
- Configurar `MP_WEBHOOK_SECRET` proprio do webhook de staging.
- Criar vendedores/usuarios de teste apropriados.
- Conectar apenas contas de teste no OAuth de staging.
- Validar que nenhuma credencial de producao foi copiada para staging.

## Restaurante piloto

Criar apenas um restaurante de teste no banco staging:

- `slug`: `localix-mp-staging-pilot`
- `name`: `Localix MP Staging Pilot`
- `service_fee_payer`: alternar entre `customer` e `restaurant` durante os cenarios.
- Cardapio simples com um produto barato e disponivel.
- Nenhuma dependencia de dados de producao.

Use `supabase/seeds/mercado_pago_staging_pilot.sql` como template manual.

## Observabilidade esperada

Os logs Mercado Pago devem incluir somente dados nao sensiveis:

- `environment`
- `mp_environment`
- `order_id`
- `restaurant_id`
- metodo de pagamento
- `redirect_uri`
- `notification_url`
- status interno de erro sanitizado

Nunca logar `access_token`, `refresh_token`, `client_secret`, authorization code ou service role.

## Validacao E2E

Executar somente depois de confirmar que o ambiente e staging/sandbox:

- Cliente paga / PIX.
- Restaurante paga / PIX.
- Cliente paga / Checkout Pro.
- Restaurante paga / Checkout Pro.
- Refund total.
- Refund parcial.
- Retry de criacao de pagamento.
- Webhook duplicado.
- Retry de refund.
- Falhas: conta desconectada, token expirado, webhook invalido, snapshot ausente, restaurant mismatch e fee invalida.

Para cada cenario, registrar:

- `order_id`
- `payment_id`
- `customer_total`
- `platform_fee_expected`
- `platform_fee_realized`
- `mercado_pago_fee`
- `restaurant_net_expected`
- `restaurant_net_realized`
- `split_status`
- `reversal_status`
- `ledger_balance`
