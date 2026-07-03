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
