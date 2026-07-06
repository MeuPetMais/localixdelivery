# Platform Revenue — Arquitetura

```
                 ┌─────────────────────────────┐
                 │  platform_settings (DB)     │
                 └────────────┬────────────────┘
                              │  load (cache 60s)
                              ▼
                 ┌─────────────────────────────┐
                 │  RevenueSettingsService     │
                 └────────────┬────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
 RevenuePolicySvc     ServiceFeeService        RevenueAnalyticsSvc
 (vigência)           (FIXED/PCT/TIERED)       (agregações)
      └───────────┬───────────┘
                  ▼
       PlatformRevenueService (fachada)
                  ▲
                  │ consulta única
                  │
           PricingEngine → Checkout / Orders / Finance
```

Regra: apenas `PricingEngine` consome o domínio; todos os demais módulos
já consumiam o `PricingEngine`, portanto continuam desacoplados.
