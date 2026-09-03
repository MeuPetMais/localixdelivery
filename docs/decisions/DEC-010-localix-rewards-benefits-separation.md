# DEC-010 — Separação entre Localix Rewards e Localix Benefits

**Data:** 03/09/2026  
**Status:** Aprovada para implementação em staging; produção condicionada aos gates financeiros e de reversão.

## Problema
O Localix precisa incentivar recompra e recorrência sem duplicar carteiras, saldos, pontos financeiros ou regras de benefício já existentes. Misturar mérito comportamental, fidelidade do parceiro e crédito financiado pelo Localix aumentaria o risco de benefício duplicado, divergência de saldo, dificuldade de auditoria e acoplamento entre Growth e Checkout.

## Contexto
O Localix já possui Loyalty com semântica de fidelidade configurada pelo estabelecimento e Coupons como ferramenta promocional do parceiro. A fundação Localix Benefits foi criada para controlar economicamente créditos financiados pelo Localix, incluindo orçamento, saldo, reserva, resgate, expiração, ledger e idempotência. O Growth precisa agora identificar quando um consumidor conquistou uma recompensa a partir de comportamento mensurável, inicialmente pedidos concluídos.

## Opções consideradas
1. Reutilizar Loyalty como carteira e motor do Localix Rewards.
2. Criar uma terceira carteira financeira específica para Rewards.
3. Separar mérito/progresso de valor econômico: Rewards decide por que e quando a recompensa foi conquistada; Benefits controla o crédito e todo o ciclo financeiro.

## Decisão
Adotar a opção 3.

**Localix Rewards é a camada de mérito, regras e progresso comportamental.** Ela registra programas, ciclos, pedidos qualificados, metas atingidas e o evento de conquista.

**Localix Benefits é a infraestrutura econômica central dos benefícios financiados pelo Localix.** Ela controla campanha financeira, orçamento, concessão, saldo, reserva, resgate, expiração, reversões e ledger.

**Loyalty e Coupons permanecem domínios separados**, com suas semânticas atuais de fidelidade e promoção do estabelecimento.

O Rewards não manterá uma carteira monetária própria. Ao atingir uma meta válida, o Rewards chama `benefits_grant` de forma server-side e idempotente.

## Motivo
A separação reduz duplicação financeira, concentra invariantes críticas em um único domínio econômico, preserva as responsabilidades de Loyalty/Coupons e permite evoluir o Growth Engine sem acoplar regras comportamentais ao Checkout ou ao Mercado Pago.

## Impacto
- Novo domínio `reward_programs`, `customer_reward_progress` e `reward_progress_events`.
- A identidade primária do consumidor é o usuário global autenticado (`customer_profiles` / `orders.customer_id`), não o CRM `customers.id` do estabelecimento.
- O primeiro evento elegível é `ORDER_COMPLETED`, correspondente ao pedido em estado `concluido`.
- O valor da recompensa é definido pela campanha no Benefits, nunca por parâmetro livre do frontend.
- Checkout, PricingEngine, PaymentService, split e Mercado Pago não são alterados pelo RW-1 Core.

## Riscos
- Evento `OrderCompleted` duplicado ou concorrente.
- Refund/chargeback posterior à qualificação ou concessão da recompensa.
- Fraude por múltiplas contas, pedidos artificiais ou conluio cliente/parceiro.
- Dependência futura de um mecanismo durável para encaminhar transições de pedido ao Rewards.
- Divergência se Rewards e Benefits forem ativados/desativados sem coordenação operacional.

## Controles
- Kill switches independentes para Rewards e Benefits.
- Idempotência por programa/pedido e por programa/cliente/ciclo.
- Execução financeira somente server-side/service role.
- RLS nas tabelas do Rewards.
- Concessão econômica exclusivamente via `benefits_grant`.
- `max_cycles`, janela de vigência e pedido mínimo configuráveis.

## Condição para revisão
Revisar esta decisão se o Localix alterar o modelo de financiamento dos benefícios, transformar Rewards em moeda/pontos com valor financeiro próprio, permitir financiamento compartilhado com parceiros, ou introduzir um modelo econômico que torne inadequada a separação atual entre mérito e carteira.

---

**Esta decisão deve atualizar o Documento Mestre.**
