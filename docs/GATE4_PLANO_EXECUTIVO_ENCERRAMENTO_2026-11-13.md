# Gate 4 — Plano executivo de encerramento e liberação comercial

**Data:** 13/11/2026. **Fonte:** GitHub PRs #91–#96, Issue #90, CI do HEAD do PR #96, auditorias SQL Staging anteriores. **Estado:** NO-GO financeiro. **Objetivo:** sair de auditoria aberta para execução limitada e aceite mensurável.

## Estado comprovado

- #91 Draft (contrato contábil proposto); #92 Draft (contagem única); #93 Draft (snapshot/segurança); #95 Draft (plano); #96 Draft (regressões e auditorias); #94 fechado (não presumir merge).
- PR #96 HEAD `21defbfd0ef2675b7ead61057c13908fb9b886eb`: CI Lint, Typecheck, Tests, Build **4/4 success** (run 43443458236). Isso não é homologação financeira.
- Issue #90 aberta. Ledger pode somar `PAYMENT_APPROVED` e `RESTAURANT_RECEIVABLE` como duas bases de receita, caso ilustrativo R$ 97,02; teste caracteriza defeito, não corrige.
- Seis pedidos PIX históricos com divergência `orders.platform_fee` vs snapshot; nove pedidos sem snapshot no Staging (6 demo; 3 dinheiro da pizzaria-gula-staging). Não alterar histórico.
- Staging compartilhado sem isolamento de fixtures. Não executar inserções sintéticas nesse banco.

## Sequência de entrega — quatro blocos, com critérios de saída

### B1 — Contrato contábil e decisão (bloqueador)
Aprovar com responsável financeiro/técnico a semântica de `PAYMENT_APPROVED`, `RESTAURANT_RECEIVABLE`, receita da plataforma, saldo disponível, gateway fee, split, payout, refund e chargeback. Confirmar DEC-021, DEC-015, pagador da taxa e conflito com Documento Mestre. **Saída:** contrato assinado/registrado, sem ambiguidade de dupla base. Não pressupor aprovação a partir de PR documental.

### B2 — Correção mínima em branch isolada (bloqueador)
Aplicar somente alterações necessárias para impedir dupla contabilização por referência econômica e bases incompatíveis; impedir reconhecimento financeiro online sem snapshot autoritativo e conciliação; manter pedidos legados visíveis operacionalmente. Revisar writers service_role, triggers e idempotência. **Saída:** PR de implementação com diff restrito, testes novos e rollback; sem tocar em registros históricos.

### B3 — Validação (bloqueador)
Testes unitários + integração PostgreSQL isolada: R$ 29,99/30/30,01, pagador cliente/parceiro, R$50/R$1,49/R$48,51, pagamento PIX/cartão, idempotência, webhook duplicado, pedido sem snapshot, refund, chargeback, payout, dois restaurantes, RLS/RBAC, concorrência. CI 4/4 e homologação controlada no Staging após plano seguro de dados/ambiente. Conciliação Mercado Pago por identificador externo com evidência, sem inventar liquidação. **Saída:** evidências assinadas, sem divergência financeira material.

### B4 — Integração e piloto (bloqueador)
Revisar a cadeia de PRs #91→#92→#93→#96 e dependências #89/#87, validar base/mergeability/CI após cada integração, migrations na ordem e rollback. Teste smoke controlado após deploy; monitorar pagamento, pedido, split, ledger, benefícios e webhooks. **Saída:** GO financeiro e operacional documentado; só então abrir prospecção e tráfego.

## O que não bloqueia o piloto isoladamente

- Correção cosmética do histórico dos seis PIX sem pagamento aprovado nos registros consultados, desde que conciliação externa e relatórios sejam tratados.
- Refatoração ampla de checkout, redesign, recursos futuros de IA, e relatórios não essenciais.
- Migrar pedidos demo antigos para snapshots retroativos sem necessidade operacional comprovada.

## Pendências que impedem afirmar conclusão

1. **Contrato contábil ainda não homologado**.
2. **Duplicidade semântica do ledger não corrigida**.
3. **Testes PostgreSQL isolados + E2E Mercado Pago não comprovados**.
4. **PRs em Draft e migrations não aplicadas**.
5. **Documento Mestre integral e validação de decisões pendentes**.

**Próxima ação executável:** abrir implementação B2 apenas após aceite expresso do contrato B1, ou limitar trabalho à preparação de testes que não imponham fórmula contábil. Nenhuma alteração de produção, banco ou merge autorizada por este relatório.

**Gate Financeiro NO-GO.**
