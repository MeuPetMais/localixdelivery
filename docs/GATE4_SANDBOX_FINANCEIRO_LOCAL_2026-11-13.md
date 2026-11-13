# Gate 4 — Sandbox financeiro local gratuito (PREPARE ONLY)

Data: 2026-11-13. Branch: `integration/gate4-financial-issue90`, PR #100.
Objetivo: preparar uma instância Supabase local **sem conectar à produção ou ao Staging** e sem executar pagamentos reais. No estágio atual, o Mercado Pago é **100% simulado**.

## Pré-requisitos no computador Windows

- Repositório do Localix atualizado na branch do PR #100 (não fazer merge).
- Node.js 20+.
- Docker Desktop instalado e inicializado, com containers Linux.
- Supabase CLI instalada e verificada com `supabase --version` (consulte a instalação oficial; não utilizar CLI de projeto vinculado).
- Docker funcionando com `docker info`.

Este documento não autoriza a compra de recursos, criação de projetos remotos, alteração de credenciais ou deploy.

## Fase L1 — Preparação local, sem executar SQL

No terminal PowerShell, na raiz do repositório:

```powershell
git fetch origin
git switch integration/gate4-financial-issue90
git pull --ff-only
node scripts/gate4-local-sandbox.mjs prepare
```

Este comando:
1. Cria somente `.localix-financial-sandbox/` e recusa outros caminhos.
2. Copia o `config.toml` existente, mas substitui `project_id` por `localix-financial-sandbox`.
3. Usa portas locais não padrão: API 55421, banco 55422, Studio 55423, Inbucket 55424.
4. Copia as migrations e Edge Functions para o diretório isolado, **sem executar** nenhuma.
5. Não copia o `.env`, segredos nem tokens; não invoca rede, Docker, SQL ou Supabase CLI.
6. A pasta é ignorada pelo Git.

Se o diretório já existir sem a marca de posse específica, a ferramenta falha sem sobrescrever arquivos.

## Fase L2 — Auditoria das migrations antes de iniciar containers

**OBRIGATÓRIO:** conferir a cadeia de migrations copiada, especialmente eventuais scripts com `http`, `pg_net`, `vault`, URLs HTTPS, `cron`, tokens, `dblink`, grants, RLS, triggers e referências a `mvkfrwxgneqzvoabkaws` ou `dnotmvbhuqujvqdtgzav`. Essa inspeção ainda não foi provada como concluída.

Não executar `supabase start` ou `supabase db reset` enquanto a revisão de migrations não for aprovada. A inicialização do Supabase pode aplicar migrations locais e iniciar funções/triggers que exigem avaliação antes.

As seguintes operações são **proibidas neste gate**: `supabase link`, `supabase db push`, `supabase migration repair`, `supabase functions deploy`, `vercel --prod` e criação/reprocessamento de pagamentos externos.

## Fase L3 — Checagem offline de contexto local

Um teste de isolamento adicional está disponível:

```powershell
$env:SUPABASE_URL = "http://127.0.0.1:55421"
$env:VITE_SUPABASE_URL = "http://127.0.0.1:55421"
$env:SUPABASE_PROJECT_ID = "localix-financial-sandbox"
$env:VITE_SUPABASE_PROJECT_ID = "localix-financial-sandbox"
$env:MP_ENVIRONMENT = "mock"
node scripts/gate4-local-sandbox.mjs check
```

A checagem falha se variáveis de ambiente existentes apontarem para produção/Staging, URLs remotas ou credenciais MP (até TEST) que não são necessárias para o gate 100% simulado. Não copie Access Tokens ao chat. Se houver variáveis herdadas, abra um terminal limpo e evite removê-las globalmente de outros projetos.

```
LOCAL_H1_CONFIG_PASS
```

**Esse resultado valida somente as variáveis passadas ao processo, não a conta Mercado Pago, RLS real ou as migrations.**

## Fase L4 — Somente após auditoria técnica independente

Com as migrations avaliadas, dentro do diretório isolado e com Docker ativo, poderemos executar localmente Supabase CLI, verificar RLS, RPC, Edge Functions e testes de checkout com gateway simulado. O comando de preparação deliberadamente **não** executa essa etapa nem ativa scheduler ou worker.

Os códigos APRO, OTHE e CONT e as credenciais TEST do Mercado Pago ficam reservados para **uma etapa externa posterior**, com isolamento/assinatura/OAuth testados e aprovação específica. A configuração de cartões fictícios no painel não prova liquidação/split.

## Estado da homologação

- Preparação segura versionada e testável no PR #100.
- Configuração de execução e migrations pendentes de auditoria; nenhum container local é iniciado automaticamente.
- Nenhuma modificação em Production, Staging ou Vercel.
- **Gate Financeiro NO-GO** até E2E com cenário financeiro simulado e posterior conciliação externa autorizada.

Esta decisão deve atualizar o Documento Mestre após a homologação e aprovação de alteração estrutural.
