# DEC-023 — Homologação financeira real controlada (PROPOSTA)

- **Data:** 2026-11-15
- **Status:** PROPOSTA — NÃO APROVADA PARA COBRANÇAS, MERGE OU DEPLOY DE CÓDIGO FINANCEIRO
- **Problema:** tentativa de PIX em ambiente isolado TEST foi rejeitada por `user_allowed_only_in_test`; sucessivas tentativas não produziram evidência E2E.
- **Contexto:** Localix opera múltiplos estabelecimentos com Mercado Pago OAuth e split. O Gate 4 permanece NO-GO. Há dois recursos históricos sem conciliação externa aguardando atendimento WCS.

## Opções consideradas
A. Persistir em testes MP TEST sem mudança de evidência (rejeitada por repetição sem prova nova).
B. Encerrar o Gate por testes locais, sem liquidação (rejeitada, insuficiente).
C. Homologação real LIVE com transação única de baixo valor após reparos e autorização específica (RECOMENDADA, CONDICIONAL).
D. Implantar correções no gateway antes de validar as guardas de acesso (rejeitada).

## Decisão proposta
Criar trilha Gate 4B **sem permitir pagamento nesta fase**. Primeiro corrigir e demonstrar, em ambiente isolado, controles de autenticação/autorização por pedido e o tratamento de reembolso/chargeback. Depois exigir testes, build, auditoria de RLS, migrações (se houver), validação de idempotência e plano de rollback. Apenas então propor ao responsável uma **única transação real limitada**, usando vendedor LIVE autorizado e comprador real distinto, com teto explicitamente aprovado e sem disponibilizar ao público. O histórico WCS segue em conciliação paralela, sem descarte.

## Motivo
Uma liquidação verificada no ambiente real pode comprovar a cadeia financeira que o ambiente TEST bloqueou, sem relaxar controles de segurança ou inventar certificação.

## Impactos
Checkout, OrderService, PricingEngine, PaymentService, Supabase, banco de dados, RLS/RBAC, RPCs, triggers, webhooks, MP, Localix Benefits, parceiros, clientes, entregadores e painel administrativo exigem análise de regressão baseada no diff. Sem alterar regras de preços ou de remuneração neste estágio.

## Riscos
Cobrança duplicada, reembolso não autorizado, transição indevida de status, ledger inconsistente, pagamento sem pedido, pedido sem pagamento, eventos históricos reprocessados, divergência de taxa, credenciais expostas. Exigir sandbox, replay controlado e rollback antes de qualquer LIVE.

## Condição para revisão / aceite
Revisar quando controles P0/P1 estiverem corrigidos e provados, CI reproduzível aprovado, autorização do vendedor confirmada, saldo e split reconciliáveis e responsável aprovar teto financeiro e execução específica. Gate 4 continua NO-GO até prova E2E e aceite formal.

**Esta decisão deve atualizar o Documento Mestre** após aprovação, não antes.
