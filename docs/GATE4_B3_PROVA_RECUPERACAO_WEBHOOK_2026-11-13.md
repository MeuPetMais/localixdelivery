# Gate 4 / B3 — Prova operacional sobre recuperação de webhook Mercado Pago
Data: 2026-11-13
Status: RECUPERAÇÃO E2E NÃO COMPROVADA; EVIDÊNCIA DE EVENTO PENDENTE CRÔNICO; FINANCEIRO NO-GO.

## Procedimento (somente leitura)
1. Inspecionado PR #98 Draft (fix/gate4-mp-webhook-pending-retry, CI 4/4 PASS no SHA dbbefeff97e439d3690bd8057ba7efff897cce9e). Esse PR diferencia processed=true de processed=false e retorna 503 na duplicata pendente, mas não instala worker/lease/recovery.
2. Consultadas tabelas public.payment_webhook_events e public.payment_event_queue do Supabase Staging dnotmvbhuqujvqdtgzav por SELECT; sem payload, tokens ou dados pessoais no relatório.
3. Consultados os cron jobs ativos e lista de Edge Functions do Staging.
4. Consultado código REAL implantado de Edge Function mp-webhook, versão 32, pela API de gestão Supabase.

## Evidência 1 — Dados do Staging
- Eventos de webhook: 2; não processados: 1.
- Itens na fila: 1, pendentes: 1, locked=true: 0.
- A fila aponta para o evento não processado (join por q.event_id=e.id), provider mercado_pago, event_type payment, action payment.created.
- Evento criado em 2026-08-12 18:21:12 UTC; fila criada em 2026-08-12 18:21:13 UTC; next_retry 2026-08-12 18:22:13 UTC. processing_attempts=1; retry_count=0; processed_at=null. Erro armazenado: mp_payment_not_found.
- Esses dados mostram recuperação pendente desde agosto; não provam estado atual do pagamento na API externa do Mercado Pago.

## Evidência 2 — Código implantado difere do PR #98
Staging Edge Function mp-webhook ACTIVE, versão 32, ainda contém:
```ts
if (duplicated) {
  return json({ ok: true, duplicated: true });
}
```
Assim, o código efetivamente implantado confirma uma duplicata sem consultar processed. A correção de PR #98 **não está implantada** no Staging inspecionado.
A CI 4/4 PASS demonstra validação estática/unitária do commit; não comprova recuperação de fila, nem deployment.

## Evidência 3 — Agendamento e consumidores
Cron job de pagamentos identificado: expire-pending-payment-orders (*/5 * * * *), função public.expire_pending_payment_orders(). Não é consumidor demonstrado de payment_event_queue.
O inventário de Edge Functions do projeto não contém uma função dedicada nomeada para worker da fila. Busca textual em pg_proc.prosrc (public/private/cron) não localizou referência a payment_event_queue. Isso **não prova** inexistência de worker externo ou job fora do projeto; comprova somente que nenhum foi identificado nas superfícies verificadas.

## Parecer
- Não foi possível provar recuperação ponta a ponta nem idempotência completa sob concorrência.
- Existe ocorrência pendente real no Staging sem evidência de processamento concluído.
- A ausência de worker demonstrado e o estado crônico exigem investigação antes de assumir que HTTP 503 induzirá recuperação.
- O PR #98 é melhora de comportamento para duplicatas pendentes, mas NÃO representa solução de reprocessamento confiável.
- Nenhum reprocessamento de evento real, escrita, atualização, merge, migration, deploy ou alteração em produção realizada.

## Próxima implementação indispensável (sujeita a revisão)
1. Identificar e homologar mecanismo de consumo da payment_event_queue, com claim atômico e lease ou fila transacional de tarefas; marcar processed somente ao concluir.
2. Garantir retomada de registros processed=false, inclusive refund_incomplete, sem criar dois efeitos financeiros. Implementar backoff, métricas e alertas.
3. Testar com fixtures isoladas: falhas MP, webhooks duplicados simultâneos, fora de ordem, atraso de callback, refund parcial/total, chargeback e timeout, com comparação das identidades econômicas.
4. Conferir situação do evento histórico diretamente no gateway antes de qualquer tentativa de reprocessar ou conciliar.
5. CI final 4/4 no SHA integrado, homologação em Staging sob autorização específica, DEC-021 contábil aprovada e GO formal separado.

**Gate Financeiro: NO-GO. Issue #90 aberta. Documento Mestre: atualizar após decisão aprovada.**
