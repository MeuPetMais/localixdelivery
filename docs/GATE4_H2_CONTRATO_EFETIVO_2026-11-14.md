# Gate 4 — H2 / contrato efetivo (14/11/2026)

## Evidência executada diretamente em ambas as contas
Arquivo verificável: `scripts/gate4-h2-effective-contract-check.sql` (SELECT exclusivamente).
- **Referência:** Supabase Staging compartilhado `dnotmvbhuqujvqdtgzav`, `link_6a85adf01fe08191bdf2218f2644d2f2`: **33/33 PASS**.
- **Destino:** Supabase exclusivo de homologação `gvozcqyjhogmvebrwzap`, `link_6af86d26d8748191a4503486e9c2c6bb`: **0/33 PASS**, esperado para banco vazio.
- Nenhuma escrita em nenhum banco; nenhuma Edge Function alterada ou implantada.

## Contratos verificados
- 10 tabelas-chave existentes com RLS habilitada; mínimos de policies e triggers por tabela: restaurantes, pedidos, snapshots, vínculos pagamento, pagamentos, ledger, eventos/fila, conta MP e idempotência checkout.
- 13 triggers críticos presentes e habilitados. **9 diretamente em `orders`**, englobando status/estoque, fidelidade, notificações, registro de cliente, recompensas e criação de número.
- 8 policies específicas de SELECT (cliente, dono, admin, ledger, pagamentos, snapshots, webhook e fila).
- 2 RPCs em `public`, ambas `SECURITY INVOKER` (guard estrutural apenas, não valida assinatura/semântica integral).
- No Staging, as policies `orders` finais **não** incluem `Anyone can place an order` ou permissões amplas de atualização do antigo DDL de junho. Não reinstalar permissões antigas por aplicação literal das primeiras migrations.

## Dependências transitivas para pacote efetivo instalável
1. `orders` possui FKs para `restaurants`, `auth.users` e `coupons`. O último exige resolver o contrato de cupons antes de instalar a FK fiel, ou declarar explicitamente desvio sob teste e não chamá-lo E2E equivalente.
2. `financial_ledger` exige tipos `ledger_transaction_type` e `ledger_status`, FKs e índice idempotente MP.
3. `orders` depende de funções e objetos em `private` e `public` para estoque, fidelidade, cliente, rewards e notificações; **não instalar 9 triggers apontando para funções substitutas fictícias**.
4. Checkout atômico depende de `order_pricing_snapshot`, `order_payment`, `checkout_order_idempotency`, coluna `orders.order_number`, valores contábeis do snapshot e `service_role` com permissões mínimas.
5. Segredos MP OAuth e `mp-webhook-retry` não fazem parte deste pacote SQL. Worker e cron devem permanecer desligados.

## Gate de instalação
**H2 CONTRATO DE REFERÊNCIA = PASS 33/33. H2 BANCO NOVO = BLOCKED 0/33.**

O SQL de auditoria permite verificar objetivamente a migração efetiva sem supor que DDL básico equivale à aplicação completa. Ainda falta construir e revisar o **bundle executável** contendo o fechamento de dependências, policies/grants finais, triggers e funções reais. NÃO executar toda a cadeia histórica de 206 migrations, nem criar stub de trigger/função, nem aplicar DDL parcial em nome de E2E.

**Não foi possível provar equivalência E2E no novo Supabase. Gate Financeiro permanece NO-GO. PR #100 Draft.**

## Próxima execução prioritária
Extrair com proveniência, por dependência direta, os tipos `ledger_*`, cupons, helpers RBAC, funções associadas aos triggers de `orders`, últimas versões das policies e constraints; identificar quais funções podem ser incluídas sem chamadas externas nem DML histórico. Montar a primeira migration com *dry-run* local e somente então aplicá-la no projeto de homologação. Exigir 33/33 após instalar todos os blocos, além de testes comportamentais e RLS por usuário.
