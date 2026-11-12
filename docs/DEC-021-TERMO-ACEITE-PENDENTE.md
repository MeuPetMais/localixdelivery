# DEC-021 — Termo de aceite técnico-financeiro (pendente de assinaturas)

**Data de preparação:** 12/11/2026  
**Status:** AGUARDANDO DELIBERAÇÃO — não aprovado  
**Escopo:** contrato financeiro autoritativo do Localix Delivery; Issue #90; Gate 4.  
**Documentos-base:** `DEC-021-FINANCIAL-AUTHORITATIVE-CONTRACT.md`, `GATE4_DEC021_EVIDENCIAS_2026-11-12.md`, `GATE-FINANCEIRO-DEC-021-HOMOLOGACAO.md`.

## 1. Objeto do aceite

Aprovar, com ressalvas e após análise dos responsáveis, o princípio de **não somar pagamento bruto e recebível do parceiro como duas entradas econômicas do mesmo saldo**. Preservar eventos brutos para auditoria, ledger append-only, snapshots de preços, identificação de tenant e rastreabilidade de gateway. `netBalance` legado não representa automaticamente caixa, saldo disponível ou obrigação líquida.

**A aprovação deste princípio não define sozinha** titularidade dos recebíveis, Merchant of Record, conta de liquidação, encargos de gateway, incidência fiscal, `service_fee_payer` ou fórmula final de saldo. Nenhum código financeiro pode ser alterado com base em suposições sobre esses pontos.

## 2. Matriz de deliberação obrigatória

| Questão | Estado atual | Responsável pelo aceite |
|---|---|---|
| Taxa comercial: até R$ 30,00 inclusive R$ 0,99; acima R$ 1,49; Mercado Pago principal | CONFIRMADA na DEC-015 | Negócio |
| `PAYMENT_APPROVED` e `RESTAURANT_RECEIVABLE` não podem duplicar base econômica | PROPOSTA DEC-021; cenário sintético R$ 97,02 reproduzido | Técnico + Financeiro |
| Base de reconhecimento do recebível do parceiro e saldo contábil | PENDENTE | Financeiro + Contábil |
| `service_fee_payer` e base elegível por configuração/snapshot | PENDENTE de homologação por cenário | Negócio + Técnico |
| Taxas reais do gateway, split, `application_fee`, liquidação e titularidade | PENDENTE de conciliação externa e contrato | Financeiro + Contábil |
| Reembolso parcial/total, chargeback, Benefits e payout | PENDENTE de regras aprovadas e E2E | Técnico + Financeiro |
| Histórico sem `ledger_idempotency_key` | RISCO IDENTIFICADO; não modificar automaticamente | Técnico + Segurança |
| RLS/RBAC multiempresa, JWTs, migration e RPC em staging | PENDENTE de evidência E2E | Técnico + Segurança |
| Reconciliação com Documento Mestre integral | PENDENTE | Governança |

## 3. Decisão a ser tomada pelos responsáveis

- [ ] **Aprovar somente os princípios contábeis descritos**, sem autorizar implementação, merge, deploy, migration ou recálculo histórico.
- [ ] **Solicitar ajustes** à DEC-021 antes de aprovar, indicando quais premissas econômicas faltam.
- [ ] **Rejeitar** a proposta, registrando alternativa, justificativa e riscos.

**Deliberação escolhida:** NÃO REGISTRADA.  
**Responsável de negócio:** não identificado para assinatura neste registro.  
**Responsável técnico:** não identificado para assinatura neste registro.  
**Responsável financeiro/contábil:** não identificado para assinatura neste registro.  
**Data e evidência do aceite:** pendentes.

## 4. Critérios para autorizar implementação futura

1. Documento Mestre e DEC-010/DEC-015 reconciliados com DEC-021.
2. Base econômica e responsabilidades definidas e assinadas; regras de taxas e split validadas.
3. Plano de mudança isolada para agregação, com testes de caracterização, compatibilidade e rollback.
4. E2E staging: PIX/cartão, dois pagadores, limites R$ 29,99/R$ 30,00/R$ 30,01, concorrência webhook, refund, chargeback, Benefits, payout, RLS multiempresa.
5. Evidências independentes de conciliação de snapshot, gateway, ledger e liquidação, sem dados reais em relatório.
6. CI 4/4 no SHA final e revisão do PR; liberação de produção em autorização separada.

**Até deliberação expressa: DEC-021 PROPOSTA, Issue #90 aberta, Gate Financeiro NO-GO.**

**Esta decisão deve atualizar o Documento Mestre** somente após aceite e reconciliação formal.
