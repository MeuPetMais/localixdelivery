# Gate 4 — Smoke test PostgreSQL descartável, sem rede (L4a)

**Estado:** instruções de teste; execução no computador do operador ainda não comprovada.  
**Segurança:** nenhum banco Supabase remoto; nenhuma migration do Localix aplicada; nenhum pagamento.

## Premissas

- Executar exclusivamente na pasta separada `localix-financial-sandbox`.
- Docker Desktop operacional; `docker ps` respondendo.
- Banco **PostgreSQL 17 oficial** para validar somente o mecanismo Docker/SQL local. **Não é** uma réplica do Supabase Postgres; não possui garantidamente extensões, schemas `auth`/`storage`, roles Supabase, RLS ou Edge Functions. Não é um ambiente homologado para migrations Localix.
- Container descartável sem volume persistente, sem portas publicadas, sem rede. Não usar tokens, senhas nem dados de produção.

## 1. Conferir se o nome está livre

```powershell
docker ps -a --filter "name=^/localix-gate4-pg-smoke$" --format "{{.Names}}"
```

Se aparecer `localix-gate4-pg-smoke`, **pare**: pode existir outro container; não o exclua sem revisar.

## 2. Baixar somente a imagem oficial

```powershell
docker pull postgres:17-alpine
```

O pull usa rede para baixar a imagem pública. **O container de banco** será iniciado depois com `--network none`.

## 3. Criar banco descartável totalmente sem rede

```powershell
docker run --detach --rm --name localix-gate4-pg-smoke --network none --publish-all=false -e POSTGRES_USER=localix_smoke -e POSTGRES_PASSWORD=localix_smoke_disposable_only -e POSTGRES_DB=localix_smoke postgres:17-alpine
```

Não há `-p`, `--publish`, bind mounts ou volumes do host. A senha literal é somente para o banco sintético e descartável dentro do container isolado.

## 4. Verificação por `docker exec` (sem porta HTTP/TCP no host)

```powershell
docker exec localix-gate4-pg-smoke pg_isready -U localix_smoke -d localix_smoke
docker inspect --format "{{.HostConfig.NetworkMode}} | {{json .NetworkSettings.Ports}}" localix-gate4-pg-smoke
docker exec localix-gate4-pg-smoke psql -U localix_smoke -d localix_smoke -v ON_ERROR_STOP=1 -Atc "SELECT current_database(), current_user, current_setting('server_version_num');"
docker exec localix-gate4-pg-smoke psql -U localix_smoke -d localix_smoke -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

**Esperado:** `accepting connections`; inspeção da rede `none`; versão de PostgreSQL; 0 tabelas públicas. Caso o banco ainda esteja inicializando, repetir `pg_isready` após ficar pronto. Não usar `supabase start` nem aplicar migrations.

## 5. Descartar explicitamente depois da verificação

```powershell
docker stop localix-gate4-pg-smoke
```

O `--rm` remove o container ao parar, inclusive o banco efêmero. A imagem baixada pode permanecer no cache Docker.

## Guardas

- Não usar `docker volume prune`, `docker system prune` nem remover containers de outros projetos.
- Não usar dados reais, secrets de Mercado Pago ou `SUPABASE_SERVICE_ROLE_KEY`.
- **Não assumir que um PostgreSQL genérico é equivalente ao PostgreSQL do Supabase.** Ele serve apenas para smoke test local e verificação de conectividade isolada.
- O início do Supabase local e a execução da cadeia de 206 migrations continuam bloqueados até auditoria de referências externas, extensões, dados demo, grants, `SECURITY DEFINER` e transições financeiras.
- PR #100 permanece Draft, sem merge ou deploy. Gate Financeiro NO-GO.

