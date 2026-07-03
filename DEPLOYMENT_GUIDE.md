# DEPLOYMENT GUIDE — Localix v1.0

Como promover mudanças até produção com segurança.

## 1. Ambientes

| Ambiente | URL | Origem |
| --- | --- | --- |
| Preview | `id-preview--<project>.lovable.app` | último commit do editor |
| Produção | `localixdelivery.lovable.app` | último Publish |
| Backend stable | `project--<project>.lovable.app` | idem produção |

## 2. Frontend

1. Todas as mudanças aparecem imediatamente em **Preview** após commit.
2. Para promover a produção: clicar **Publish → Update** no editor Lovable.
3. Publicação leva ~1 minuto; edge cache invalida automaticamente.
4. Custom domain (se conectado) é servido pela mesma release.

## 3. Backend

- **Server functions** (`createServerFn`) e **rotas** (`src/routes/api/...`)
  fazem parte do bundle: publicam junto com o frontend.
- **Edge functions Supabase** (`supabase/functions/*`) deployam
  automaticamente após commit — sem passo manual.
- **Migrations SQL** aplicam automaticamente após revisão do editor.

## 4. Ordem recomendada de mudança

1. Migrations (schema, GRANT, RLS) — merge primeiro.
2. Server code que consome o schema — merge em seguida.
3. Client code que consome as server functions — merge por último.
4. Publish único ao final para promover tudo.

Nunca faça o inverso: código novo consumindo schema ainda não aplicado
gera erro em produção.

## 5. Secrets

- Runtime: `add_secret` / Cloud → Secrets. Reflete imediatamente nos
  handlers (não precisa redeploy).
- Build: Workspace Settings → Build Secrets (para `.npmrc`, etc.).
- Nunca committar `.env` com valores reais.

## 6. Verificação pós-deploy

Após cada deploy de produção, executar em ordem:

1. `curl -I https://localixdelivery.lovable.app` → 200.
2. Login owner + smoke test (`GO_LIVE_CHECKLIST.md` §9).
3. Conferir `OperationsDashboard` — nenhum novo alerta.
4. Conferir logs de erros nas últimas 15min.

## 7. Deploy de feature protegida por flag

1. Merge do código com a flag desligada.
2. Publish.
3. Habilitar via `platformConfiguration.featureFlags.setRollout('flag', 10)`.
4. Escalar gradualmente (10 → 25 → 50 → 100).
5. Monitorar métricas por 24h em cada etapa.

## 8. Deploy de mudanças em pagamentos

Requer aprovação dupla (engenharia + pagamentos). Sempre acompanhado de:

- Testes atualizados em `OrderOrchestrator.test.ts` e afins.
- Webhook MP funcionando em sandbox antes do live.
- Rollback preparado (ver `ROLLBACK_GUIDE.md`).

## 9. Falhas comuns e mitigação

| Sintoma | Provável causa | Ação |
| --- | --- | --- |
| `Unauthorized: No authorization header` | `attachSupabaseAuth` ausente | Restaurar em `src/start.ts` |
| `Expected 3 parts in JWT; got 1` | `supabaseAdmin` usado para read público | Trocar por cliente publishable |
| `permission denied for table X` | GRANT ausente | Migração adicional |
| Webhook MP 401 | Assinatura inválida | Revisar `MP_WEBHOOK_SECRET` |

## 10. Referências

- `OPERATIONS_MANUAL.md`
- `ROLLBACK_GUIDE.md`
- `DISASTER_RECOVERY_PLAN.md`
