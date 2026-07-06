# Platform Revenue Flow

```text
Order.total (BRL)
      │
      ▼
PlatformRevenueService.getCurrentServiceFee(subtotal)
      │  lê `platform_settings` (singleton, cache 60s)
      │
      ├─ FIXED     → service_fee_value
      ├─ PERCENTAGE→ subtotal * service_fee_value
      └─ TIERED    → subtotal ≤ 30 ? platform_fee_until_30 : platform_fee_above_30
      │
      ▼
Fee em BRL (única fonte de verdade)
      │
      ├──▶ PricingEngine (mostrado ao cliente)
      └──▶ stripe-checkout edge (application_fee_amount em centavos)
                 │
                 ▼
           Stripe Connect Split
                 │
                 ├──▶ Restaurante (acct_...)
                 └──▶ Localix (application_fee → conta plataforma)
```

**Auditoria "zero hardcoded":** o único lugar que menciona `0.99`/`1.49` é
`DEFAULT_POLICY` em `RevenueSettingsService`, usado apenas como fallback
quando `platform_settings` está vazio. Toda leitura efetiva passa pela
tabela via `PlatformRevenueService`.
