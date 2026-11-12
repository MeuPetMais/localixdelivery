# Gate Financeiro — Checklist de homologação (proposta)

**Referência:** DEC-021, Issue #90, PRs #87/#89/#91/#92/#93. **Status:** NÃO EXECUTADO. Nenhuma evidência PASS é presumida.

## Pendências documentais
- [ ] Recuperar e reconciliar Documento Mestre integral; atualizar referências após aprovação.
- [ ] Revisar BD-016 e BD-017; deliberar separadamente BD-018 (ordem homologação/publicação).
- [ ] Revisar ADR-003, ADR-004 e ADR-006 e contrato Merchant of Record por gateway.
- [ ] Aprovar definições contábeis de receita, recebível, saldo, caixa, custos e titularidade.
- [ ] Definir owner técnico, financeiro e contábil do aceite.

## Testes em Staging (exigem autorização específica)
- [ ] Preço subtotal R$ 29,99 / R$ 30,00 / R$ 30,01; `service_fee_payer` cliente e restaurante.
- [ ] Verificar `PlatformRevenueService` e `PaymentService.calcFees()`: `platform_settings` versus `platform_fees`, falha de loader/cache e snapshot.
- [ ] Cenário Ledger R$ 97,02, bases independentes, estorno e dashboard sem ocultação de inconsistências.
- [ ] RPC `get_restaurant_financial_snapshot` por PostgREST/JWT: owner, outro tenant, admin, anon, concorrência.
- [ ] Comparar migration remota `20261111212209` com arquivo do PR #93 `20261111204106` sem reaplicar automaticamente.
- [ ] PIX/cartão aprovado, recusado, duplicidade e evento fora de ordem; nenhuma regressão de pedido.
- [ ] Mercado Pago: `application_fee`, tarifas efetivas, split, repasse e conciliação externa.
- [ ] Refund parcial/total, chargeback, Benefits e identidade econômica idempotente.
- [ ] RLS/RBAC, multiempresa, auditoria e observabilidade.
- [ ] CI, migrations, rollback e parecer GO específico.

## Restrições
Este documento não autoriza execução de testes mutáveis, merge, deploy, migrations, alteração de dados, valores, credenciais, pagamentos ou produção. PR documental não libera pedidos reais.
