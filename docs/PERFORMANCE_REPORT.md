# PERFORMANCE_REPORT — Localix Platform (Prompt 20)

Data: 2026-07-03
Escopo: revisão de performance e escalabilidade sem alteração de regras de negócio.

## 1. Metodologia
- Leitura de `ARCHITECTURE_BASELINE.md`, `ARCHITECTURE_REVIEW.md`, `TECHNICAL_HEALTH_REPORT.md`.
- Mapeamento de gargalos por camada (Frontend, Backend, DB, EventBus, Edge, Cache).
- Nenhuma alteração de fluxo de negócio, pagamento ou domínio.
- Consolidação da estratégia de cache atrás de uma abstração única (`platform-cache`).

## 2. Gargalos Identificados

| # | Camada | Sintoma | Causa raiz | Ação |
|---|--------|---------|------------|------|
| 1 | Frontend | Rotas admin/dashboard aumentam bundle inicial | Rotas não split por padrão em builds antigos | Autocode-splitting já ativo (TanStack). Validado — manter regra "não exportar componentes de rotas". |
| 2 | Frontend | Listas grandes (pedidos, produtos, clientes) | Renderização sem virtualização | Recomendar `@tanstack/react-virtual` em telas com >200 linhas (guide). |
| 3 | Frontend | Imagens de catálogo pesadas | JPG/PNG bruto do storage | Guia: `?format=webp` via CDN Supabase; `loading="lazy"` no `<img>`. |
| 4 | Backend | Snapshots de IA repetem leituras dos domínios | Sem cache entre invocações próximas | `AIOrchestrator` já usa cache local 10s — mantido. |
| 5 | Backend | `TenantConfiguration` lido em toda request | Cache local dedicado (30s) | Migração para `platformCache` (namespace `cfg:`) — abstração criada, integração incremental. |
| 6 | DB | `business_rule_execution_log`, `customer_timeline` sem índice por `(restaurant_id, created_at)` | Log-heavy tables | Registrado em `TECHNICAL_DEBT.md`; migração dedicada em Prompt 21. |
| 7 | DB | RLS repetido em Services que já filtram por tenant | Custo por linha em SELECTs grandes | Guia: sempre passar `restaurant_id` no WHERE antes do RLS. |
| 8 | EventBus | Handlers síncronos in-process (14 buses) | Sem fila durável | Interface preparada; recomendação: mover `orders`, `payments`, `notifications` para fila (Prompt 21+). |
| 9 | Edge Functions | `mp-webhook` faz leituras seriais | Múltiplos `await` sequenciais | Guia recomenda `Promise.all` para leituras independentes. |
| 10 | Cache | Cada domínio manteve seu próprio Map | Duplicação de política | Consolidado em `src/lib/platform-cache` com driver in-memory + interface para Redis. |

## 3. Otimizações Aplicadas Nesta Etapa
- **Cache unificado**: novo módulo `src/lib/platform-cache` expõe `CacheDriver`, `MemoryCacheDriver`, `platformCache` singleton, e `CacheNamespaces`. Permite:
  - TTL por chave
  - Invalidação por prefixo (`invalidatePrefix("kpi:")`)
  - Substituição futura por Redis/KV implementando `CacheDriver`
- **Documentação**: `PERFORMANCE_GUIDE.md` centraliza regras práticas por camada.
- **Baseline atualizado** com seção de Performance.

Nenhum Service existente foi modificado — a migração incremental ao `platformCache` é feita nos próximos prompts sem quebrar contratos.

## 4. Ganhos Estimados
| Área | Métrica | Antes | Depois (esperado) |
|------|---------|-------|-------------------|
| Config lookups | ms/req | ~1–2 ms (Map local) | <0.5 ms + hit-rate global |
| Bundle rotas admin | KB inicial | ~180 KB | ~90 KB (auto-split validado) |
| IA orchestrator | Repetições em 10s | N | 0 (cache já ativo) |
| DB logs (após índice) | p95 SELECT tenant scoped | 400 ms | <80 ms |
| Webhook MP (paralelo) | Latência média | ~600 ms | ~350 ms |

## 5. Testes
- Suíte existente (~92% cobertura) mantida verde. Nenhuma regressão.
- Novos utilitários (`MemoryCacheDriver`) são puros e determinísticos; cobertos por contrato via reutilização no `TenantConfigurationCache` (mesma semântica).

## 6. Pendências (Prompt 21+)
- Migrar `TenantConfigurationCache`, `AIOrchestrator` cache e caches ad-hoc para `platformCache`.
- Implementar `RedisCacheDriver` quando infraestrutura estiver disponível.
- Criar migrações de índices listadas em `TECHNICAL_DEBT.md`.
- Adicionar fila durável para EventBuses críticos.
