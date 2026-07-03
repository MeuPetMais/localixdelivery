# Platform Configuration & Feature Flag System

Domínio central de configuração da plataforma Localix. Toda configuração
global — feature flags, remote config, kill switches, recursos por plano,
templates — deve ser consumida através deste domínio; nenhum módulo pode
manter configurações isoladas.

## Escopo

- **Feature Flag Engine** com targeting por plano, tenant, ambiente, região,
  canal e rollout gradual determinístico (0/1/5/10/25/50/100%).
- **Remote Config** com valores versionados e targeting equivalente.
- **Kill Switch** global para os domínios sensíveis (payments, delivery,
  promotions, marketplace, ai, analytics, notifications).
- **Plan Features** — overrides aditivos sobre `PlanCatalogService`.
- **Versionamento imutável** de flags e configs (histórico frozen).
- **Auditoria** append-only com motivo, autor, data e diff.
- **Event Bus** publicando `FlagChanged`, `FlagKilled/Revived`,
  `FlagRolledBack`, `RemoteConfigChanged`, `PlanFeaturesUpdated`,
  `KillSwitchToggled`.
- **Cache** in-process (TTL 5s) invalidado automaticamente em cada escrita.

## Reutilização

- `PlanCatalogService` / `PlatformPermissionRegistry` do domínio Platform
  Administration (Prompt 14).
- `TenantConfigurationService` continua sendo a fonte de verdade para
  configurações **por tenant**; este domínio é a fonte de verdade para
  configurações **globais/plano/ambiente/canal**.
- Nenhuma tabela nova; persistência real deverá ser plugada via repositórios
  Supabase quando `platform_feature_flags`, `platform_remote_config`,
  `platform_config_audit_log` forem provisionados.

## Módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `types.ts` | Flags, remote config, kill switch, contexto de avaliação, eventos |
| `rollout.ts` | Bucketing determinístico FNV-1a (0..99) |
| `FeatureFlagEngine.ts` | Avaliação pura de flags |
| `FeatureFlagService.ts` | CRUD + versionamento + rollback + kill switch por flag |
| `RemoteConfigService.ts` | Valores versionados + resolve com targeting |
| `KillSwitchService.ts` | Kill switches por domínio |
| `PlanFeatureService.ts` | Overrides de features por plano |
| `PlatformConfigAuditService.ts` | Auditoria append-only frozen |
| `PlatformConfigEventBus.ts` | Barramento de eventos |
| `ConfigurationTemplateService.ts` | Templates/snapshots de configuração |
| `PlatformConfigurationService.ts` | Facade central + `platformConfiguration` singleton |

## Consumo típico

```ts
import { platformConfiguration } from "@/lib/platform-config";

if (platformConfiguration.isFeatureEnabled("checkout.v2", { tenantId, plan, environment: "prod" })) {
  // ...
}

const timeoutMs = platformConfiguration.remoteConfig.resolve<number>(
  "checkout.timeout_ms", { plan }, 3000,
);

platformConfiguration.killSwitch.assertOperational("payments");
```

## Permissões

Todas as mutações exigem `platform.feature_flags.write` /
`platform.config.write` / `platform.plans.write` do RBAC do domínio
Platform Administration. O facade não faz o check — os call-sites em
server functions (`superadmin.functions.ts` / futuras) devem validar via
`PlatformPermissionRegistry.assertCan` antes de invocar.

## Segurança

- Histórico imutável (`Object.freeze` nas versões).
- Rollback seguro: cria nova versão restaurando snapshot anterior, nunca
  sobrescreve versões antigas.
- Isolamento por tenant: targeting `tenants: [...]` só habilita para
  restaurantes explicitamente listados; targeting ausente → fallback ao
  `default_value` global.
- Kill switch aplica-se acima de qualquer targeting e default.

## Testes

`PlatformConfiguration.test.ts` — 19 casos cobrindo bucketing, engine
(killed/archived/expired/plan/tenant/env/region/channel/rollout), facade
(CRUD/versionamento/rollback/kill/rollout), remote config, planos, kill
switch e imutabilidade do histórico.
