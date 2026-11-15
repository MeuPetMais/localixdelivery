# Gate 4 — Mercado Pago: worker de recuperação (PR #99)
Data de preparação: 2026-11-13.
Estado: IMPLEMENTAÇÃO EM DRAFT; CI E HOMOLOGAÇÃO E2E OBRIGATÓRIAS. Gate Financeiro NO-GO.

## Escopo técnico entregue
- `supabase/functions/mp-webhook-retry/index.ts`: POST autenticado por segredo próprio, lote máximo de cinco tickets, reivindicação condicional `locked=false -> true`, compare-and-swap em `payment_webhook_events.processing_attempts` e `updated_at`, timeout de 30 s, verificação do campo `processed=true` após retorno do receiver, backoff exponencial (1, 2, 4, 8, 16, 32 min), seis tentativas, status `failed` depois do limite.
- `supabase/functions/mp-webhook/index.ts`: replay de evento **já persistido**, apenas com `MP_WEBHOOK_REPLAY_SECRET`; nenhuma inserção nova via replay. O webhook mantém verificação da associação e consulta ao Mercado Pago. Duplicata não processada sem credencial interna continua HTTP 503; processada já recebe 200.
- `refund_incomplete` passa a gerar ticket de recuperação na primeira recepção, e o replay não enfileira outro ticket pelo mesmo caminho.
- `.github/workflows/mp-webhook-retry.yml`: programação de cinco em cinco minutos preparada e protegida por secrets do GitHub; **não ativa em PR Draft**, somente após merge autorizado em main, segredos configurados e Edge Functions implantadas. `workflow_dispatch` também exige autorização específica.
- Sem migrations, nenhum ledger histórico foi reescrito.

## Variáveis necessárias (nomes; NÃO registrar valores no repositório)
- Supabase Edge Function `mp-webhook-retry`: `MP_WEBHOOK_RETRY_WORKER_SECRET`, `MP_WEBHOOK_REPLAY_SECRET`, `MP_WEBHOOK_RETRY_CUTOVER`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase Edge Function `mp-webhook`: `MP_WEBHOOK_REPLAY_SECRET` igual ao do worker.
- GitHub Actions: `LOCALIX_MP_RETRY_WORKER_URL` (URL HTTPS do worker aprovado) e `LOCALIX_MP_RETRY_WORKER_SECRET` (mesmo valor de `MP_WEBHOOK_RETRY_WORKER_SECRET`).
- `MP_WEBHOOK_RETRY_CUTOVER` deve ser data ISO 8601 futura ou de início de homologação. Sem valor válido, worker responde 503 e não processa tickets. Tickets criados antes do corte não são selecionados nem têm locks alterados. Em particular, o evento de 12/08/2026 precisa de **conciliação manual autorizada**.

## Homologação exigida antes de ativar agendamento
1. Ambiente PostgreSQL isolado ou Supabase branch isolada, com dados 100% sintéticos e as policies/triggers reais, sem pagamentos externos.
2. Simular 2 workers simultâneos sobre um evento, verificar um único CAS, lançamento único por referência e inexistência de dupla transição de pedido. Medir lease expirado, crash após CAS, timeout durante HTTP, duplicata após status concluído e entrada fora de ordem.
3. Simular `refund_incomplete`, chargeback, pagamento com gateway indisponível, `mp_payment_not_found`, backoff e status `failed`.
4. Validar segredos: POST não autorizado recebe 401; configuração ausente responde 503; replay não autenticado nunca processa evento pendente; replay não cria evento novo.
5. Validar que `updated_at` das duas tabelas é atualizado por triggers (observado no Staging em consulta anterior). Conferir `processing_attempts` não nulo. Revisar comportamento da fila no PostgreSQL sob `READ COMMITTED`.
6. Validar `MP_WEBHOOK_RETRY_CUTOVER` e ausência de seleção dos tickets legados; conciliar evento histórico com o Mercado Pago antes de qualquer replay.
7. PR com Lint, Typecheck, Tests e Build 4/4 PASS no SHA final. Homologar deploy em staging **com autorização específica**, inicialmente sem cron, observando comportamento de logs, fila e pedidos.
8. Autorizar separadamente merge, deploy/produção, configuração de secrets e ativação do agendamento somente com GO financeiro/contábil.

## Limites conhecidos e rollback
- Compare-and-swap e TTL são proteções de concorrência, mas **não provam** exactly-once ponta a ponta; o gateway e os writers devem continuar idempotentes. Replay de evento persistido não equivale a confirmação de liquidação.
- `processing_attempts` monitora claims de eventos; `retry_count` monitora tickets. Estado `failed` exige alerta e intervenção humana, nunca exclusão do evento.
- O worker responde erro quando faltam credenciais e não inclui dados financeiros ou segredos na resposta.
- Se houver anomalia após liberação autorizada: desabilitar o workflow de agendamento, revogar `MP_WEBHOOK_RETRY_WORKER_SECRET`, bloquear rota do worker e restaurar versão anterior das Edge Functions. **Não** truncar Ledger ou limpar fila como forma de rollback.
- Estado atual: nenhuma variável de ambiente criada, nenhuma execução da fila, nenhuma Edge Function implantada. PR Draft e Gate Financeiro NO-GO.

Esta decisão deve atualizar o Documento Mestre após aceite técnico-financeiro e conciliação.
