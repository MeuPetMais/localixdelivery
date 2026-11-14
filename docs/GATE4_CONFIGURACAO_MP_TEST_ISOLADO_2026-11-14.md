# Gate 4 — configuração inicial Mercado Pago TEST no Supabase isolado

**Data:** 14/11/2026. **Projeto Supabase:** `gvozcqyjhogmvebrwzap` (`localix-gate4-homologação`).  
**Branch:** `integration/gate4-financial-issue90`, PR #100 Draft. **Produção e Staging compartilhado:** não alterados.

## Infraestrutura realmente configurada

- A Edge Function original `mp-webhook-retry` foi publicada neste projeto isolado a partir de:
  - `supabase/functions/mp-webhook-retry/index.ts`
  - `supabase/functions/mp-webhook-retry/retry-policy.ts`
- Deployment confirmado por `list_edge_functions`: `status=ACTIVE`, `version=1`, `verify_jwt=false`.
- URL do endpoint no isolado: `https://gvozcqyjhogmvebrwzap.supabase.co/functions/v1/mp-webhook-retry`.
- **ACTIVE é estado de publicação, NÃO significa habilitado para processar eventos.** A função valida antes de tocar o banco os requisitos `MP_WEBHOOK_RETRY_WORKER_SECRET`, `MP_WEBHOOK_REPLAY_SECRET`, `MP_WEBHOOK_RETRY_CUTOVER`, além das variáveis geridas pelo Supabase `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Sem configuração válida, código retorna HTTP 503 (`worker_not_configured`). Não foi possível testar a resposta HTTP desta rede; esta conclusão deriva do código auditado.
- `verify_jwt=false` é intencional para autenticação própria do worker por header Bearer de segredo. Sem segredo o código retorna 503. Sem segredos externos, sem agendamento e sem receiver, nenhuma fila foi processada.
- Não houve deploy de `mp-webhook`, `mp-payment-intent`, `mp-oauth` nem callback; nenhum agendamento/cron foi ativado.

## Bloqueios efetivos identificados na revisão do código

1. `supabase/functions/mp-oauth/index.ts` e `supabase/functions/mp-oauth-callback/index.ts` incluem **REDIRECT_URI fixo de Supabase Production** (`mvkfrwxgneqzvoabkaws`). **NÃO implantar essas duas funções no isolado enquanto a URL de retorno não for parametrizada e o allowlist de redirect testado.** Do contrário testes OAuth podem redirecionar à produção.
2. O receiver `mp-webhook/index.ts` registra eventos antes da verificação de assinatura e possui fallback de HMAC inválido para verificação por consulta autenticada à API MP do vendedor. Este contrato exige revisão de trust-boundary e credenciais MP TEST **antes de expor a rota**, com evidência de pagamento, restaurante, valor e titularidade. Não implantá-lo como endpoint público com credenciais ausentes.
3. O worker precisa de segredo próprio, segredo de replay compartilhado com receiver e cutover explícito. Nunca reprocessar eventos anteriores ao cutover sem reconciliação manual.
4. O banco isolado contém 0 usuários Auth persistentes após testes SQL; o smoke JWT real ainda não é executável sem três sessões legítimas distintas. O script está em `scripts/gate4-homologation-auth-rpc-smoke.mjs`.

## Configurações seguras ainda exigidas pelo operador de contas

**No Supabase Dashboard, projeto `gvozcqyjhogmvebrwzap` > Edge Functions > Secrets:**

- `MP_WEBHOOK_RETRY_WORKER_SECRET`: segredo aleatório independente e exclusivo do isolado, longo e imprevisível.
- `MP_WEBHOOK_REPLAY_SECRET`: segredo independente do worker, compartilhado apenas com o receiver isolado.
- `MP_WEBHOOK_RETRY_CUTOVER`: timestamp ISO 8601 de início controlado, nunca data legada sem autorização.
- `MP_WEBHOOK_SECRET`: assinatura de webhook da **aplicação TEST**, somente quando o receiver estiver auditado e pronto.
- `MP_TOKEN_ENC_KEY`: segredo próprio e isolado >=32 caracteres, para criptografia de OAuth token; não reutilizar a chave da produção.
- `MP_APP_ID`, `MP_CLIENT_SECRET`: valores da aplicação TEST para OAuth depois de parametrizar callback; jamais copiar secret de produção.
- **Não** tentar definir variáveis com prefixo `SUPABASE_`; Supabase injeta as variáveis reservadas no runtime, conforme sua documentação.
- **Não** adicionar `MP_ACCESS_TOKEN` de produção como fallback do webhook em testes multi-tenant.

**No Mercado Pago Developers > Integrações > aplicação correta > ambiente TEST:** obter Public Key/Access Token TEST, criar contas de teste vendedor/comprador se o cenário de marketplace/split exigir, preparar webhook URL de testes **somente após receiver habilitado e homologado**. Não enviar Access Token, Client Secret, token OAuth nem segredo HMAC pelo chat, commit, comentário do PR ou frontend.

**No Supabase Auth do projeto isolado:** cadastrar usuários sintéticos independentes (owner A, owner B, admin), com sessão JWT real via fluxo normal; executar smoke em modo somente leitura com variáveis `GATE4_HOMO_ANON_KEY`, `GATE4_HOMO_RESTAURANT_ID`, `GATE4_HOMO_OWNER_JWT`, `GATE4_HOMO_OTHER_OWNER_JWT`, `GATE4_HOMO_ADMIN_JWT`.

## Próximas verificações obrigatórias

1. Confirmar por leitura de configuração (sem expor valores) se os secrets TEST foram cadastrados **no isolado**; provar ausência de qualquer rota apontando Production.
2. Testar GET do worker (405), POST sem configuração (503), após configuração POST sem token (401) e POST com token de teste sem jobs históricos (nenhum efeito). **Ainda não executado HTTP; o toolchain não deu acesso a HTTP externo nesta rodada**.
3. Corrigir o redirect OAuth fixo para ambiente isolado com regressão e allowlist.
4. Auditar a política de assinatura/fallback e vínculo do receiver; só depois publicar receiver `mp-webhook` com `verify_jwt=false` pois o MP não envia JWT do Supabase; autenticar por HMAC e checks adicionais de gateway.
5. Executar PIX/cartão/chargeback/refund/payout/split com dados TEST reais e reconciliar OrderService, PaymentService, PricingEngine, snapshot, Ledger e webhook.
6. Validar e aprovar DEC-021 em documento separado antes de mudar fórmula financeira, merge ou produção.

**Parecer:** Infraestrutura worker publicada **inativa para processamento**; configuração MP TEST e E2E **não concluídos** por segredos, redirect de OAuth, receiver e identidades Auth. **Gate Financeiro global NO-GO**. Não foi possível provar homologação HTTP/MP nem decisão contábil final.

**Esta decisão deve atualizar o Documento Mestre** após aprovação, fechamento da homologação e segregação efetiva entre ambientes.
