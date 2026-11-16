# Gate 4 — Verificação MP_APP_ID

**Data:** 15/11/2026. **Status:** verificação da configuração da aplicação PASS; Gate Financeiro NO-GO.

## Evidência comunicada pelo proprietário

Execução autenticada da função temporária `mp-app-id-check` no Supabase isolado `gvozcqyjhogmvebrwzap` retornou:
- `MP_APP_ID: MATCH`

A comparação executada pela função consiste em conferir se o `MP_APP_ID` do ambiente isolado corresponde a `8897984652446514` (aplicação *Localix Marketplace Homologacao*), sem divulgar o segredo.

**Limite:** esse MATCH demonstra a configuração do ambiente no momento da consulta, mas **não comprova** por si só o vínculo histórico do grant OAuth do vendedor com a aplicação, nem a identidade do comprador TEST ou a elegibilidade PIX com split.

## Encerramento do diagnóstico

A função `mp-app-id-check` foi substituída no ambiente isolado pela versão 2, com `verify_jwt=true`, que sempre devolve HTTP 410 (`mp_app_id_diagnostic_retired`) e **não lê credenciais, banco ou gateway**. O slug ainda consta como ACTIVE no catálogo, mas o diagnóstico está logicamente desativado.

Nenhuma cobrança, migration, merge ou alteração em Production/Staging foi realizada nesta etapa.

## Próximo bloqueio

Validar a identidade real do comprador TEST `3845624812`, seu e-mail e a compatibilidade da modalidade PIX com split no contrato específico do Mercado Pago. Até prova E2E e revisão DEC-021/DEC-022, **não repetir o PIX #1001** e manter Gate Financeiro NO-GO.

**Esta decisão deve atualizar o Documento Mestre.**
