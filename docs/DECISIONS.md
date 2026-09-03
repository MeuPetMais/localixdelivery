# Architecture Decisions

## 2026-07-03 — Restaurant Settings Domain (Prompt 13.7)

- **Decision:** o Restaurant Settings & Administration Domain é implementado
  como camada de facade sobre o `TenantConfigurationService`, sem criar novas
  tabelas ou duplicar validação.
- **Rationale:** o serviço tenant já cobre cache, versioning, audit e
  validation. Duplicar esses componentes violaria o princípio de
  reutilização e criaria dois caminhos de escrita para as mesmas tabelas.
- **Consequences:** todo consumo de configuração passa por
  `RestaurantSettingsService.getGroup` / `updateGroup`. Módulos legados que
  ainda leem `restaurants.*` devem migrar gradualmente (ver TECHNICAL_DEBT).

## 2026-07-03 — Employee model reutiliza `user_roles` + `owner_profiles`

- **Decision:** funcionários e permissões continuam sob `user_roles`
  (SECURITY DEFINER `has_role`) com metadados em `owner_profiles`.
- **Rationale:** evita nova tabela `employees` redundante; a matriz de
  papéis vive no código (`PermissionRegistry`), o que permite iteração
  rápida sem migrations.

## 2026-07-03 — Encerramento do ERP Restaurante

- Prompt 14 (Admin Dashboard) assume a existência dos domínios
  Payments, Orders, Delivery, Inventory, Recipes, Production, Cost,
  Purchasing, Finance, Product, Customer, Restaurant Settings.

## Prompt 14 — Platform Administration Domain

- Domínio implementado como camada de serviços puros; nenhuma migration
  adicionada para evitar retrabalho quando as tabelas dedicadas
  (`platform_audit_log`, `platform_incidents`, `platform_notifications`,
  `platform_moderation_events`) forem projetadas em conjunto com o
  Prompt 15.
- RBAC administrativo é aditivo: continua exigindo `has_role('admin')`
  nas server-functions; os 6 papéis novos são camada extra de
  autorização in-domain.
- Catálogo de planos vive em código (fonte-única determinística); overrides
  poderão ser persistidos em `platform_settings` sem quebrar consumidores.

## Prompt 15 — Platform Configuration & Feature Flag System

- Configuração global fica **fora** do `TenantConfigurationService` para
  preservar isolamento por tenant: TenantConfig continua RLS-scoped por
  restaurante; PlatformConfig é global/plano/ambiente/canal.
- Rollout gradual usa hash FNV-1a determinístico sobre
  `${flagKey}:${bucketKey}` para garantir estabilidade entre chamadas e
  distribuição uniforme.
- Kill switch é dimensão ortogonal ao status da flag — quando ativo, força
  desligado independentemente de targeting/default/rollout.
- Histórico e auditoria são append-only (`Object.freeze`) para impedir
  reescrita de decisões passadas.
- Sem migrations neste prompt: os repositórios in-memory são substituíveis
  por implementações Supabase quando as tabelas dedicadas forem projetadas
  junto com o Prompt 16.

## Prompt 24 — Go Live & Production Readiness

- Nenhuma mudança de código; somente documentação final.
- Rollback é atômico (frontend + server functions no mesmo bundle);
  migrations continuam forward-only e exigem correção via nova migration.
- Kill switch é o mecanismo preferencial de rollback de features
  protegidas por flag (evita rollback de release inteiro).
- Observability e EventBus permanecem in-process em v1.0; persistência
  durável fica formalmente registrada como pré-requisito de v1.1.

## 2026-09-03 — DEC-010 — Separação entre Localix Rewards e Localix Benefits

- **Decision:** Localix Rewards controla mérito, regras e progresso comportamental; Localix Benefits é a infraestrutura econômica dos créditos financiados pelo Localix.
- **Rationale:** evita uma terceira carteira financeira, concentra saldo/orçamento/reserva/resgate em Benefits e mantém Loyalty/Coupons com suas semânticas próprias.
- **Consequences:** ao atingir uma meta, Rewards chama `benefits_grant` server-side e idempotentemente; Rewards não mantém saldo monetário próprio.
- **Status:** aprovada para staging; produção condicionada aos gates de reversão/refund/chargeback e integração durável de eventos de pedido.
- **Detalhes:** `docs/decisions/DEC-010-localix-rewards-benefits-separation.md`.

## 2026-09-03 — DEC-011 — Eventos financeiros de Rewards usam fila durável no banco

- **Decision:** mudanças relevantes de `orders.status` persistem eventos em `reward_order_event_queue`; efeitos econômicos são processados depois por worker idempotente com retry e `FOR UPDATE SKIP LOCKED`.
- **Rationale:** o EventBus in-process não é fonte durável suficiente para concessão ou reversão de crédito, e executar Benefits dentro da transação do pedido aumentaria o acoplamento e o risco operacional.
- **Consequences:** o trigger de pedido apenas enfileira; o worker chama Rewards/Benefits. Falha de Rewards não impede a transição do pedido e pode ser reprocessada.
- **Status:** aprovada e validada em staging; produção ainda não liberada.
- **Detalhes:** `docs/decisions/DEC-011-rewards-durable-order-events.md`.
