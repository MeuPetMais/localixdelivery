# Gate 4 — Conciliação externa pontual do pagamento MP 174057974773

**Data:** 15/11/2026. **Ambiente:** Localix Production `mvkfrwxgneqzvoabkaws`. **Método:** consulta única autorizada e somente leitura; nenhuma atualização em banco, status, ledger ou Mercado Pago.

## Evidência do gateway (resultado sanitizado, enviado pelo proprietário)

Consulta autenticada executada via Edge Function temporária `gate4-prod-mp-single-read`, sob OAuth live do vendedor correto, respondeu:
- `lookup: MATCHED_SELLER`
- `payment_id: 174057974773`
- `collector_id: 3625464467`
- `external_reference: 7126fec9-aed1-4d77-aee3-db886c448a4f`
- `status: rejected`
- `status_detail: cc_rejected_high_risk`
- `amount: 5`; `currency: BRL`
- `date_created: 2026-08-21T15:53:52.000-04:00`

## Confronto com registros locais (consultas read-only)

- O `external_reference` identifica o pedido **nº 1079**, ID `7126fec9-aed1-4d77-aee3-db886c448a4f`, do restaurante `3714616d-7b69-4118-8ac3-57076a70212a`.
- Pedido: `status=cancelado`, `total=5.99`, `platform_fee=0.99`, `payment_method=credit_card`.
- `order_payment`: `status=CANCELLED`, `transaction_amount=5.99`, `payment_method=credit_card`, `last_error="Cancelled by customer before payment"`.
- `order_payment.payment_id` contém UUID interno, **não** coincide com ID MP `174057974773`; correlação é pela referência externa do pedido.
- Nenhum registro em `payments` por `order_id` ou `external_id` acima, nenhum lançamento em `financial_ledger` por `order_id` ou `reference_id`.
- Diferença entre `amount=5.00` no gateway e `transaction_amount=5.99` local. Coincide numericamente com a taxa de plataforma de R$0.99; **não está provado** por que a tentativa remota foi feita com valor diferente. Requer auditoria dirigida do payload original se for material.

## Resultado prudencial

**Fato:** gateway rejeitou o pagamento por `cc_rejected_high_risk`. O pedido está cancelado e não há crédito lançado para este pedido no ledger consultado. Não há evidência de pagamento aprovado ou valor a repassar nessa transação.

**Limites:** não se deve marcar o webhook como `processed=true` automaticamente, nem concluir que todos os eventos históricos estão resolvidos. `order_payment` local e gateway possuem rótulos distintos, mas ambos não indicam aprovação.

**Recomendação:** classificar este evento `6ae21bfe-20df-4763-9311-bd05fdb40e1a` como *conciliação remota comprovada: rejeitado; sem pagamento a creditar*, sujeito a decisão formal de encerramento administrativo do webhook. Confirmar que nenhum mecanismo atual promove pedidos cancelados após novos eventos. Investigar em separado a diferença de R$0,99 e os demais quatro eventos sem conciliação.

## Encerramento do diagnóstico

Após resultado remoto, a Edge Function temporária foi substituída pela versão **4**, com `verify_jwt=true`, que devolve **HTTP 410** em todas as solicitações, sem acesso a secrets, Supabase ou gateway. Ela continua catalogada como ACTIVE apenas no sentido de deploy do endpoint aposentado. Verificação de versão confirmada por lista de Edge Functions.

**Gate Financeiro:** permanece NO-GO. Nenhum teste de cobrança adicional executado. Nenhum segredo copiado.

**Esta decisão deve atualizar o Documento Mestre** quando aprovada como parte da conclusão financeira do Gate 4.
