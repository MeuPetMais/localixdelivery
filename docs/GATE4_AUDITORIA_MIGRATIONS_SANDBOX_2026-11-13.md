# Gate 4 — Auditoria estática de migrations para sandbox local
Data: 2026-11-13. PR #100. Estado: **BLOCKED para supabase start**.

## Escopo e método
- Varredura offline, sem execução de SQL, de **206 arquivos** em `supabase/migrations`.
- Script: `scripts/gate4-audit-migrations.mjs`. Teste automatizado: `scripts/gate4-audit-migrations.test.ts`.
- A varredura identifica padrões por linha; não interpreta PL/pgSQL em profundidade, não valida todas as dependências, não prova equivalência da cadeia com o schema remoto nem substitui auditoria humana.

## Achados da CI
| Categoria | Ocorrências |
|---|---:|
| IDs/endereços diretos conhecidos de Production/Staging | 0 |
| Chamadas de rede SQL explícitas (padrões pesquisados) | 0 |
| Agendamento/cron | 7 |
| Extensão de rede/segredos | 1 |
| URL/webhook textual | 29 |
| SECURITY DEFINER | 128 |
| Execução dinâmica por padrão | 249 |
| Efeitos em tabelas financeiras | 30 |
| GRANT/REVOKE/RLS/policies | 1239 |
| Triggers | 148 |

**Atenção**: contagens por linha/expressão, não por statement validado; duplicidades, comentários e falsos positivos são possíveis. URLs sinalizadas em `20260630154336_3fab98d4-be3a-4925-81ec-8b8b8fd31b2d.sql` são imagens Unsplash armazenadas como texto SQL; por si sós não representam uma solicitação HTTP.

## Três migrations com jobs automáticos efetivamente identificados
1. `20260704162552_ebcdc1d4-907d-4762-8180-1ac3bb7a3bdd.sql`: habilita `pg_cron` e `pg_net`, agenda `loyalty-daily-lifecycle` às 03h, invoca `loyalty_expire_points()` e `loyalty_scan_expiring()`. Risco: alterações não planejadas em benefícios/fidelidade.
2. `20260712153054_60234e8e-9ffc-4196-a8dc-97f3373b3053.sql`: agenda `expire-pending-payment-orders` a cada cinco minutos; chama função SECURITY DEFINER que transiciona pedidos pendentes para `falha_pagamento`. Risco: efeitos automáticos em pedidos/pagamento e conflito de webhook.
3. `20260805160000_support_knowledge_category_scope_and_sla_cron.sql`: agenda `support-sla-notifications-every-5-minutes` a cada cinco minutos. Risco: atividade assíncrona fora do escopo financeiro.

## Decisão temporária de segurança
**Não executar `supabase start` ou `supabase db reset` ainda.** No Supabase CLI, iniciar a stack pode aplicar migrations e agendar jobs locais. O modo local não é licença para assumir idempotência, ausência de rede ou inexistência de side effects. Não alterar as migrations oficiais do Localix para facilitar homologação.

## Próximas ações técnicas
1. Inspecionar `pg_cron`, `pg_net`, quaisquer SQL com `SECURITY DEFINER`, triggers financeiros e dados insertados em migrations.
2. Preparar **cópias locais** revisadas das migrations, desabilitando apenas jobs automáticos de início não essenciais ao gate de teste e preservando funções/policies/transições para análise; nenhuma mudança em arquivos oficiais.
3. Revisar se há outras extensões não disponíveis no CLI local e migrations que pressuponham dados já existentes. Verificar execução sobre banco local inteiramente descartável com saída do processo monitorada.
4. Só então iniciar Supabase no local, conferir as migrations/RLS/RPCs de forma observável, mantendo MP mock, sem webhooks externos.
5. Confirmar que o gate financeiro ainda é **NO-GO** e a DEC-021 não está autorizada a implementação de regra contábil nova.

O comando `node scripts/gate4-audit-migrations.mjs` retorna exit code 2 quando encontra bloqueadores. **Esse erro é intencional; nunca ignorá-lo com scripts que forcem continuar.**

Não foi possível provar a segurança do início da stack nem a fidelidade funcional completa das migrations no Supabase local.
