# Gate 4 — Classificação SQL das 30 ocorrências financeiras
Data: 2026-11-13. PR #100. **Análise estática, sem aplicação de migrations.**

## Classificação por evidência
O auditor identifica linhas de SQL e pode capturar comentários e policies; as 30 ocorrências **não** significam 30 operações que serão executadas ao iniciar o Supabase.

### Efeito imediato durante aplicação da migration (exigem ambiente descartável e dados exclusivamente sintéticos)
- `20260625134327_a5b64919-ca97-47c1-a7a0-4a30f74bc23f.sql:4` — `UPDATE orders.status` para normalizar status históricos.
- `20260625175618_d971ee76-d4c2-4608-b7bf-349114e7c0ae.sql:40` — backfill `orders.order_number`.
- `20260630140814_d35ff2a5-671d-40b6-a7bf-030f941fb500.sql:84,166` — bloco `DO $$ ... END $$;` com exclusão de pedidos de restaurante demo e inserção de pedidos sintéticos; também cria conta demo `auth.users` com senha literal de demonstração. Executado na aplicação.
- `20260713140637_4e59db94-c4d9-429b-93b3-705e24919c71.sql:2` — remove linhas duplicadas de `order_payment` antes de adicionar índice/constraint UNIQUE; destrutivo sobre dados existentes.
- `20260713214619_a37b71d2-c6a1-49b8-a61a-8c313c549cd5.sql:12` — backfill de `orders.customer_id` por associação telefônica.
- `20260714221937_32eefa61-b08d-4ff2-a62d-0f372e42e9de.sql:1-5` — cinco `UPDATE orders.payment_method` de normalização histórica.
- `20260831221000_sync_delivery_assignment_to_order_status.sql:179` — reconciliador SQL imediato que escreve `order_status_history` e altera status de pedidos com entregas já marcadas `ENTREGUE` (CTE com `INSERT` + `UPDATE`). Também há `EXECUTE` dinâmico para substituir a definição da função no início do arquivo.

### Definição de função/trigger (não dispara por si só ao criar a função; pode disparar com DML ou jobs)
- `20260630154336_3fab98d4-be3a-4925-81ec-8b8b8fd31b2d.sql:126,201` — SQL dentro de funções `seed_demo_marketplace()`/`reset_demo_environment()`, não chamadas explicitamente pela criação.
- `20260704155106_77f42e7e-ae85-4c74-9be3-94961982f4fa.sql:162,178,207` — reserva/consumo/estorno de pontos dentro de funções de fidelidade.
- `20260708204356_24ce3929-459d-435e-a5a4-f15c8d426645.sql:44` — definição de RPC de transição de pedido.
- `20260803153000_guard_delivery_order_transitions.sql:80`, `20260825120000_admin_ord_1_secure_order_transitions.sql:204`, `20260915153005_online_payment_cancel_guard.sql:223`, `20260916160615_payment_expiration_webhook_race_guard.sql:323`, `20260916204420_cron_system_actor_expiration.sql:342`, `20260918154500_fix_order_transition_service_role_claims.sql:278` — versões de funções de transição; execução ocorre ao chamar.
- `20260911160337_sync_orders_platform_fee_from_pricing_snapshot.sql:9` — `UPDATE` dentro de função de trigger para espelhar taxa do snapshot (trigger pode disparar em DML).
- `20260914174138_atomic_checkout_order_creation.sql:89,155` — inserções de pedido e pagamento dentro da RPC de checkout atômico.
- `20260702210802_bc836ed3-838d-4248-a393-65db3087a7fb.sql:88` — `CREATE POLICY ... FOR UPDATE`, não é operação UPDATE sobre linhas.
- `20260917150526_harden_payments_api_write.sql:5` — `DROP POLICY ... UPDATE`, altera controle de acesso, não pagamentos.

## Achados que mudam a avaliação
1. **A migration demo de 30/06 (arquivo ...140814) é um `DO` de execução imediata**, e não uma função inerte. Não utilizar dados reais no ambiente local.
2. **A migration de reconciliação de entregas de 31/08 é DML imediato**, com efeitos em `orders` e histórico. Não assumir que todas as mudanças de status estão apenas dentro de RPCs.
3. A migration de `order_payment` exclui duplicatas antes de criar constraint. É aceitável avaliar em dados sintéticos, mas não representa um teste de preservação de ledger histórico.
4. A neutralização de três `cron.schedule` não neutraliza triggers, SQL dinâmico ou DML imediato.
5. **Não foi possível provar** que a sequência de 206 migrations, o setup de Auth/Storage e funções privilegiadas aplicam com sucesso na versão local da stack, nem que a proteção de saída externa é suficiente.
6. Não alterar migrations oficiais para este gate. DEC-021 permanece apenas princípio contábil aprovado, sem autorização de implementação.

## Gate / próximo controle
- **BLOCKED para `supabase start` e `supabase db reset`** nesta etapa. Sandbox local ainda não inicializado.
- Próximo controle: mecanismo de isolamento de rede de containers, inspeção de scripts de seed/SQL dinâmico e teste automatizado de integridade/assinatura da cópia local das migrations antes de qualquer execução. Se necessário, subir somente uma instância PostgreSQL temporária isolada sem aplicar as migrations e auditar pré-requisitos, sem pagamentos.
- PR #100 Draft, sem merge nem alteração dos bancos Production/Staging. Gate Financeiro NO-GO.
