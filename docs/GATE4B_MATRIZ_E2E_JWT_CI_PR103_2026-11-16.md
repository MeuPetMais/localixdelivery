# Gate 4B — Plano executável de E2E do JWT e CI no PR #103
Data: 2026-11-16 | Branch: `fix/gate4b-owner-authorization-status`
**Status:** definição e verificações externas somente leitura. Sem comprovante E2E nesta execução.

## Ambiente e precondições
- Staging Vercel: projeto `localixdelivery-staging`, deploy preview de branch isolada; SSO habilitado no preview. Conferir que o preview alcança **apenas** o Supabase de homologação isolado `gvozcqyjhogmvebrwzap` antes de qualquer teste que escreva dados.
- Nunca usar o endereço do ambiente PROD `mvkfrwxgneqzvoabkaws` com browser de homologação. Conferir no ambiente server-side (sem divulgar valores de segredo) que `SUPABASE_URL` e as chaves apontam para o isolado.
- Ter usuário TEST de comprador autenticável e restaurante fictício no isolado; dados sintéticos, sem PAN/CPF reais, sem transação MP e sem chamar `mp-payment-intent`.
- Confirmar que código sob teste corresponde ao SHA da branch, não apenas ao domínio estático do preview.
- Nenhum usuário TEST ou credencial de aplicativo foi criado ou alterado nesta revisão.

## Matriz E2E obrigatória
| Caso | Passos | Critério de aprovação |
|---|---|---|
| Login existente, PIX | Logar com comprador TEST, selecionar PIX e avançar até criação atômica do pedido, **interrompendo antes de chamar MP** | No Supabase isolado, `orders.customer_id=auth.uid`, `order_pricing_snapshot` existe, `order_payment=PENDING`, sem `payment_id` e sem `payments.external_id` |
| Cadastro + login no checkout | Criar usuário TEST isolado e autenticar, repetir apenas até pedido, sem acionar gateway | Mesmo vínculo entre JWT, `customer_id` e pedido; nenhuma criação duplicada |
| Guest + offline | Sem login, escolher pagamento na entrega/dinheiro | Pedido criado com `customer_id=NULL`, sem exigência de e-mail/JWT |
| Guest + PIX | Sem login, escolher PIX e confirmar | Recusa **antes** do RPC `create_order_with_snapshot_payment`; nenhum pedido financeiro extra |
| JWT ausente/vencido/trocado | Tentar chamada ao serverFn com ausência, token expirado ou token de outro usuário | `online_payment_auth_required` ou 401/403 antes do RPC; nada persistido |
| Replay/duplo clique | Repetir mesma chave de criação e hash de payload | Um único pedido/snapshot, sem cobrança |
| Endpoint de pagamento protegido | Token de consumidor vinculado, consumidor não vinculado, owner, outro restaurante | Só owner/cliente titular autorizados a create/status, e refund/cancel só owner; **somente mocks**, não chamar MP live |
| Webhook/refund/chargeback | Exercitar payloads simulados com status de reversão | Jamais mapear `REFUNDED`/`CHARGEBACK` para APPROVED, nenhum crédito duplicado |

## Integridade observável
- Verificar escrita em pedidos/snapshots/ledger apenas no Supabase isolado, com filtros por identificador sintético.
- Evitar exposição de JWT e dados do comprador em capturas/logs; resultados devem conter apenas identificadores sintéticos e resultados de asserção.
- Usar transação revertida quando viável, senão apagar **somente** os fixtures sintéticos com rotina de cleanup validada. Não limpar dados reais de ambientes compartilhados.

## CI
- Workflow `.github/workflows/ci.yml` no head do PR #103 recebeu filtro PR para base `fix/gate4-pix-test-payer-validation` e filtro push para head `fix/gate4b-owner-authorization-status`, preservando o restante.
- O conector disponível `fetch_commit_workflow_runs` lista somente execuções disparadas por **pull_request**. Isso não comprova ausência/presença de run de `push`. Verificar Actions pela UI e coletar por SHA: Lint, Typecheck, Tests, Build e PostgreSQL concurrency, além de Prettier se exigir na revisão.
- Os checks de deploy Vercel são independentes de CI e não comprovam testes E2E.
- Não alterar base PR nem realizar merge até evidência completa.

## Decisão
**NÃO EXECUTAR pagamentos reais** na fase de autenticação. E2E deve ser de criação e vínculo de pedidos exclusivamente isolados, sem MP POST. Se o preview aponta para produção, bloquear todo o teste com escrita.

Status final desta etapa: **CI habilitada no código da branch; execução PASS não comprovada. E2E não executado por ausência de sessão controlada e confirmação da origem do preview. Gate financeiro NO-GO.**
