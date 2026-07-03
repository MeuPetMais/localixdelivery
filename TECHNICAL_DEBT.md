# Technical Debt

## Restaurant Settings (Prompt 13.7)

- **Legacy config em `restaurants.*`:** vários campos (delivery_fee,
  min_order, payment_methods, primary_color, avg_delivery_minutes) ainda
  são lidos diretamente em rotas legadas. Migrar para
  `RestaurantSettingsService.getGroup`.
- **Repositórios reais:** `EmployeeRepository` e `AdminAuditRepository`
  possuem apenas implementações in-memory nos testes. Ligar a
  `user_roles` + `owner_profiles` e `tenant_config_audit`.
- **Painel Admin:** `_authenticated/settings.tsx` ainda faz updates
  diretos no restaurante. Refatorar para consumir o facade.
- **Distribuição de cache:** cache do TenantConfiguration é in-memory por
  worker. Migrar para KV/Redis quando houver múltiplas instâncias.

## ERP Auditoria Final

- Testes de integração cross-domain (Order → Loyalty → Notifications →
  Settings) ainda não existem — cobertos apenas por testes unitários.
- Dependência cíclica potencial entre `NotificationCenter` e
  `restaurant-settings` deve ser mantida em uma direção só (Settings
  publica; NotificationCenter consome).

## Platform Administration (Prompt 14)

- [ ] Provisionar `platform_audit_log` + implementar
      `SupabasePlatformAuditRepository`.
- [ ] Provisionar `platform_incidents`, `platform_notifications`,
      `platform_moderation_events` para persistência real.
- [ ] Widgets de UI para Planos, Assinaturas, Moderação, Incidentes e
      Notificações Globais (Prompt 15).
- [ ] Enforcement de MFA para permissões de escrita críticas
      (`platform.tenants.suspend`, `platform.plans.write`,
      `platform.admins.write`).
- [ ] Repositórios Supabase para `EmployeeService` /
      `AdminAuditService` (herdado do Prompt 13.7, ainda pendente).

## Platform Configuration (Prompt 15)

- [ ] Provisionar `platform_feature_flags`, `platform_feature_flag_versions`,
      `platform_remote_config`, `platform_remote_config_versions`,
      `platform_kill_switches`, `platform_plan_overrides`,
      `platform_config_audit_log` e implementar repositórios Supabase.
- [ ] Painéis administrativos (Feature Flags / Rollouts / Kill Switches /
      Templates / Histórico) — atualmente só o facade está exposto.
- [ ] Enforcement automatizado dos permissions
      (`platform.feature_flags.write`, `platform.config.write`,
      `platform.plans.write`) nas server-functions de administração.
- [ ] Consumo do kill switch nos domínios sensíveis (Payment/Delivery/AI)
      via `platformConfiguration.killSwitch.assertOperational(...)`.
- [ ] Migrar overrides existentes de `platform_settings.feature_flags` para
      o novo domínio quando os repositórios Supabase estiverem prontos.
