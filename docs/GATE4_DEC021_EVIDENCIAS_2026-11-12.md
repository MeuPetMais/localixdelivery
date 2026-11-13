# Gate 4 — Registro de evidências e encaminhamento da DEC-021

**Data:** 12/11/2026  
**Status:** EVIDÊNCIAS PARCIAIS — DEC-021 permanece PROPOSTA; Gate Financeiro NO-GO  
**Referências:** `docs/DEC-021-FINANCIAL-AUTHORITATIVE-CONTRACT.md`, Issue #90, PRs #93/#96  
**Ambiente dos testes SQL:** Supabase Localix Delivery - Staging (`dnotmvbhuqujvqdtgzav`)

## 1. Decisão de governança

Preservar a opção C da DEC-021: manter domínios e histórico append-only; definir reconhecimento por fato econômico e corrigir somente agregações comprovadamente incorretas, após aceite técnico-financeiro. **Esta formalização não é aprovação do contrato contábil** e não libera merge, deploy, migrations, reprocessamento retroativo ou produção.

A política comercial da DEC-015 continua confirmada: Mercado Pago principal, taxa de serviço R$ 0,99 para subtotal elegível até R$ 30,00 inclusive e R$ 1,49 acima; pagador da taxa e bases econômicas dependem do snapshot/contrato vigente. Não se presume que a taxa seja sempre descontada do parceiro.

## 2. Evidências verificadas em Staging

| ID | Procedimento | Observado | Classificação e limite |
|---|---|---|---|
| G4-IDEMP-01 | Consulta a `pg_indexes` da `financial_ledger` | Presentes `financial_ledger_mp_idempotency_uidx` e `financial_ledger_mp_payment_type_idempotency_uk` | PASS — existência; não prova cobertura de linhas sem chave |
| G4-IDEMP-02 | Inserção sintética seguida de repetição, com subtransação revertida | Duplicidade bloqueada para `PAYMENT_APPROVED` | PASS — sequencial |
| G4-IDEMP-03 | Repetição sintética para `PAYMENT_APPROVED`, `REFUND`, `CHARGEBACK` e `PAYMENT_FAILED` | Quatro duplicidades bloqueadas, sem resíduos | PASS — sequencial; não substitui webhook E2E |
| G4-IDEMP-04 | Duas chamadas SQL concorrentes com mesma referência sintética e `ON CONFLICT DO NOTHING` | Primeiro writer confirmou; segundo inseriu zero linhas | PASS — cenário específico de concorrência no banco; não prova corrida completa de webhook |
| G4-CLEAN-01 | Remoção direcionada do lançamento sintético de concorrência e consulta independente | Um registro sintético excluído; zero resíduos | PASS — staging |
| G4-GAP-01 | Consulta às linhas existentes do Mercado Pago | Um `PAYMENT_PENDING` de R$ 9,49, sem `ledger_idempotency_key` | RISCO — índices parciais não cobrem essa linha |
| G4-FIN-01 | SQL sem escrita com `PAYMENT_APPROVED=50`, `RESTAURANT_RECEIVABLE=48,51`, `PLATFORM_FEE=1,49` | Soma legada = R$ 97,02; diferença de distribuição = R$ 0,00; excesso sobre recebível simulado = R$ 48,51 | FAIL da fórmula como saldo único; cenário sintético, não evidência de perda real |

A consulta de staging encontrou somente um `PAYMENT_PENDING` e não permitiu conciliar pagamento aprovado real, tarifa efetiva, split, repasse ou extrato do Mercado Pago.

## 3. Contrato financeiro: limites para implementação

- `order_pricing_snapshot`: valor esperado e composição, não prova de caixa.
- Captura confirmada no gateway: cobrança efetiva, não necessariamente receita do parceiro nem disponibilidade bancária.
- `RESTAURANT_RECEIVABLE`: direito econômico do parceiro conforme contrato; não duplicar com pagamento bruto.
- `PLATFORM_FEE`: direito econômico Localix; apuração depende de quem paga a taxa, da base e da confirmação financeira.
- `GATEWAY_FEE`: custo real conforme provedor; não inferir taxa zero.
- `PAYOUT`: transferência/liquidação confirmada, não mera intenção.
- `REFUND` e `CHARGEBACK`: efeitos confirmados, com identidades específicas e sem dupla reversão.
- `netBalance` legado: **não** rotular como saldo contábil, disponível ou caixa realizado até contrato aprovado e agregações homologadas.

A igualdade sintética `50,00 = 48,51 + 1,49` é apenas um oráculo de distribuição do cenário, **não** uma regra universal: pode variar por `service_fee_payer`, tarifa gateway, descontos, benefícios, reembolso, chargeback, split e liquidação.

## 4. Bloqueios para GO

1. Aprovação expressa do contrato contábil, com responsáveis técnico, financeiro e contábil; definir Merchant of Record e titularidade.
2. Corrigir a agregação ambígua do Ledger por base aprovada, sem reescrever histórico; caracterizar e tratar registros sem chave idempotente.
3. Testar webhooks E2E simultâneos e fora de ordem, PIX/cartão, refund parcial/total, chargeback, Benefits, split e repasse.
4. Conciliar gateway × snapshot × ledger × extrato de liquidação, com taxas efetivas e `service_fee_payer` cliente/parceiro.
5. Homologar RLS/RBAC e isolamento entre tenants com JWTs distintos; validar migration/RPC de staging e CI no SHA final.
6. Reconciliar com Documento Mestre integral antes de alterar status da DEC-021.

**Não foi possível provar** conciliação financeira completa, liquidação real, idempotência E2E de webhook ou autorização para alterar a fórmula. Issue #90 permanece aberta. **Gate Financeiro: NO-GO.**

**Esta decisão deve atualizar o Documento Mestre** após a aprovação formal, sem substituir decisões anteriores por inferência.
