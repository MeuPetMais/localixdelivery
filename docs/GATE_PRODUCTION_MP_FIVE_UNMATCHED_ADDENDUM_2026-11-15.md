# Complemento forense — 5 notificações MP sem vínculo local

**Data:** 2026-11-15. **Projeto:** Supabase Production `mvkfrwxgneqzvoabkaws`. **Modo:** somente leitura.

## Achados
- 3 dos 5 eventos `no_access_token` ocorreram em 30 e 31/07/2026, **antes da primeira conexão atualmente registrada** para as duas contas Mercado Pago (17/08/2026). Não afirmar que não havia outra conexão histórica.
- 2 eventos ocorreram em 21/08/2026, após a primeira conexão atual.
- 1 evento de 21/08 contém `payload_json.user_id` compatível com uma das contas conectadas **no banco**. Este é o primeiro candidato para uma pesquisa **somente leitura** `GET /v1/payments/{resource_id}`, executada via token OAuth **daquela conta**, sem exportar token e sem fallback de credenciais.
- Outro evento de 21/08 não contém `user_id` nem `external_reference` na notificação persistida: não inferir qual vendedor deve ser consultado.
- Dois eventos antigos contêm `user_id` mas não correspondem a conta atualmente conectada. O quinto evento antigo não possui `user_id`.
- Nenhum dos cinco tem correspondência por `resource_id` nas tabelas locais de pagamentos verificadas.

## Risco e decisão
A ausência de token nas notificações históricas pode ser consequência de integrações anteriores ou de impossibilidade de atribuir a um vendedor. **Não foi possível provar**. Não executar worker, não escolher credenciais por conveniência, não marcar eventos como processados, não criar lançamentos contábeis.

## Próximo passo finito
Priorizar **1 única pesquisa remota autenticada** para o evento de 21/08 com seller explicitamente correspondente. Exigir resultado sanitizado com status HTTP, ID, collector_id, external_reference, valor, status e momento da transação. Verificar que `collector_id` corresponde ao seller OAuth selecionado antes de qualquer avaliação de conciliação. Sem ferramenta segura read-only disponível em Production, preparar código para revisão, mas não implantar sem autorização específica de produção. Os quatro restantes dependem de identificação independente da conta.

**Gate Financeiro NO-GO**, sem impacto remoto nesta etapa.
