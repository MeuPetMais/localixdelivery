# PERFORMANCE_GUIDE — Localix

Guia prático para manter a plataforma performática. Complementa
`ARCHITECTURE_BASELINE.md`. Toda otimização deve preservar regras de
negócio e passar pela suíte de testes.

## Frontend
- **Rotas**: nunca `export` de componentes em arquivos de rota — quebra o code-splitting automático do TanStack.
- **Listas**: usar `@tanstack/react-virtual` a partir de ~200 itens.
- **Imagens**: preferir `?format=webp` do Supabase Storage; `loading="lazy"` fora do LCP; `fetchpriority="high"` + preload no LCP.
- **Memoização**: `React.memo`, `useMemo`, `useCallback` apenas em componentes com re-render caro comprovado.
- **Assets**: importar SVG como componente; PNG apenas quando transparência for necessária.
- **Cache local**: React Query com `staleTime` explícito por query — nunca `0` para dados de catálogo/config.

## Backend (Server Functions)
- Ler `process.env.*` apenas dentro do `.handler()`.
- Paralelizar I/O independente com `Promise.all`.
- Reutilizar Services públicos — nunca duplicar lógica.
- Retornar DTOs simples (sem instâncias de classe, streams ou Response).

## Banco de Dados
- Toda query multi-tenant deve filtrar por `restaurant_id` no `WHERE` antes do RLS.
- Adicionar índice composto `(restaurant_id, created_at DESC)` para tabelas append-only (logs, timeline, ledger).
- Usar `LIMIT` + cursor (`created_at, id`) em vez de OFFSET.
- Views materializadas apenas quando o custo de refresh < ganho de leitura.
- `EXPLAIN ANALYZE` obrigatório antes de otimizar; medir, não adivinhar.

## Cache
- **Sempre** usar `platformCache` (`src/lib/platform-cache`) para novos caches.
- Chaves com namespace: `CacheNamespaces.kpi + restaurantId + ":" + key`.
- TTLs sugeridos:
  - Config/Feature flags: 60s
  - KPIs/Dashboards: 30s
  - Catálogo/Menu: 120s
  - Analytics agregado: 300s
- Invalidação: `platformCache.invalidatePrefix("cat:" + restaurantId)` ao mutar catálogo.

## EventBus
- Handlers devem ser idempotentes (chave = `eventId`).
- Retries: expor política no bus, não dentro do handler.
- Eventos críticos (order, payment, notification) preparados para fila durável — não adicionar side-effects que impeçam replay.

## Edge Functions / Webhooks
- Validar assinatura antes de qualquer trabalho.
- `Promise.all` para leituras independentes.
- Logs estruturados (`{ level, event, restaurant_id, latency_ms }`).
- Timeout máximo interno < 25s (buffer para o runtime).

## Escalabilidade
- Toda dependência de estado in-process (Map, Set, cache local) deve implementar a interface `CacheDriver` ou ser trivialmente substituível.
- Não usar `setInterval` global — usar cron (`pg_cron`).
- Não guardar sessão em memória de processo.

## Regras de Ouro
1. Medir antes de otimizar.
2. Nunca duplicar lógica em nome de performance.
3. Toda otimização acompanha teste que prova ausência de regressão.
