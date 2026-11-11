# Gate 4 — homologação HTTP/JWT real no staging

> **Status: não executado nesta auditoria.** Os testes SQL/RLS com claims simulados passaram; isso não substitui tokens emitidos pelo Supabase Auth nem chamadas ao PostgREST.

## Contrato e ambiente

- **Somente staging:** `https://dnotmvbhuqujvqdtgzav.supabase.co`
- RPC: `public.get_restaurant_financial_snapshot(uuid)`, instalada apenas em staging.
- Código: `scripts/gate4-staging-rpc-smoke.mjs`. Invoca apenas `POST /rest/v1/rpc/get_restaurant_financial_snapshot` e `GET /auth/v1/user`.
- Sem service-role, inserts, mutations financeiras, migrations, deploy ou produção.

## Pré-condições

Use uma chave **publishable/anon exclusivamente de staging**, e três **JWTs de acesso de sessão real de staging**, emitidos pelo Auth e ainda válidos:
1. Usuário proprietário de um restaurante que tenha ao menos um lançamento no Ledger de staging.
2. Usuário proprietário de outro restaurante, que não possua esse mesmo restaurante.
3. Usuário administrador distinto dos dois anteriores.

O script valida que os três tokens pertencem a **identidades Auth distintas**, e que a RPC responde ao proprietário e ao admin com a mesma contagem, ao outro proprietário com zero, e nega anônimos com HTTP 401/403. Ele valida o envelope `version / row_count / complete / entries` sem imprimir lançamentos nem tokens.

Variáveis de ambiente a fornecer **localmente** (não em commit, conversa, issues, logs ou screenshots):

```text
GATE4_STAGING_ANON_KEY
GATE4_STAGING_RESTAURANT_ID
GATE4_STAGING_OWNER_JWT
GATE4_STAGING_OTHER_OWNER_JWT
GATE4_STAGING_ADMIN_JWT
```

Execute no terminal local, com as variáveis injetadas pelo gerenciador de segredos apropriado:

```sh
node scripts/gate4-staging-rpc-smoke.mjs
```

`PASS` significa que o cenário simples HTTP/JWT passou **naquele instante**. `BLOCK` indica pré-condição não atendida, incluindo JWT inválido, ausente, expirado ou identidades repetidas. `FAIL` indica falha de contrato/isolamento. Não disfarce falhas de rede, de schema cache ou 404 como aprovação.

## Limitações que requerem homologação separada

- As contas e suas permissões devem ser inspecionadas por quem opera o staging; a verificação de três IDs distintos sozinha não prova os papéis de negócio.
- Confirmar a exposição RPC/refresh de schema cache, 50.000 linhas e tempos/payloads sob carga.
- Concorrência com sessões HTTP distintas e backfill, sem pagamentos reais; usar dados sintéticos em ambiente isolado.
- Reconciliar o ID remoto de migration `20261111212209` com o arquivo Git `20261111204106_gate4_consistent_financial_snapshot.sql` antes de qualquer pipeline de migrations.
- Gate 4 contábil, idempotência por gateway, liquidação e reconciliação continuam bloqueados.

**Nunca** publique a aplicação dependente dessa RPC em produção sem instalar e homologar a migration correspondente por processo aprovado.
