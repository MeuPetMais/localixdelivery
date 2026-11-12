# DEC-021 — Contrato Financeiro Autoritativo do Localix Delivery

**Data:** 12/11/2026
**Status:** PROPOSTA — política comercial confirmada; reconhecimento contábil e homologação pendentes
**Prioridade:** P0 — Integridade financeira
**Referências:** DEC-010, Issue #90, PRs #87/#89/#91/#92/#93, BD-016/BD-017 (propostas neste PR).

## Problema e contexto
O Ledger legado pode agregar `PAYMENT_APPROVED` e `RESTAURANT_RECEIVABLE` como entradas positivas de bases econômicas diferentes. O cenário sintético de R$ 50,00 e R$ 48,51 retorna R$ 97,02 em `computeBalance()`. A proteção do dashboard mitiga a exibição em um caminho, mas não resolve o contrato contábil. Não há prova de dupla base efetiva nos dados atuais de produção. A Issue #90 continua aberta.

## Opções
A. Manter a fórmula e bloquear saldos ambíguos: insuficiente.
B. Reconstruir Ledger, PricingEngine e PaymentService: rejeitada por risco de regressão.
C. Preservar domínios e histórico; formalizar reconhecimento por fato econômico e corrigir apenas agregações comprovadamente incorretas: **recomendada, sujeita a aceite técnico-financeiro**.

## Política comercial confirmada
- Mercado Pago como gateway principal para novos parceiros; Stripe não é removido, desligado nem automaticamente oferecido como alternativa.
- Taxa de serviço Localix em BRL: subtotal elegível até R$ 30,00, inclusive, R$ 0,99; acima de R$ 30,00, R$ 1,49.
- Aplicação prospectiva conforme política vigente e snapshot do pedido; sem recálculo retroativo.
- Nenhuma mensalidade, comissão percentual ou outra condição comercial é criada por esta DEC.
- Pagador da taxa (`service_fee_payer`), subtotal elegível e encargos precisam respeitar contrato e configuração autoritativos, a serem homologados.

## Contrato contábil proposto
| Conceito | Fonte prioritária | Reconhecimento |
|---|---|---|
| Valor esperado | `order_pricing_snapshot` | Composição autoritativa do pedido, não caixa |
| Cobrança efetiva | Gateway + identidade de captura | Após confirmação válida |
| Receita Localix | Política, snapshot e fato financeiro | Direito econômico da plataforma, sem duplicar cobrança |
| Taxa gateway | Extrato/captura do provedor | Custo efetivo, não estimativa zero |
| Recebível do parceiro | Contrato de liquidação + provedor | Direito a receber, não caixa |
| Repasse realizado | Comprovante de transferência/liquidação | Somente após confirmação |
| Saldo disponível | Liquidações, bloqueios e saídas conciliadas | Nunca apenas soma indiscriminada de eventos |
| Reembolso | `refund_id` e valor confirmado | Reversão única, total ou parcial |
| Chargeback | `chargeback_case_id` e estado financeiro | Conforme disputa e efeito confirmado |
| Benefits | Ledger próprio + pedido/snapshot | Concessão e resgate únicos |

A identidade do fato financeiro deve incluir tenant, provedor, pagamento e operação; captura, refund, disputa ou payout exigem suas identidades específicas. Webhooks repetidos ou fora de ordem não podem criar obrigação adicional. `PAYMENT_APPROVED` e `RESTAURANT_RECEIVABLE` podem coexistir como registros, mas não como duas receitas ou dois saldos da mesma base.

## Invariantes e riscos
- Nenhuma dupla contagem de receita, recebível ou saldo.
- Nenhum pagamento sem pedido válido ou pedido pago sem confirmação.
- Nenhuma dedução repetida de taxa sobre base já líquida.
- Reembolso acumulado limitado às capturas válidas; chargeback reconhecido conforme estado comprovado.
- Isolamento por restaurante/moeda, RLS/RBAC e idempotência por identidade econômica.
- Benefits não duplicados; dados inconciliáveis devem falhar de forma controlada.
- Preservar Ledger append-only e histórico; não corrigir lançamentos por exclusão.
- Split Mercado Pago é efetivado no gateway via `application_fee` conforme DEC-010; `payment_split` não comprova sozinho a liquidação.
- Merchant of Record, titularidade dos recebíveis e tratamento fiscal exigem validação contábil/contratual. **Não foi possível provar** esses pontos apenas pelo código.

## Impacto
Checkout, OrderService, PricingEngine, PlatformRevenueService, PaymentService, Mercado Pago, Stripe legado, Supabase, RPCs, triggers, Edge Functions, webhooks, Ledger, Benefits, parceiros, entregadores e painéis administrativos/financeiros. A existência de duas fontes de política (`platform_settings` e `platform_fees`) exige reconciliação antes de alteração futura.

## Critérios de aceite
1. Aceite técnico-financeiro do contrato por responsáveis definidos.
2. Resolver cenário R$ 97,02 sem ocultar divergências legítimas.
3. Provar fronteiras R$ 29,99/R$ 30,00/R$ 30,01 e ambos pagadores de taxa.
4. Homologar idempotência, concorrência, PIX/cartão, refund, chargeback e Benefits.
5. Conciliar snapshots, gateway, `application_fee`, custos efetivos, recebíveis e repasses.
6. Validar RPC `get_restaurant_financial_snapshot` via PostgREST/JWT, RLS multiempresa e versão de migration em Staging.
7. Revisar dependências e CI dos PRs; aprovar plano de rollback e emitir parecer GO específico.

## Governança
A aprovação documental não autoriza merge, deploy, migrations, alteração de saldos ou operação comercial real. A regra de onboarding BD-018 permanece proposta e fora do escopo de aprovação automática. Documento Mestre integral não foi conferido nesta execução; sua reconciliação é pendência explícita.

**Esta decisão deve atualizar o Documento Mestre.**

**Condição para revisão:** mudança de gateway, taxas, pagador, split, liquidação, titularidade, legislação ou nova evidência contábil relevante.
