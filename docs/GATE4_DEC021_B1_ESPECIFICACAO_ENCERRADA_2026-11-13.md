# Gate 4 / DEC-021 — Encerramento da etapa de especificação técnica (B1 documental)
Data: 2026-11-13
Status: ESPECIFICAÇÃO DOCUMENTAL CONCLUÍDA; ACEITE CONTÁBIL PENDENTE; GATE FINANCEIRO NO-GO
Issue: #90. PRs: #93, #95, #96, #97. Mudanças: nenhuma no runtime, banco, pagamentos ou produção.

## 1. Fonte e escopo
Consolidado a partir de DEC-021 (PR #94), do termo de aceite parcial e das auditorias do PR #96, do diagnóstico do PR #93 e da proteção inicial do PR #97. O Documento Mestre integral permanece sem confronto conclusivo; confirmar antes de qualquer aprovação estrutural.

### Fatos comprovados
- Mercado Pago principal e taxa comercial R$ 0,99 até R$ 30,00 (inclusive), R$ 1,49 acima, conforme política confirmada. Snapshot do pedido é a composição esperada e não prova de liquidação.
- Em computeBalance, PAYMENT_APPROVED e RESTAURANT_RECEIVABLE são ambos positivos. Caso sintético PAYMENT_APPROVED=50, RECEIVABLE=48,51, PLATFORM_FEE=1,49 retorna 97,02: duplicação de bases econômicas.
- PR #93 obteve CI 4/4 para b15e31c6; PR #96 obteve CI 4/4 para 3e32ac14. PR #97 ainda carece de CI comprovada no e0da94ce.
- PR #97 barra duplicidade de referências completas no lado de leitura. Não resolve reconhecimento contábil nem idempotência dos escritores.
- Auditoria staging identificou seis PIX históricos com orders.platform_fee=1,46 vs snapshot.platform_fee=0,99; nenhum pagamento aprovado nas linhas relacionadas consultadas. Não prova inexistência de liquidação externa.
- Trigger de orders calcula faixa por NEW.total, enquanto PricingEngine usa subtotal; não corrigir por troca para NEW.subtotal: coluna não existe em orders.
- Branch isolada Supabase foi bloqueada pelo plano, conforme auditoria; testes de escrita no staging compartilhado não substituem isolamento.

## 2. Contrato por fato econômico — proposta, NÃO aprovada
| Conceito | Fonte de evidência | O que NÃO significa | Aceite pendente |
|---|---|---|---|
| Preço esperado | order_pricing_snapshot server-side | valor recebido | Técnico |
| Pagamento aprovado | captura confirmada e identificada pelo Mercado Pago | receita inteira da plataforma ou saldo disponível | Financeiro |
| Receita Localix | direito contratual de taxa + snapshot + operação efetiva | pagamento bruto inteiro | Financeiro/Contábil |
| Recebível parceiro | direito conforme contrato e liquidação | nova cobrança independente | Financeiro/Contábil |
| Taxa gateway | cobrança efetiva do provedor | estimativa zero | Financeiro |
| Split / application_fee | confirmação verificável no gateway | mero payment_split COMPLETED | Financeiro |
| Payout / caixa | transferência e liquidação verificadas | intenção de repasse | Financeiro/Contábil |
| Refund / chargeback | identidade e efeito financeiro confirmado | webhook repetido = novo débito | Financeiro |
| Benefits | concessão/resgate rastreáveis uma vez | receita ou desconto duplicado | Técnico/Financeiro |

Invariante APROVADA SOMENTE EM PRINCÍPIO: pagamento bruto e recebível não podem participar duas vezes da mesma base econômica. A igualdade 50=48,51+1,49 é ilustrativa, NÃO fórmula universal; depende de pagador da taxa, encargos, descontos, benefícios e liquidação.
Não promover netBalance legado a caixa, saldo disponível ou saldo contábil.

## 3. Patch mínimo B2 — especificação de execução
A. Identificar e documentar os writers de PAYMENT_APPROVED, RESTAURANT_RECEIVABLE, PLATFORM_FEE, GATEWAY_FEE, REFUND, CHARGEBACK e PAYOUT e as respectivas chaves econômicas. Não presumir deduplicação de lançamentos sem reference_id.
B. Antes de apresentar indicadores, falhar em bases mistas que não disponham de reconhecimento aprovado; manter pedido visível operacionalmente e não atribuir zero ou saldo falso.
C. Após aceite, implementar agregação por indicador (cobrança, receita Localix, recebível, saldo) sem somar dimensões incompatíveis; não excluir nem reescrever linhas append-only. Separar correção do dashboard da persistência do Ledger.
D. Garantir idempotência transacional nos writers Mercado Pago e não apenas no read guard; preservar segregação de tenant e currency e políticas RLS.
E. Só revisar trigger de taxa após comprovar atomicidade order + snapshot e todos os writers/consumidores, sem utilizar coluna subtotal inexistente.

## 4. Matriz de aceite executável B3
FIN-01: 50,00/48,51/1,49 — impedir saldo 97,02; não inferir novo saldo sem base aprovada.
FIN-02: 29,99 / 30,00 / 30,01 — limites de taxa e snapshots.
FIN-03: customer / restaurant como pagador; nunca deduzir duas vezes taxa já líquida.
FIN-04: duas capturas parciais de um único order_id = um pedido no KPI.
FIN-05: dois restaurantes, multi-moeda, JWT owner/admin/terceiro/anônimo; negar cross-tenant.
FIN-06: webhooks Mercado Pago simultâneos, repetidos e fora de ordem com identidade transacional e unicidade no banco.
FIN-07: refund parcial/total e chargeback confirmados, sem dupla reversão e sem exceder captura.
FIN-08: payout e split confrontados com comprovantes efetivos, não somente status interno.
FIN-09: Benefits concedidos/resgatados uma vez, sem dupla receita/desconto.
FIN-10: pedido sem snapshot não participa de indicadores financeiros autoritativos.
FIN-11: RPC de snapshot no PostgREST com JWT real, 50.001 linhas, timeout, schema cache, falha explícita, consistência concorrente.
FIN-12: seis PIX históricos divergentes: conciliar referência gateway, snapshot, ledger e possíveis consumidores do campo legado antes de qualquer intervenção.
FIN-13: checkout → pedido → pagamento → webhook → status → split → financeiro ponta a ponta para PIX e cartão.
FIN-14: rollback documentado de app e migrations, métricas de duplicidade, alerta e conciliação pós-deploy.
FIN-15: Lint, Typecheck, Tests e Build PASS no SHA final de integração.
FIN-16: parecer GO independente técnico/financeiro/contábil e autorização específica de produção.

## 5. Ordem, dependências e critérios de saída
B1 (esta etapa): diagnóstico, fontes, regras aprovadas vs propostas, matriz B2/B3 e riscos documentados — CONCLUÍDO DOCUMENTALMENTE.
B1 aceite econômico/contábil: NÃO CONCLUÍDO; assinatura/registro responsável técnico, financeiro e contábil ainda necessários.
B2: correção em PR isolado, sem alterar histórico, aprovada após B1 contábil.
B3: banco isolado e E2E gateway/sandbox; evidências e CI final.
B4: revisão/merge das dependências, migrations, staging, monitoramento, autorização explícita de produção e GO.

Aprovação parcial da DEC-021 NÃO autoriza implementação, merge, migração, deploy, reprocessamento, pagamentos reais ou produção. Issue #90 aberta. Gate Financeiro: NO-GO.

**Esta decisão deve atualizar o Documento Mestre** depois do aceite e da conciliação formal.
