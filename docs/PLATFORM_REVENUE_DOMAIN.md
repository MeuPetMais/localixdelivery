# Platform Revenue Domain

Domínio desacoplado, único responsável pelas regras de monetização da
plataforma Localix (service fee). Nenhum outro módulo pode calcular ou
hardcodar taxa — devem consumir `PlatformRevenueService`.

## Estrutura
- `PlatformRevenueService` — fachada pública.
- `ServiceFeeService` — cálculo puro (FIXED / PERCENTAGE / TIERED).
- `RevenuePolicyService` — validação de vigência (`effective_from/until`).
- `RevenueSettingsService` — loader com cache 60s (fonte: `platform_settings`).
- `RevenueAnalyticsService` — agregações (diária, mensal, anual, por restaurante).
- `RevenueEvents` — bus in-process: `RevenuePolicyChanged`,
  `ServiceFeeCalculated`, `ServiceFeeApplied`, `ServiceFeeDisabled`.

## Política
```
service_fee_enabled: boolean
service_fee_type: FIXED | PERCENTAGE | TIERED
service_fee_value: number
tiers?: [{ upTo, value }]         # p/ TIERED
currency: string
effective_from / effective_until  # vigência
active: boolean
```

Default vigente:
- TIERED: até R$30 → R$0,99 · acima → R$1,49
- Currency: BRL

## API pública
- `getCurrentServiceFee(subtotal): Promise<number>`
- `calculate({ subtotal }): Promise<{ amount, type, currency }>`
- `isActive(): Promise<boolean>`
- `getPolicy(): Promise<RevenuePolicy>`

## Integração
- `PricingEngine.calculateOrderPricing` consulta o domínio para obter a
  taxa vigente; **não há valores hardcoded no runtime**.
- Alterar taxa = `UPDATE public.platform_settings` (nunca no código).

## Campanhas futuras (desativado)
Estrutura suporta taxa zero em datas específicas via
`effective_from/until` e políticas alternativas — sem alterar a API.

Ver também: `PLATFORM_REVENUE_ARCHITECTURE.md`, `PLATFORM_REVENUE_EVENTS.md`.
